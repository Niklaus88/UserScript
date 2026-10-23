// ==UserScript==
// @name         爱壹帆 1080P 高清播放解锁
// @namespace    https://github.com/Niklaus88/UserScript
// @version      1.2.0
// @description  自动解锁爱壹帆（yfsp.tv）真·蓝光1080P画质，解除VIP限制，支持自由平滑切换清晰度
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

    console.log(`${TAG} 脚本已启动 (v1.2.0)，锁定真·蓝光1080P并启用多码率自由切换...`);

    // =========================================================================
    // 1. 数据拦截核心：解锁清晰度、默认锁定 蓝光1080P、保留多码率主列表
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

            // 1. 处理清晰度列表 (clarity)
            if (Array.isArray(info.clarity) && info.clarity.length > 0) {
                modified = true;
                let target1080 = null;

                info.clarity.forEach(c => {
                    // 全量解除清晰度的 VIP 限制
                    c.isVIP = false;
                    c.isBought = true;

                    const b = Number(c.bitrate) || 0;
                    // 排除 4K 客户端推广选项（网页端没有真4K切片，强选会触发客户端推广降级为低清流）
                    const is4K = (b > 1080) || (c.title && c.title.includes('4K')) || (c.description && c.description.includes('4K'));

                    if (!is4K) {
                        if (!target1080) {
                            target1080 = c;
                        } else if (c.title && c.title.includes('1080')) {
                            target1080 = c;
                        } else if (b === 1080) {
                            target1080 = c;
                        } else if (b > (target1080.bitrate || 0) && b <= 1080) {
                            target1080 = c;
                        }
                    }
                });

                if (!target1080) {
                    target1080 = info.clarity.find(c => !(c.title && c.title.includes('4K'))) || info.clarity[0];
                }

                console.log(`${TAG} 发现清晰度列表:`, info.clarity.map(c => `${c.title}(bitrate:${c.bitrate})`));
                console.log(`${TAG} 默认锁定最高画质:`, target1080.title);

                // 强制默认选中的画质为真·1080P，绝不选假 4K
                info.playingMedia = target1080;
                info.sharpness = target1080.bitrate || 1080;
            }

            // 2. 清除片头广告干扰，并保留 MasterPlayList
            if (Array.isArray(info.startData) && info.startData.length > 0) {
                info.startData = [];
                modified = true;
            }
            if (info.maxFrontAds) {
                info.maxFrontAds = 0;
                modified = true;
            }
            if (Array.isArray(info.flvPathList)) {
                // 仅过滤广告分段
                const realStreams = info.flvPathList.filter(item => !item.link);
                if (realStreams.length > 0) {
                    info.flvPathList = realStreams;
                    modified = true;
                }

                // 检查是否已有 MasterPlayList，如果有则必须保留以支持平滑切换画质
                const hasMaster = info.flvPathList.some(item => item.result && item.result.includes('MasterPlayList'));
                if (!hasMaster && info.playingMedia && info.playingMedia.path && info.playingMedia.path.result) {
                    info.flvPathList.forEach(item => {
                        if (!item.link) {
                            item.result = info.playingMedia.path.result;
                            item.backup = info.playingMedia.path.result;
                        }
                    });
                }
            }
        });

        if (modified) {
            showToast('已成功解锁并锁定 蓝光1080P 画质');
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
    // 4. Hls.js 安全辅助：解析出清单时确保默认指向 1080P
    // =========================================================================
    try {
        function hookSafeHls(HlsClass) {
            if (!HlsClass || HlsClass.__yfsp_safe_hooked) return HlsClass;
            HlsClass.__yfsp_safe_hooked = true;

            const proto = HlsClass.prototype;
            const origLoadSource = proto.loadSource;

            proto.loadSource = function (url) {
                if (!this.__yfsp_has_listener) {
                    this.__yfsp_has_listener = true;
                    this.on('hlsManifestParsed', (event, data) => {
                        if (data && Array.isArray(data.levels) && data.levels.length > 1) {
                            let targetIdx = -1;
                            data.levels.forEach((lvl, idx) => {
                                const h = lvl.height || parseInt(lvl.name) || 0;
                                if (h === 1080 || lvl.name === '1080' || lvl.name === '1080p') {
                                    targetIdx = idx;
                                }
                            });
                            if (targetIdx === -1) {
                                let maxH = 0;
                                data.levels.forEach((lvl, idx) => {
                                    const h = lvl.height || parseInt(lvl.name) || 0;
                                    if (h <= 1080 && h > maxH) {
                                        maxH = h;
                                        targetIdx = idx;
                                    }
                                });
                            }
                            if (targetIdx > -1) {
                                console.log(`${TAG} HLS 多码率解析完成，初始自动选档: Level ${targetIdx}`);
                                try {
                                    this.nextLevel = targetIdx;
                                } catch (e) {}
                            }
                        }
                    });
                }
                return origLoadSource.call(this, url);
            };

            return HlsClass;
        }

        if (win.Hls) {
            hookSafeHls(win.Hls);
        } else {
            let _Hls = undefined;
            Object.defineProperty(win, 'Hls', {
                get() {
                    return _Hls;
                },
                set(val) {
                    _Hls = hookSafeHls(val);
                },
                configurable: true,
                enumerable: true
            });
        }
    } catch (e) {
        console.warn(`${TAG} 安全注入 Hls 失败:`, e);
    }

    // =========================================================================
    // 5. “正在切换清晰度...” 卡屏看门狗
    // =========================================================================
    // 解决切换清晰度后原生界面残留提示文本卡死画面的问题
    setInterval(() => {
        try {
            const prompts = document.querySelectorAll('div, span');
            prompts.forEach(el => {
                if (el.children.length === 0 && (el.textContent.includes('正在切换清晰度') || el.textContent.includes('正在切换线路'))) {
                    if (!el.dataset.yfspTimer) {
                        el.dataset.yfspTimer = Date.now().toString();
                    } else if (Date.now() - parseInt(el.dataset.yfspTimer) > 1800) {
                        el.style.display = 'none';
                    }
                } else if (el.dataset && el.dataset.yfspTimer) {
                    delete el.dataset.yfspTimer;
                }
            });
        } catch (e) {}
    }, 500);

    // =========================================================================
    // 6. 轻量通知提示
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
