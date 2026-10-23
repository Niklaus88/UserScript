// ==UserScript==
// @name         爱壹帆 1080P 高清播放解锁
// @namespace    https://github.com/Niklaus88/UserScript
// @version      1.4.0
// @description  自动解锁爱壹帆（yfsp.tv）真·蓝光1080P画质，彻底剔除4K引流项，替换初始流为真实1080P，解除VIP限制，支持自由平滑切换
// @author       Niklaus88
// @match        https://www.yfsp.tv/*
// @match        https://yfsp.tv/*
// @icon         https://www.yfsp.tv/favicon.ico
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const TAG = '[爱壹帆1080P解锁]';

    console.log(`${TAG} 脚本已启动 (v1.4.0)，精准加载真·蓝光1080P切片流...`);

    // =========================================================================
    // 1. 数据拦截核心：精准剔除 4K 推广项、解锁 VIP 标识、初始流硬替换为 1080P
    // =========================================================================
    function patchVideoPlayResponse(json) {
        if (!json || !json.data) return false;

        const items = Array.isArray(json.data.info) ? json.data.info :
                      Array.isArray(json.data) ? json.data : null;

        if (!items || !items.length) return false;
        let modified = false;

        items.forEach(info => {
            if (!info || typeof info !== 'object') return;

            info.needLogin = false;
            info.isLimitStream = false;
            info.isLimitedStream = false;

            // 1. 深度处理清晰度列表 (clarity)
            if (Array.isArray(info.clarity) && info.clarity.length > 0) {
                modified = true;

                // (1) 仅根据文本标识精准过滤 4K 客户端推广项，严禁根据 bitrate 数值误杀 1080P
                const validClarity = info.clarity.filter(c => {
                    const is4K = (c.title && c.title.toLowerCase().includes('4k')) ||
                                 (c.description && c.description.toLowerCase().includes('4k')) ||
                                 (c.short && c.short.toLowerCase().includes('4k'));
                    return !is4K;
                });

                if (validClarity.length > 0) {
                    info.clarity = validClarity;
                }

                // (2) 按码率降序排列，确保首个项即为当前片源拥有的最高画质
                info.clarity.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));

                // (3) 解锁所有画质的 VIP 和已购买标记
                info.clarity.forEach(c => {
                    c.isVIP = false;
                    c.isBought = true;
                });

                // (4) 寻找 1080P 对应项
                const target1080 = info.clarity.find(c =>
                    (c.title && c.title.includes('1080')) ||
                    (c.description && c.description.includes('1080'))
                ) || info.clarity[0];

                if (target1080) {
                    console.log(`${TAG} 可用清晰度:`, info.clarity.map(c => c.title));
                    console.log(`${TAG} 锁定默认最高画质:`, target1080.title);

                    // 默认选中的清晰度强制指向 蓝光1080P
                    info.playingMedia = target1080;
                    info.sharpness = target1080.bitrate || 1080;

                    // (5) 核心关键：将初始下发的播放流 (flvPathList) 强制替换为 1080P 的真实切片地址
                    // 使网页播放器自第 1 帧起就向 CDN 请求真正的 1080P 分片
                    if (target1080.path && target1080.path.result && Array.isArray(info.flvPathList)) {
                        info.flvPathList.forEach(item => {
                            if (!item.link) {
                                item.result = target1080.path.result;
                                item.backup = target1080.path.result;
                                if (target1080.path.needSign !== undefined) item.needSign = target1080.path.needSign;
                                if (target1080.path.isHls !== undefined) item.isHls = target1080.path.isHls;
                            }
                        });
                    }
                }
            }

            // 2. 清理片头广告
            if (Array.isArray(info.startData)) info.startData = [];
            if (info.maxFrontAds) info.maxFrontAds = 0;
            if (Array.isArray(info.flvPathList)) {
                const realStreams = info.flvPathList.filter(item => !item.link);
                if (realStreams.length > 0) {
                    info.flvPathList = realStreams;
                }
            }
        });

        if (modified) {
            showToast('已成功锁定 蓝光1080P 真高清画质');
        }

        return modified;
    }

    // =========================================================================
    // 2. 劫持 XMLHttpRequest (Angular HttpClient 底层)
    // =========================================================================
    try {
        const OrigXHR = win.XMLHttpRequest;
        const origOpen = OrigXHR.prototype.open;
        const origSend = OrigXHR.prototype.send;

        OrigXHR.prototype.open = function (method, url, ...rest) {
            this._reqUrl = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
            return origOpen.apply(this, [method, url, ...rest]);
        };

        OrigXHR.prototype.send = function (...args) {
            const url = this._reqUrl || '';
            const isVideoApi = url.includes('video/play') || url.includes('video-media') || url.includes('video/detail');

            if (isVideoApi) {
                let patchedText = null;

                const getPatchedResponse = (raw) => {
                    if (patchedText !== null) return patchedText;
                    if (typeof raw !== 'string' || !raw) return raw;

                    try {
                        const json = JSON.parse(raw);
                        if (patchVideoPlayResponse(json)) {
                            patchedText = JSON.stringify(json);
                            return patchedText;
                        }
                    } catch (e) {
                        console.warn(`${TAG} 解析响应 JSON 失败:`, e);
                    }
                    patchedText = raw;
                    return patchedText;
                };

                const descText = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'responseText');
                const descResp = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'response');

                Object.defineProperty(this, 'responseText', {
                    get() {
                        const raw = descText ? descText.get.call(this) : this._rawResponseText;
                        return getPatchedResponse(raw);
                    },
                    configurable: true
                });

                Object.defineProperty(this, 'response', {
                    get() {
                        const raw = descResp ? descResp.get.call(this) : this._rawResponse;
                        return getPatchedResponse(raw);
                    },
                    configurable: true
                });
            }

            return origSend.apply(this, args);
        };
    } catch (e) {
        console.error(`${TAG} 劫持 XMLHttpRequest 失败:`, e);
    }

    // =========================================================================
    // 3. 劫持 window.fetch (双重保障)
    // =========================================================================
    try {
        const origFetch = win.fetch;
        if (typeof origFetch === 'function') {
            win.fetch = async function (...args) {
                const res = await origFetch.apply(this, args);
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

                if (url.includes('video/play') || url.includes('video-media')) {
                    try {
                        const clone = res.clone();
                        const json = await clone.json();
                        if (patchVideoPlayResponse(json)) {
                            return new Response(JSON.stringify(json), {
                                status: res.status,
                                statusText: res.statusText,
                                headers: res.headers
                            });
                        }
                    } catch (err) {}
                }

                return res;
            };
        }
    } catch (e) {}

    // =========================================================================
    // 4. “正在切换清晰度...” 卡屏看门狗与自动消除
    // =========================================================================
    setInterval(() => {
        try {
            const allElements = document.querySelectorAll('div, span');
            allElements.forEach(el => {
                if (el.children.length === 0 && (el.textContent.includes('正在切换清晰度') || el.textContent.includes('正在切换线路'))) {
                    if (!el.dataset.yfspSwitchTimer) {
                        el.dataset.yfspSwitchTimer = Date.now().toString();
                    } else if (Date.now() - parseInt(el.dataset.yfspSwitchTimer) > 1000) {
                        el.style.display = 'none';
                    }
                } else if (el.dataset && el.dataset.yfspSwitchTimer) {
                    delete el.dataset.yfspSwitchTimer;
                }
            });
        } catch (e) {}
    }, 250);

    // =========================================================================
    // 5. 轻量通知提示
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('yfsp-unlock-style')) return;
        const style = document.createElement('style');
        style.id = 'yfsp-unlock-style';
        style.textContent = `
            .yfsp-toast {
                position: fixed;
                top: 75px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(18, 18, 26, 0.94);
                color: #ffb400;
                border: 1px solid rgba(255, 180, 0, 0.45);
                padding: 8px 18px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                z-index: 2147483647;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(8px);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .yfsp-toast.show {
                opacity: 1;
                transform: translate(-50%, 6px);
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    let toastTimer = null;
    function showToast(msg) {
        injectStyles();
        let toast = document.getElementById('yfsp-toast-box');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'yfsp-toast-box';
            toast.className = 'yfsp-toast';
            (document.body || document.documentElement).appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

})();
