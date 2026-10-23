// ==UserScript==
// @name         爱壹帆 1080P 高清播放解锁
// @namespace    https://github.com/Niklaus88/UserScript
// @version      1.0.0
// @description  自动解锁爱壹帆（yfsp.tv）1080P/超清画质播放限制，解除非VIP画质锁定，支持画质快捷切换
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

    // 状态管理
    const state = {
        activeHls: null,
        levels: [],
        currentLevelIndex: -1,
        autoUnlocked: false,
        userSelected: false
    };

    console.log(`${TAG} 脚本已启动，监控画质与播放器内核...`);

    // =========================================================================
    // 1. Cookie & dn_config 配置劫持（强制 sharpness=1080）
    // =========================================================================
    function patchConfigString(str) {
        if (!str || typeof str !== 'string') return str;
        if (str.includes('sharpness=')) {
            return str.replace(/sharpness=\d+/g, 'sharpness=1080');
        }
        return str + (str.length > 0 ? '&' : '') + 'sharpness=1080';
    }

    try {
        // 设置当前域名的 dn_config
        const match = document.cookie.match(/(?:^|;\s*)dn_config=([^;]*)/);
        let configVal = match ? decodeURIComponent(match[1]) : '';
        configVal = patchConfigString(configVal);
        document.cookie = `dn_config=${encodeURIComponent(configVal)}; path=/; domain=.yfsp.tv; max-age=31536000`;

        // 劫持 document.cookie 的读取与写入，确保 sharpness 始终为 1080
        const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                           Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

        if (cookieDesc && cookieDesc.configurable) {
            Object.defineProperty(document, 'cookie', {
                get() {
                    let val = cookieDesc.get.call(document);
                    if (val && val.includes('dn_config=')) {
                        val = val.replace(/(dn_config=)([^;]*)/g, (_, prefix, encoded) => {
                            try {
                                return prefix + encodeURIComponent(patchConfigString(decodeURIComponent(encoded)));
                            } catch (e) {
                                return prefix + encoded;
                            }
                        });
                    }
                    return val;
                },
                set(newCookie) {
                    if (typeof newCookie === 'string' && newCookie.includes('dn_config=')) {
                        newCookie = newCookie.replace(/(dn_config=)([^;]*)/g, (_, prefix, encoded) => {
                            try {
                                return prefix + encodeURIComponent(patchConfigString(decodeURIComponent(encoded)));
                            } catch (e) {
                                return prefix + encoded;
                            }
                        });
                    }
                    return cookieDesc.set.call(document, newCookie);
                },
                configurable: true,
                enumerable: true
            });
        }
    } catch (err) {
        console.warn(`${TAG} Cookie 拦截注入失败:`, err);
    }

    // =========================================================================
    // 2. Hls.js 核心实例劫持与最高清晰度注入
    // =========================================================================
    function getBestLevelIndex(levels) {
        if (!levels || !levels.length) return -1;
        let bestIndex = -1;
        let maxHeight = 0;

        levels.forEach((lvl, idx) => {
            const h = lvl.height || parseInt(lvl.name) || 0;
            if (h >= maxHeight) {
                maxHeight = h;
                bestIndex = idx;
            }
        });

        return bestIndex !== -1 ? bestIndex : levels.length - 1;
    }

    function formatLevelLabel(level) {
        if (!level) return '未知';
        if (level.name && level.name !== '0') {
            return level.name.toUpperCase().endsWith('P') ? level.name.toUpperCase() : level.name + 'P';
        }
        if (level.height) return level.height + 'P';
        return '高清';
    }

    function hookHlsInstance(instance) {
        if (!instance || instance.__yfsp_hooked) return;
        instance.__yfsp_hooked = true;
        state.activeHls = instance;
        state.userSelected = false;

        console.log(`${TAG} 成功捕获 Hls 播放器实例:`, instance);

        // 劫持 nextLevel setter，阻断网站初期强制降级为 0（标清/480P）的操作
        let _nextLevel = -1;
        let allowDowngrade = false;

        // 5秒后允许用户自由向下切换画质
        setTimeout(() => {
            allowDowngrade = true;
        }, 3000);

        Object.defineProperty(instance, 'nextLevel', {
            get() {
                return _nextLevel;
            },
            set(val) {
                if (!allowDowngrade && !state.userSelected && val === 0 && instance.levels && instance.levels.length > 1) {
                    const best = getBestLevelIndex(instance.levels);
                    console.log(`${TAG} 拦截网站非VIP画质降级行为 (目标 Level: 0)，强制提升为最高画质 (Level: ${best})`);
                    _nextLevel = best;
                    try {
                        if (instance.levelController) {
                            instance.levelController.manualLevel = best;
                        }
                    } catch (e) {}
                    return;
                }
                _nextLevel = val;
                state.currentLevelIndex = val;
                updateUILabel();
            },
            configurable: true,
            enumerable: true
        });

        // 监听清单解析事件
        if (typeof instance.on === 'function') {
            instance.on('hlsManifestParsed', (event, data) => {
                if (!data || !data.levels || !data.levels.length) return;
                state.levels = data.levels;
                console.log(`${TAG} 视频清单解析完成，可用画质列表:`, data.levels.map(l => formatLevelLabel(l)));

                const bestIndex = getBestLevelIndex(data.levels);
                if (bestIndex > -1) {
                    console.log(`${TAG} 自动解锁并设定最高画质: [${formatLevelLabel(data.levels[bestIndex])}] (Index: ${bestIndex})`);
                    state.currentLevelIndex = bestIndex;

                    // 立即设为最高清晰度
                    instance.startLevel = bestIndex;
                    instance.nextLevel = bestIndex;
                    instance.currentLevel = bestIndex;
                    state.autoUnlocked = true;

                    // 延迟 50ms 再次确保覆盖 Angular 监听回调
                    setTimeout(() => {
                        instance.nextLevel = bestIndex;
                        instance.currentLevel = bestIndex;
                        showToast(`已成功解锁并切换至 ${formatLevelLabel(data.levels[bestIndex])} 超清画质`);
                        renderQualityMenu();
                    }, 50);
                }
            });

            // 监听清晰度切换完成事件
            instance.on('hlsLevelSwitched', (event, data) => {
                if (data && typeof data.level === 'number') {
                    state.currentLevelIndex = data.level;
                    updateUILabel();
                }
            });
        }
    }

    function wrapHlsConstructor(OriginalHls) {
        if (!OriginalHls || OriginalHls.__yfsp_wrapped) return OriginalHls;

        const ProxyHls = function (...args) {
            const instance = new OriginalHls(...args);
            hookHlsInstance(instance);
            return instance;
        };

        ProxyHls.prototype = OriginalHls.prototype;
        Object.assign(ProxyHls, OriginalHls);
        ProxyHls.__yfsp_wrapped = true;
        return ProxyHls;
    }

    // 拦截全局 Hls 注入
    if (win.Hls) {
        win.Hls = wrapHlsConstructor(win.Hls);
    } else {
        let _Hls = undefined;
        Object.defineProperty(win, 'Hls', {
            get() {
                return _Hls;
            },
            set(val) {
                _Hls = wrapHlsConstructor(val);
            },
            configurable: true,
            enumerable: true
        });
    }

    // =========================================================================
    // 3. 悬浮画质切换器 UI 注入
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('yfsp-unlock-style')) return;
        const style = document.createElement('style');
        style.id = 'yfsp-unlock-style';
        style.textContent = `
            .yfsp-quality-badge-wrap {
                position: absolute;
                bottom: 58px;
                right: 18px;
                z-index: 2147483640;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                user-select: none;
            }
            .yfsp-quality-badge {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 4px 10px;
                background: rgba(18, 18, 24, 0.82);
                color: #fff;
                border: 1px solid rgba(255, 180, 0, 0.5);
                border-radius: 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(8px);
                transition: all 0.25s ease;
            }
            .yfsp-quality-badge:hover {
                background: rgba(28, 28, 38, 0.95);
                border-color: #ffb400;
                transform: translateY(-1px);
                box-shadow: 0 4px 14px rgba(255, 180, 0, 0.25);
            }
            .yfsp-quality-dot {
                width: 7px;
                height: 7px;
                background: #00e676;
                border-radius: 50%;
                box-shadow: 0 0 6px #00e676;
            }
            .yfsp-quality-menu {
                position: absolute;
                bottom: 34px;
                right: 0;
                background: rgba(22, 22, 30, 0.96);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                padding: 5px 0;
                min-width: 100px;
                display: none;
                flex-direction: column;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(12px);
            }
            .yfsp-quality-badge-wrap:hover .yfsp-quality-menu,
            .yfsp-quality-menu.show {
                display: flex;
            }
            .yfsp-quality-item {
                padding: 7px 14px;
                font-size: 12px;
                color: #bbb;
                cursor: pointer;
                text-align: center;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .yfsp-quality-item:hover {
                color: #fff;
                background: rgba(255, 180, 0, 0.18);
            }
            .yfsp-quality-item.active {
                color: #ffb400;
                font-weight: bold;
                background: rgba(255, 180, 0, 0.1);
            }
            .yfsp-toast {
                position: fixed;
                top: 70px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 15, 22, 0.92);
                color: #ffb400;
                border: 1px solid rgba(255, 180, 0, 0.4);
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
            }
            .yfsp-toast.show {
                opacity: 1;
                transform: translate(-50%, 6px);
            }
        `;
        document.head.appendChild(style);
    }

    let toastTimer = null;
    function showToast(msg) {
        injectStyles();
        let toast = document.getElementById('yfsp-toast-box');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'yfsp-toast-box';
            toast.className = 'yfsp-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    function updateUILabel() {
        const textSpan = document.getElementById('yfsp-current-quality-text');
        if (!textSpan || !state.levels.length) return;
        const curLevel = state.levels[state.currentLevelIndex];
        const label = curLevel ? formatLevelLabel(curLevel) : '自动';
        textSpan.textContent = `${label} [已解锁]`;

        // 更新菜单项选中样式
        document.querySelectorAll('.yfsp-quality-item').forEach(el => {
            const idx = parseInt(el.getAttribute('data-index'));
            el.classList.toggle('active', idx === state.currentLevelIndex);
        });
    }

    function renderQualityMenu() {
        injectStyles();
        if (!state.levels || !state.levels.length) return;

        // 寻找适合插入 UI 的视频容器或全屏容器
        const targetContainer = document.fullscreenElement ||
                                document.querySelector('.video-container') ||
                                document.querySelector('app-simple-videoplayer') ||
                                document.querySelector('#main-player') ||
                                document.body;

        let wrap = document.getElementById('yfsp-quality-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'yfsp-quality-wrap';
            wrap.className = 'yfsp-quality-badge-wrap';
            wrap.innerHTML = `
                <div class="yfsp-quality-menu" id="yfsp-quality-menu"></div>
                <div class="yfsp-quality-badge" id="yfsp-quality-badge">
                    <span class="yfsp-quality-dot"></span>
                    <span id="yfsp-current-quality-text">1080P [已解锁]</span>
                </div>
            `;
            targetContainer.appendChild(wrap);
        } else if (wrap.parentElement !== targetContainer) {
            targetContainer.appendChild(wrap);
        }

        const menu = document.getElementById('yfsp-quality-menu');
        if (menu) {
            menu.innerHTML = '';

            // 添加各画质选项（从高到低排列）
            for (let i = state.levels.length - 1; i >= 0; i--) {
                const lvl = state.levels[i];
                const item = document.createElement('div');
                item.className = 'yfsp-quality-item';
                item.setAttribute('data-index', i.toString());
                item.textContent = formatLevelLabel(lvl);
                if (i === state.currentLevelIndex) item.classList.add('active');

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!state.activeHls) return;
                    state.userSelected = true;
                    state.currentLevelIndex = i;
                    state.activeHls.nextLevel = i;
                    state.activeHls.currentLevel = i;
                    updateUILabel();
                    showToast(`已手动切换清晰度至: ${formatLevelLabel(lvl)}`);
                });

                menu.appendChild(item);
            }

            // 添加自动切换选项
            const autoItem = document.createElement('div');
            autoItem.className = 'yfsp-quality-item';
            autoItem.setAttribute('data-index', '-1');
            autoItem.textContent = '自动 (自适应)';
            if (state.currentLevelIndex === -1) autoItem.classList.add('active');
            autoItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!state.activeHls) return;
                state.userSelected = true;
                state.currentLevelIndex = -1;
                state.activeHls.nextLevel = -1;
                state.activeHls.currentLevel = -1;
                updateUILabel();
                showToast('已切换至: 自动 (自适应码率)');
            });
            menu.appendChild(autoItem);
        }

        updateUILabel();
    }

    // 监听全屏切换，确保悬浮菜单在全屏下依然能够访问
    document.addEventListener('fullscreenchange', () => {
        setTimeout(renderQualityMenu, 100);
    });

    // 定时轮询，确保在路由切换 / 切集时重新绑定 UI
    setInterval(() => {
        if (state.levels && state.levels.length > 0) {
            const wrap = document.getElementById('yfsp-quality-wrap');
            if (!wrap || !document.body.contains(wrap)) {
                renderQualityMenu();
            }
        }
    }, 2000);

})();
