// ==UserScript==
// @name         古文岛 / 古诗文网 会员限制与全文解锁
// @namespace    https://github.com/Niklaus88/UserScript
// @version      1.2.0
// @description  彻底解锁古文岛 (guwendao.net) 和古诗文网 (gushiwen.cn) 的会员限制：自动展开译文/注释/赏析/拼音全文、解除折叠与“会员解锁全文”限制、拦截付费弹窗与登录跳转拦截、保护真实登录不掉线、解除音频15秒试听限制、解锁背诵与拓展内容等。
// @author       Niklaus88
// @match        *://*.guwendao.net/*
// @match        *://*.gushiwen.cn/*
// @match        *://*.gushiwen.org/*
// @exclude      *://*.guwendao.net/user/login.aspx*
// @exclude      *://*.gushiwen.cn/user/login.aspx*
// @exclude      *://*.gushiwen.org/user/login.aspx*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    // 1. 登录页面绝对不执行任何干扰，保证用户扫码登录/账号登录正常完成
    if (location.pathname.indexOf('/user/login') !== -1) {
        return;
    }

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // 2. 清理上一版本遗留在浏览器持久化 Cookie 中的假账号，避免导致服务端 Session 冲突被踢下线
    (function cleanupLegacyFakeCookie() {
        try {
            const match = document.cookie.match(/(?:^|; )gsw2017user=([^;]*)/);
            if (match) {
                const val = decodeURIComponent(match[1] || '');
                // 若包含旧脚本写入的 88888888 假账号，立即清除该持久化 Cookie
                if (val.indexOf('88888888') === 0) {
                    const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
                    const host = location.hostname;
                    const rootDomain = '.' + host.split('.').slice(-2).join('.');
                    document.cookie = 'gsw2017user=;expires=' + past + ';path=/;domain=' + rootDomain;
                    document.cookie = 'gsw2017user=;expires=' + past + ';path=/;';
                }
            }
        } catch (e) {}
    })();

    // 3. 读取真实 Cookie 的辅助函数（只读，绝不篡改原生 document.cookie）
    function getNativeCookie(name) {
        try {
            const reg = new RegExp('(?:^|; )' + name + '=([^;]*)');
            const arr = document.cookie.match(reg);
            return arr ? decodeURIComponent(arr[1]) : null;
        } catch (e) {
            return null;
        }
    }

    // 4. 智能伪装 getCookie('gsw2017user')：
    //    - 若用户已真实登录：保留其真实的 userId 与用户名，仅在前端将 VIP/SVIP 到期日期扩展至 2099 年；
    //    - 若用户未登录：前端返回安全的访客 VIP 身份。
    function getVirtualUserCookie() {
        const raw = getNativeCookie('gsw2017user');
        if (raw) {
            const parts = raw.split('|');
            const uid = parts[0] || 'user';
            const uname = parts[1] || 'vip';
            // 保留真实 uid 与用户名，仅附加 2099 年 VIP/SVIP 到期时间
            return uid + '|' + uname + '|2099-12-31|2099-12-31';
        }
        // 未登录时的安全回退身份
        return 'guest|vip|2099-12-31|2099-12-31';
    }

    // 5. 核心：劫持 document.cookie 的 getter（保证纯前端模拟，不修改网络传输中的 Cookie Header）
    (function hookDocumentCookie() {
        try {
            const docProto = (win.Document || Document).prototype;
            const cookieDesc = Object.getOwnPropertyDescriptor(docProto, 'cookie') ||
                               Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
            if (cookieDesc && cookieDesc.get) {
                const rawGet = cookieDesc.get;
                const rawSet = cookieDesc.set;
                const newCookieProp = {
                    get: function () {
                        const realCookie = rawGet.call(this) || '';
                        const virtual = getVirtualUserCookie();
                        if (!realCookie) {
                            return 'gsw2017user=' + encodeURIComponent(virtual);
                        }
                        if (realCookie.indexOf('gsw2017user=') === -1) {
                            return realCookie + '; gsw2017user=' + encodeURIComponent(virtual);
                        }
                        return realCookie.replace(/(?:^|;\s*)gsw2017user=([^;]*)/, function (match) {
                            const prefix = match.indexOf(';') !== -1 ? '; ' : '';
                            return prefix + 'gsw2017user=' + encodeURIComponent(virtual);
                        });
                    },
                    set: function (val) {
                        return rawSet.call(this, val);
                    },
                    configurable: true
                };

                Object.defineProperty(document, 'cookie', newCookieProp);
                if (win.document && win.document !== document) {
                    try {
                        Object.defineProperty(win.document, 'cookie', newCookieProp);
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.warn('[古文岛解锁] Cookie getter hook failed:', e);
        }
    })();

    // 6. 拦截网页自身的 getCookie 函数（防网页后续加载覆盖）
    let _activeGetCookie = function (name) {
        if (name === 'gsw2017user') {
            return getVirtualUserCookie();
        }
        return getNativeCookie(name);
    };

    try {
        Object.defineProperty(win, 'getCookie', {
            get: () => _activeGetCookie,
            set: (fn) => {
                _activeGetCookie = function (name) {
                    if (name === 'gsw2017user') {
                        return getVirtualUserCookie();
                    }
                    if (typeof fn === 'function') {
                        try {
                            return fn(name);
                        } catch (e) {}
                    }
                    return getNativeCookie(name);
                };
            },
            configurable: true
        });
    } catch (e) {
        win.getCookie = _activeGetCookie;
    }

    // 7. 拦截与重写全局会员判断函数
    function defineConstant(obj, prop, value) {
        try {
            Object.defineProperty(obj, prop, {
                get: () => value,
                set: () => {},
                configurable: true
            });
        } catch (e) {
            obj[prop] = value;
        }
    }

    defineConstant(win, 'checkSvip', () => true);
    defineConstant(win, 'yzsCookieIsMember', () => true);
    defineConstant(win, 'getUserInfo', () => true);
    defineConstant(win, 'showlayuiPay', (type) => {
        console.log('[古文岛解锁] 已拦截付费弹窗:', type);
    });
    defineConstant(win, 'showlayuiPayVip', (type) => {
        console.log('[古文岛解锁] 已拦截VIP付费弹窗:', type);
    });
    defineConstant(win, 'addEventListenerAudio', () => {
        console.log('[古文岛解锁] 已拦截音频15秒试听限制');
    });

    // 8. 核心：在事件捕获阶段拦截点击事件，彻底击穿 listenerPlay.js 的拦截与弹窗逻辑
    win.addEventListener('click', function (event) {
        const target = event.target;
        if (!target) return;

        // 如果用户主动点击了“收起”，记录折叠标记，不强行再次展开
        const closeBtn = target.closest ? target.closest('a[href*="Close"], a[title="收起"]') : null;
        if (closeBtn) {
            const closeHref = closeBtn.getAttribute('href') || '';
            const match = closeHref.match(/([a-zA-Z0-9_]+Close)\(([^)]+)\)/);
            if (match) {
                const kind = match[1].replace('Close', '');
                const id = match[2].replace(/['"]/g, '').trim();
                const fullEl = document.getElementById(kind + 'quan' + id) ||
                               document.getElementById(kind + 'Quan' + id);
                if (fullEl) {
                    fullEl.dataset.userCollapsed = 'true';
                }
            }
            return;
        }

        // 查找展开按钮（包括 <a> 标签或覆盖在文字上方的遮罩 <div>）
        const btn = target.closest
            ? target.closest('a[href*="Show"], div[onclick*="Show"], a[onclick*="Show"]')
            : null;

        if (!btn) return;

        const href = btn.getAttribute('href') || '';
        const onclick = btn.getAttribute('onclick') || '';
        const combined = href + onclick;

        const isShowAction = /(fanyiShow|shangxiShow|ziliaoShow|jibenShiyiShow|ciyuJibenShiyiShow|xiangxiShiyiShow|ciyuXiangxiShiyiShow|kangxiShow|shuowenShow|chengyuYinzhengShow|ShowYizhu)/.test(combined);

        if (isShowAction) {
            // 阻止 listenerPlay.js 捕获阶段拦截、preventDefault 及跳登录逻辑
            event.stopImmediatePropagation();
            event.preventDefault();

            // 如果此前记录过用户收起状态，清除用户收起标记
            const match = combined.match(/([a-zA-Z0-9_]+Show)\(([^)]+)\)/);
            if (match) {
                const kind = match[1].replace('Show', '');
                const args = match[2].split(',').map(s => s.replace(/['"]/g, '').trim());
                const id = args[0] || '';
                const fullEl = document.getElementById(kind + 'quan' + id) ||
                               document.getElementById(kind + 'Quan' + id);
                if (fullEl) {
                    delete fullEl.dataset.userCollapsed;
                }
            }

            // 在全局作用域安全执行展开函数
            try {
                if (href.indexOf('javascript:') === 0) {
                    const code = decodeURIComponent(href.replace(/^javascript:/i, ''));
                    new win.Function(code)();
                } else if (onclick) {
                    new win.Function(onclick)();
                }
            } catch (err) {
                console.warn('[古文岛解锁] 手动展开函数调用异常，执行 DOM 兜底展示:', err);
                expandAllCollapsedSections();
            }
        }
    }, true);

    // 9. 将截断的 preview 接口 URL 自动还原为全量接口 URL
    function restoreFullUrl(url) {
        if (!url || typeof url !== 'string' || url.indexOf('ajaxyzspreview') === -1) {
            return url;
        }
        try {
            const u = new URL(url, location.origin);
            const src = u.searchParams.get('src') || '';
            const id = u.searchParams.get('id') || '';
            const value = u.searchParams.get('value') || '';
            let fullPath = '';
            if (src === 'book') {
                fullPath = '/nocdn/ajaxbookcont.aspx?id=' + id + (value ? '&value=' + value : '');
            } else if (src === 'detail') {
                fullPath = '/nocdn/ajaxshiwendetailcont.aspx?id=' + id + (value ? '&value=' + value : '');
            } else if (src === 'search') {
                fullPath = '/nocdn/ajaxshiwencontsearch.aspx?id=' + id + (value ? '&value=' + value : '');
            } else if (src === 'list') {
                fullPath = '/nocdn/ajaxshiwencont230427.aspx?id=' + id + (value ? '&value=' + value : '');
            } else if (src === 'bfanyiyc') {
                fullPath = '/nocdn/ajaxbfanyiyuanchuang.aspx?id=' + id;
            } else if (src === 'bfanyi') {
                fullPath = '/nocdn/ajaxbfanyi.aspx?id=' + id;
            }
            return fullPath || url;
        } catch (e) {
            return url;
        }
    }

    // 10. 劫持 XMLHttpRequest
    if (win.XMLHttpRequest) {
        const rawOpen = win.XMLHttpRequest.prototype.open;
        const rawSend = win.XMLHttpRequest.prototype.send;

        win.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            let targetUrl = typeof url === 'string' ? url : '';
            // 若被 listenerPlay.js 替换为截断预览链接，将其强制还原为全量内容链接
            targetUrl = restoreFullUrl(targetUrl);

            this._targetUrl = targetUrl;
            this._isGetUserInfo = targetUrl.indexOf('/pay/getUserInfo.aspx') !== -1;
            this._isAsync = async !== false;

            const args = Array.prototype.slice.call(arguments);
            args[1] = targetUrl;
            return rawOpen.apply(this, args);
        };

        win.XMLHttpRequest.prototype.send = function (data) {
            const xhr = this;

            // 针对 /pay/getUserInfo.aspx：伪造返回 'ok'，避免因未真实登录而被重定向到登录页
            if (xhr._isGetUserInfo) {
                Object.defineProperty(xhr, 'status', { get: () => 200, configurable: true });
                Object.defineProperty(xhr, 'readyState', { get: () => 4, configurable: true });
                Object.defineProperty(xhr, 'responseText', { get: () => 'ok', configurable: true });
                Object.defineProperty(xhr, 'response', { get: () => 'ok', configurable: true });

                const triggerReady = () => {
                    if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
                    if (typeof xhr.onload === 'function') xhr.onload();
                };

                if (!xhr._isAsync) {
                    triggerReady();
                    return;
                } else {
                    setTimeout(triggerReady, 0);
                    return;
                }
            }

            // 阻断接口返回 "未登录" 字符串触发 skin.js 中的跳登录逻辑
            const prevOnReady = xhr.onreadystatechange;
            xhr.onreadystatechange = function () {
                try {
                    if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText === '未登录') {
                        // 将 "未登录" 响应置空，防止触发：if (xmlhttp.responseText == "未登录") location.href = ...
                        Object.defineProperty(xhr, 'responseText', { get: () => '', configurable: true });
                    }
                } catch (e) {}
                if (typeof prevOnReady === 'function') {
                    return prevOnReady.apply(this, arguments);
                }
            };

            return rawSend.apply(this, arguments);
        };
    }

    // 11. 拦截音频播放事件，防止音频15秒试听限制
    document.addEventListener('play', function (e) {
        if (e.target && e.target.tagName === 'AUDIO') {
            const audio = e.target;
            audio.hasShownPopup = true; // 绕过 listenerPlay 中的试听截断弹窗
        }
    }, true);

    // 12. 自动展开所有译文、注释、赏析、资料、释义等折叠区域
    function expandAllCollapsedSections() {
        const fullPrefixes = [
            { brief: 'fanyi', full: 'fanyiquan' },
            { brief: 'shangxi', full: 'shangxiquan' },
            { brief: 'ziliao', full: 'ziliaoquan' },
            { brief: 'jibenShiyi', full: 'jibenShiyiQuan' },
            { brief: 'xiangxiShiyi', full: 'xiangxiShiyiQuan' },
            { brief: 'kangxi', full: 'kangxiquan' },
            { brief: 'shuowen', full: 'shuowenquan' },
            { brief: 'chengyuYinzheng', full: 'chengyuYinzhengQuan' }
        ];

        for (let k = 0; k < fullPrefixes.length; k++) {
            const p = fullPrefixes[k];
            const fullList = document.querySelectorAll('[id^="' + p.full + '"]');
            for (let i = 0; i < fullList.length; i++) {
                const fullEl = fullList[i];
                if (fullEl.dataset.userCollapsed === 'true') {
                    continue; // 尊重用户主动点击“收起”
                }

                const id = fullEl.id.substring(p.full.length);
                const briefEl = document.getElementById(p.brief + id);

                // 移除简版内的渐隐遮罩
                if (briefEl) {
                    const masks = briefEl.querySelectorAll('div[style*="morebg.png"]');
                    for (let m = 0; m < masks.length; m++) {
                        masks[m].remove();
                    }
                }

                // 若全量容器已包含 SSR 渲染内容，直接显示全量内容并隐藏简版折叠块
                if (fullEl.innerHTML.trim().length > 0) {
                    if (fullEl.style.display === 'none') {
                        fullEl.style.display = 'block';
                    }
                    if (briefEl && briefEl.style.display !== 'none') {
                        briefEl.style.display = 'none';
                    }
                } else if (briefEl && briefEl.style.display !== 'none') {
                    // 全量容器暂未填充内容时，自动触发展开函数发起 Ajax 加载
                    const triggerBtn = briefEl.querySelector('a[href*="Show"], div[onclick*="Show"]');
                    if (triggerBtn && !triggerBtn._autoTriggered) {
                        triggerBtn._autoTriggered = true;
                        const h = triggerBtn.getAttribute('href') || '';
                        const oc = triggerBtn.getAttribute('onclick') || '';
                        try {
                            if (h.indexOf('javascript:') === 0) {
                                new win.Function(decodeURIComponent(h.replace(/^javascript:/i, '')))();
                            } else if (oc) {
                                new win.Function(oc)();
                            }
                        } catch (e) {}
                    }
                }
            }
        }
    }

    // 13. DOM 兜底解包与遮罩清理
    function unwrapPreviews() {
        // 自动展开折叠全文
        expandAllCollapsedSections();

        // 移除渐隐遮罩和解锁按钮
        const fadesAndUnlocks = document.querySelectorAll('.yzs-member-fade, .yzs-member-unlock');
        for (let i = 0; i < fadesAndUnlocks.length; i++) {
            fadesAndUnlocks[i].remove();
        }

        // 解开 .yzs-member-preview 包装层
        const wraps = document.querySelectorAll('.yzs-member-preview');
        for (let i = 0; i < wraps.length; i++) {
            const wrap = wraps[i];
            const parent = wrap.parentNode;
            if (parent) {
                while (wrap.firstChild) {
                    parent.insertBefore(wrap.firstChild, wrap);
                }
                wrap.remove();
            }
        }

        // 移除等待加载导致的透明度类
        const pendings = document.querySelectorAll('.yzs-preview-pending');
        for (let i = 0; i < pendings.length; i++) {
            pendings[i].classList.remove('yzs-preview-pending');
            pendings[i].style.opacity = '1';
        }

        // 恢复被隐藏的后续兄弟元素
        const contentBoxes = document.querySelectorAll('[id^="zhengwen"], .contson');
        for (let i = 0; i < contentBoxes.length; i++) {
            let sibling = contentBoxes[i].nextSibling;
            while (sibling) {
                if (sibling.nodeType === 1 && sibling.style.display === 'none') {
                    sibling.style.display = '';
                }
                sibling = sibling.nextSibling;
            }
        }
    }

    // 监听 DOM 树变动，实时清洗残余限制节点与展开新加载的内容
    let debounceTimer = null;
    if (win.MutationObserver) {
        const observer = new MutationObserver(function () {
            if (debounceTimer) return;
            debounceTimer = setTimeout(function () {
                debounceTimer = null;
                unwrapPreviews();
            }, 30);
        });
        observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
        });
    }

    // 14. 注入全局 CSS 保证全文立即可见，屏蔽遮罩与弹窗
    const css = `
        .yzs-member-fade,
        .yzs-member-unlock,
        .layui-layer-shade,
        .layui-layer-iframe,
        div[style*="morebg.png"] {
            display: none !important;
        }
        .yzs-member-preview {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
        }
        .yzs-preview-pending {
            opacity: 1 !important;
        }
    `;
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);

    // 页面就绪后解包清理与展开全文
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', unwrapPreviews);
    } else {
        unwrapPreviews();
    }
    window.addEventListener('load', unwrapPreviews);
})();
