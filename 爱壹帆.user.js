// ==UserScript==
// @name         爱壹帆 1080P 高清播放解锁
// @namespace    https://github.com/Niklaus88/UserScript
// @version      1.1.0
// @description  自动解锁爱壹帆（yfsp.tv）1080P/超清画质播放限制，解除VIP限制，去除播放等待
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

    console.log(`${TAG} 脚本已启动 (v1.1.0)，正在劫持流媒体鉴权与数据流...`);

    // =========================================================================
    // 1. 数据拦截核心：解析并解锁 API 返回的 clarity (画质列表) 与 flvPathList (播放源)
    // =========================================================================
    function patchVideoPlayResponse(json) {
        if (!json || !json.data) return false;

        const items = Array.isArray(json.data.info) ? json.data.info :
                      Array.isArray(json.data) ? json.data : null;

        if (!items || !items.length) return false;
        let modified = false;

        items.forEach(info => {
            if (!info || typeof info !== 'object') return;

            // 解除登录与限制标记
            info.needLogin = false;
            info.isLimitStream = false;
            info.isLimitedStream = false;

            // 1. 解锁画质列表 (clarity)
            if (Array.isArray(info.clarity) && info.clarity.length > 0) {
                modified = true;
                let bestClarity = null;
                let maxBitrate = 0;

                info.clarity.forEach(c => {
                    // 解除单个清晰度的 VIP 限制
                    c.isVIP = false;
                    c.isBought = true;

                    const rate = Number(c.bitrate) || 0;
                    if (rate >= maxBitrate) {
                        maxBitrate = rate;
                        bestClarity = c;
                    }
                });

                if (!bestClarity) {
                    bestClarity = info.clarity[0];
                }

                console.log(`${TAG} 发现画质列表:`, info.clarity.map(c => `${c.title}(bitrate:${c.bitrate})`));
                console.log(`${TAG} 自动选取最高画质:`, bestClarity.title);

                // 强制默认选中的画质为最高画质 (如 1080P)
                info.playingMedia = bestClarity;
                info.sharpness = bestClarity.bitrate;

                // 2. 将初始视频流 (flvPathList) 强制替换为最高画质流
                if (bestClarity.path && bestClarity.path.result && Array.isArray(info.flvPathList)) {
                    info.flvPathList.forEach(item => {
                        if (!item.link) {
                            item.result = bestClarity.path.result;
                            item.backup = bestClarity.path.result;
                            if (bestClarity.path.isHls !== undefined) {
                                item.isHls = bestClarity.path.isHls;
                            }
                        }
                    });
                }
            }

            // 3. 清除片头广告干扰
            if (Array.isArray(info.startData) && info.startData.length > 0) {
                info.startData = [];
                modified = true;
            }
            if (info.maxFrontAds) {
                info.maxFrontAds = 0;
                modified = true;
            }
            if (Array.isArray(info.flvPathList)) {
                const realStreams = info.flvPathList.filter(item => !item.link);
                if (realStreams.length > 0 && realStreams.length !== info.flvPathList.length) {
                    info.flvPathList = realStreams;
                    modified = true;
                }
            }
        });

        if (modified) {
            showToast('已成功解锁 1080P/最高画质');
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

        console.log(`${TAG} XMLHttpRequest 劫持成功`);
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
            console.log(`${TAG} window.fetch 劫持成功`);
        }
    } catch (e) {}

    // =========================================================================
    // 4. 安全监听 Hls.js（仅在主多码率 m3u8 时辅助自适应最高画质，不破坏状态机）
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
                            console.log(`${TAG} HLS 多码率清单解析完成，最高档位:`, data.levels.length - 1);
                            // 保持在最高画质档位
                            try {
                                this.nextLevel = data.levels.length - 1;
                            } catch (e) {}
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
    // 5. 轻量提示框
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
        }, 3000);
    }

})();
