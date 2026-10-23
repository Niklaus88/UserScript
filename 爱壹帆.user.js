// ==UserScript==
// @name         爱壹帆 1080P 高清换源播放 (方案B)
// @namespace    https://github.com/Niklaus88/UserScript
// @version      2.0.0
// @description  为爱壹帆（yfsp.tv）接入第三方真·1080P高清蓝光切片源，一键切换极清画质，免除VIP限制与画质封锁，去广告并支持多线路自由切换
// @author       Niklaus88
// @match        https://www.yfsp.tv/*
// @match        https://yfsp.tv/*
// @icon         https://www.yfsp.tv/favicon.ico
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      bfzyapi.com
// @connect      hhzyapi.com
// @connect      subocaiji.com
// @connect      cj.lziapi.com
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js
// @require      https://cdn.jsdelivr.net/npm/artplayer@5.1.7/dist/artplayer.legacy.js
// ==/UserScript==

(function () {
    'use strict';

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const TAG = '[爱壹帆1080P换源]';

    console.log(`${TAG} 脚本已启动 (v2.0.0 方案B) - 真1080P第三方高清聚合源引擎`);

    // =========================================================================
    // 0. 线路配置 (支持多源自动容灾检索)
    // =========================================================================
    const SOURCES = [
        { id: 'bfzy', name: '暴风线路 (1080P极清)', api: 'https://bfzyapi.com/api.php/provide/vod/?ac=detail&wd=' },
        { id: 'hhzy', name: '红牛线路 (1080P高清)', api: 'https://hhzyapi.com/api.php/provide/vod/?ac=detail&wd=' },
        { id: 'subo', name: '速播线路 (1080P高清)', api: 'https://subocaiji.com/api.php/provide/vod/?ac=detail&wd=' },
        { id: 'lzi',  name: '量子线路 (备用高清)', api: 'https://cj.lziapi.com/api.php/provide/vod/?ac=detail&wd=' }
    ];

    // 全局当前状态
    let currentVideoTitle = '';
    let currentEpisodeNum = '';
    let artInstance = null;
    let isHdActive = false;
    let currentMatchedList = []; // 当前剧集的第三方播放列表 [{ source, name, episodes: [{ num, title, url }] }]
    let selectedSourceIndex = 0;

    // =========================================================================
    // 1. 数据拦截：从后端请求中无损捕获剧名与集数信息 + 清理官方广告
    // =========================================================================
    function handlePlayResponse(json) {
        if (!json || !json.data) return;
        const items = Array.isArray(json.data.info) ? json.data.info :
                      Array.isArray(json.data) ? json.data : null;
        if (!items || !items.length) return;

        items.forEach(info => {
            if (!info || typeof info !== 'object') return;

            // 提取集数
            if (info.mediaTitle) {
                const epMatch = String(info.mediaTitle).match(/\d+/);
                if (epMatch) {
                    currentEpisodeNum = epMatch[0];
                    console.log(`${TAG} 捕获当前播放集数: 第 ${currentEpisodeNum} 集`);
                }
            }

            // 去广告
            if (Array.isArray(info.startData)) info.startData = [];
            if (info.maxFrontAds) info.maxFrontAds = 0;
            if (Array.isArray(info.flvPathList)) {
                const realStreams = info.flvPathList.filter(item => !item.link);
                if (realStreams.length > 0) info.flvPathList = realStreams;
            }
        });

        // 触发换源检查
        scheduleSourceCheck();
    }

    function handleDetailResponse(json) {
        if (!json || !json.data) return;
        const info = Array.isArray(json.data.info) && json.data.info[0] ? json.data.info[0] : json.data;
        if (info && (info.title || info.name || info.videoName)) {
            currentVideoTitle = cleanTitle(info.title || info.name || info.videoName);
            console.log(`${TAG} 捕获当前影视剧名: ${currentVideoTitle}`);
            scheduleSourceCheck();
        }
    }

    // 劫持 XMLHttpRequest
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
            const isPlayApi = url.includes('video/play') || url.includes('video-media');
            const isDetailApi = url.includes('video/detail');

            if (isPlayApi || isDetailApi) {
                this.addEventListener('load', () => {
                    try {
                        const json = JSON.parse(this.responseText);
                        if (isPlayApi) handlePlayResponse(json);
                        if (isDetailApi) handleDetailResponse(json);
                    } catch (e) {}
                });
            }
            return origSend.apply(this, args);
        };
    } catch (e) {}

    // 劫持 fetch
    try {
        const origFetch = win.fetch;
        if (typeof origFetch === 'function') {
            win.fetch = async function (...args) {
                const res = await origFetch.apply(this, args);
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                if (url.includes('video/play') || url.includes('video-media') || url.includes('video/detail')) {
                    try {
                        const clone = res.clone();
                        const json = await clone.json();
                        if (url.includes('video/detail')) handleDetailResponse(json);
                        else handlePlayResponse(json);
                    } catch (e) {}
                }
                return res;
            };
        }
    } catch (e) {}

    // =========================================================================
    // 2. 剧名清洗与 DOM 智能兜底嗅探
    // =========================================================================
    function cleanTitle(raw) {
        if (!raw) return '';
        return raw
            .replace(/-\s*爱壹帆.*/i, '')
            .replace(/_爱壹帆.*/i, '')
            .replace(/第\s*\d+\s*[集话期].*/i, '')
            .replace(/更新至.*/i, '')
            .replace(/HD|BD|4K|1080P/gi, '')
            .replace(/[\[\(【（].*?[\]\)】）]/g, '')
            .trim();
    }

    function detectVideoInfoFromDOM() {
        if (!currentVideoTitle) {
            const titleEl = document.querySelector('.title, .video-name, .n-media-title, h1');
            if (titleEl && titleEl.textContent) {
                currentVideoTitle = cleanTitle(titleEl.textContent);
            } else if (document.title) {
                currentVideoTitle = cleanTitle(document.title);
            }
        }
        if (!currentEpisodeNum) {
            const activeEp = document.querySelector('.player-media-list .active, .episode-item.active, .ep-item.active');
            if (activeEp && activeEp.textContent) {
                const m = activeEp.textContent.match(/\d+/);
                if (m) currentEpisodeNum = m[0];
            } else {
                const m = document.title.match(/第\s*(\d+)\s*[集话期]/);
                if (m) currentEpisodeNum = m[1];
            }
        }
    }

    // =========================================================================
    // 3. 第三方影视源检索 API 模块 (支持跨域请求 GM_xmlhttpRequest)
    // =========================================================================
    function requestApi(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 6000,
                    onload: res => {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch (e) {
                            reject(e);
                        }
                    },
                    onerror: err => reject(err),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            } else {
                // 原生 fetch 兜底
                fetch(url)
                    .then(r => r.json())
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    // 检索所有线路中匹配当前剧集的高清 m3u8
    async function searchHighDefinitionStreams(title, targetEpNum) {
        if (!title) return null;
        console.log(`${TAG} 开始多源检索: 剧名 = [${title}], 目标集数 = [${targetEpNum || 1}]`);

        const matchedSources = [];

        for (const src of SOURCES) {
            try {
                const data = await requestApi(src.api + encodeURIComponent(title));
                if (!data || !data.list || !data.list.length) continue;

                // 在返回的列表中寻找最贴近的影片
                const matchedVod = data.list.find(vod => {
                    const vName = cleanTitle(vod.vod_name);
                    return vName.includes(title) || title.includes(vName);
                }) || data.list[0];

                if (!matchedVod || !matchedVod.vod_play_url) continue;

                // 解析播放地址列表
                // 格式如: 第01集$http://xxx.m3u8#第02集$http://yyy.m3u8$$$线路2
                const parsedPlaylists = [];
                const groups = matchedVod.vod_play_url.split('$$$');

                for (const g of groups) {
                    const epList = [];
                    const eps = g.split('#');
                    for (const ep of eps) {
                        const parts = ep.split('$');
                        if (parts.length >= 2 && parts[1].includes('.m3u8')) {
                            const nameStr = parts[0];
                            const numMatch = nameStr.match(/\d+/);
                            const num = numMatch ? numMatch[0] : '';
                            epList.push({
                                raw: ep,
                                title: nameStr,
                                num: num,
                                url: parts[1].trim()
                            });
                        }
                    }
                    if (epList.length > 0) parsedPlaylists.push(epList);
                }

                if (parsedPlaylists.length > 0) {
                    // 取包含最多集数的一组
                    parsedPlaylists.sort((a, b) => b.length - a.length);
                    const bestList = parsedPlaylists[0];

                    matchedSources.push({
                        sourceId: src.id,
                        sourceName: src.name,
                        vodName: matchedVod.vod_name,
                        episodes: bestList
                    });
                }
            } catch (err) {
                console.warn(`${TAG} 线路 [${src.name}] 检索失败:`, err);
            }
        }

        return matchedSources;
    }

    // =========================================================================
    // 4. UI 界面注入：浮动换源按钮与真 1080P 高清播放层
    // =========================================================================
    function injectUI() {
        if (document.getElementById('yfsp-hd-toolbar')) return;

        // 查找播放器容器
        const video = document.querySelector('video');
        const playerContainer = video ? (video.closest('.aa-videoplayer-wrap, .video-player, .video-box') || video.parentElement) : null;
        if (!playerContainer) return;

        // 确保容器为相对定位
        const computedPos = window.getComputedStyle(playerContainer).position;
        if (computedPos === 'static') {
            playerContainer.style.position = 'relative';
        }

        // 1. 创建浮动控制工具条
        const toolbar = document.createElement('div');
        toolbar.id = 'yfsp-hd-toolbar';
        toolbar.className = 'yfsp-hd-toolbar';
        toolbar.innerHTML = `
            <button id="yfsp-hd-toggle-btn" class="yfsp-hd-btn">
                <span class="hd-icon">⚡</span>
                <span class="hd-text">切换真 1080P 蓝光</span>
            </button>
        `;
        playerContainer.appendChild(toolbar);

        // 2. 创建 1080P 独立播放器遮罩层
        let overlay = document.getElementById('yfsp-hd-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'yfsp-hd-overlay';
            overlay.className = 'yfsp-hd-overlay';
            overlay.style.display = 'none';
            overlay.innerHTML = `
                <div class="yfsp-hd-header">
                    <div class="yfsp-hd-info">
                        <span class="yfsp-hd-badge">1080P 极清</span>
                        <span id="yfsp-hd-title-text" class="yfsp-hd-title">加载中...</span>
                    </div>
                    <div class="yfsp-hd-actions">
                        <select id="yfsp-hd-source-select" class="yfsp-hd-select"></select>
                        <button id="yfsp-hd-close-btn" class="yfsp-hd-close" title="返回爱壹帆原版">✕ 返回原版(576P)</button>
                    </div>
                </div>
                <div id="yfsp-artplayer-container" class="yfsp-artplayer-container"></div>
            `;
            playerContainer.appendChild(overlay);

            // 绑定关闭按钮
            document.getElementById('yfsp-hd-close-btn').addEventListener('click', deactivateHdPlayer);

            // 绑定线路切换
            document.getElementById('yfsp-hd-source-select').addEventListener('change', (e) => {
                selectedSourceIndex = parseInt(e.target.value) || 0;
                playCurrentEpisodeInHd();
            });
        }

        // 绑定切换按钮
        document.getElementById('yfsp-hd-toggle-btn').addEventListener('click', () => {
            if (isHdActive) {
                deactivateHdPlayer();
            } else {
                activateHdPlayer();
            }
        });
    }

    // 激活真 1080P 播放器
    async function activateHdPlayer() {
        const overlay = document.getElementById('yfsp-hd-overlay');
        const toggleBtn = document.getElementById('yfsp-hd-toggle-btn');
        if (!overlay) return;

        isHdActive = true;
        overlay.style.display = 'flex';
        if (toggleBtn) toggleBtn.classList.add('active');

        // 暂停爱壹帆原生视频
        const nativeVideo = document.querySelector('video:not(.artplayer-video)');
        if (nativeVideo) nativeVideo.pause();

        showToast('正在为您调取 1080P 蓝光无损片源...');

        // 嗅探信息并检索
        detectVideoInfoFromDOM();
        const titleText = document.getElementById('yfsp-hd-title-text');
        if (titleText) {
            titleText.textContent = `${currentVideoTitle || '当前剧集'} (第 ${currentEpisodeNum || '1'} 集)`;
        }

        const matchedSources = await searchHighDefinitionStreams(currentVideoTitle, currentEpisodeNum);
        if (!matchedSources || matchedSources.length === 0) {
            showToast('⚠️ 未能在高清库中找到该片源，已切回原版');
            deactivateHdPlayer();
            return;
        }

        currentMatchedList = matchedSources;
        selectedSourceIndex = 0;

        // 填充线路下拉框
        const select = document.getElementById('yfsp-hd-source-select');
        if (select) {
            select.innerHTML = matchedSources.map((s, idx) => `
                <option value="${idx}">${s.sourceName}</option>
            `).join('');
        }

        // 开始播放
        playCurrentEpisodeInHd();
    }

    // 播放当前集数的 1080P 流
    function playCurrentEpisodeInHd() {
        if (!currentMatchedList || !currentMatchedList.length) return;
        const currentSource = currentMatchedList[selectedSourceIndex] || currentMatchedList[0];

        // 寻找匹配的集数
        const epNum = currentEpisodeNum || '1';
        let matchedEp = currentSource.episodes.find(e => e.num === String(epNum));
        if (!matchedEp && currentSource.episodes.length > 0) {
            // 如果单集编号没对上，尝试按索引匹配
            const idx = parseInt(epNum) - 1;
            matchedEp = currentSource.episodes[idx] || currentSource.episodes[0];
        }

        if (!matchedEp) {
            showToast('未找到当前集数的高清切片');
            return;
        }

        console.log(`${TAG} 加载 1080P 切片流: [${currentSource.sourceName}] ${matchedEp.title} -> ${matchedEp.url}`);
        showToast(`已成功切换: ${currentSource.sourceName} (真1080P)`);

        renderArtplayer(matchedEp.url);
    }

    // 退出 1080P 播放器
    function deactivateHdPlayer() {
        const overlay = document.getElementById('yfsp-hd-overlay');
        const toggleBtn = document.getElementById('yfsp-hd-toggle-btn');
        if (overlay) overlay.style.display = 'none';
        if (toggleBtn) toggleBtn.classList.remove('active');
        isHdActive = false;

        if (artInstance) {
            artInstance.pause();
        }

        // 恢复爱壹帆原生播放
        const nativeVideo = document.querySelector('video:not(.artplayer-video)');
        if (nativeVideo) nativeVideo.play();
    }

    // =========================================================================
    // 5. 渲染全功能现代播放器 (Artplayer + HLS.js)
    // =========================================================================
    function renderArtplayer(m3u8Url) {
        const container = document.getElementById('yfsp-artplayer-container');
        if (!container) return;

        // 销毁旧实例
        if (artInstance) {
            try { artInstance.destroy(); } catch (e) {}
            artInstance = null;
        }

        if (typeof Artplayer === 'undefined') {
            console.error(`${TAG} Artplayer 尚未加载完成，尝试使用原生 Hls 渲染`);
            container.innerHTML = `<video src="${m3u8Url}" controls autoplay style="width:100%;height:100%;background:#000;"></video>`;
            return;
        }

        artInstance = new Artplayer({
            container: container,
            url: m3u8Url,
            type: 'm3u8',
            customType: {
                m3u8: function (video, url, art) {
                    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                        if (art.hls) art.hls.destroy();
                        const hls = new Hls({
                            enableWorker: true,
                            lowLatencyMode: true
                        });
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        art.hls = hls;
                        art.on('destroy', () => hls.destroy());
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    } else {
                        art.notice.show = '浏览器不支持播放该格式视频';
                    }
                }
            },
            theme: '#ffb400',
            autoplay: true,
            autoSize: true,
            autoMini: false,
            loop: false,
            playbackRate: true,
            aspectRatio: true,
            setting: true,
            hotkey: true,
            pip: true,
            fullscreen: true,
            fullscreenWeb: true,
            miniProgressBar: true,
            mutex: true,
            backdrop: true,
            playsInline: true,
            autoPlayback: true,
            airplay: true
        });

        artInstance.on('ready', () => {
            console.log(`${TAG} 1080P Artplayer 播放器初始化就绪`);
        });
    }

    // =========================================================================
    // 6. 状态轮询与路由监听 (支持剧集点击联动更新)
    // =========================================================================
    let lastUrl = location.href;
    let lastEp = '';

    function scheduleSourceCheck() {
        detectVideoInfoFromDOM();
        injectUI();
        if (isHdActive && currentEpisodeNum && currentEpisodeNum !== lastEp) {
            lastEp = currentEpisodeNum;
            playCurrentEpisodeInHd();
        }
    }

    setInterval(() => {
        // 监听页面 URL 变动 (SPA 选集跳转)
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            currentEpisodeNum = '';
            setTimeout(scheduleSourceCheck, 600);
        }
        detectVideoInfoFromDOM();
        injectUI();
    }, 1000);

    // =========================================================================
    // 7. 样式注入
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('yfsp-hd-style')) return;
        const style = document.createElement('style');
        style.id = 'yfsp-hd-style';
        style.textContent = `
            /* 换源工具按钮 */
            .yfsp-hd-toolbar {
                position: absolute;
                top: 16px;
                right: 20px;
                z-index: 1000;
                pointer-events: auto;
            }
            .yfsp-hd-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                background: linear-gradient(135deg, rgba(255, 180, 0, 0.95), rgba(255, 136, 0, 0.95));
                color: #121216;
                font-weight: 700;
                font-size: 13px;
                border: none;
                outline: none;
                padding: 7px 15px;
                border-radius: 20px;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(255, 180, 0, 0.35);
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .yfsp-hd-btn:hover {
                transform: translateY(-2px) scale(1.03);
                box-shadow: 0 6px 20px rgba(255, 180, 0, 0.55);
            }
            .yfsp-hd-btn.active {
                background: rgba(30, 30, 42, 0.85);
                color: #ffb400;
                border: 1px solid rgba(255, 180, 0, 0.5);
                box-shadow: none;
            }

            /* 1080P 遮罩播放层 */
            .yfsp-hd-overlay {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                background: #000;
                z-index: 999;
                display: flex;
                flex-direction: column;
            }
            .yfsp-hd-header {
                height: 48px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.85), transparent);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 20px;
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                z-index: 10;
                color: #fff;
            }
            .yfsp-hd-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .yfsp-hd-badge {
                background: #ffb400;
                color: #000;
                font-size: 11px;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .yfsp-hd-title {
                font-size: 14px;
                font-weight: 600;
                color: #f1f1f1;
            }
            .yfsp-hd-actions {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .yfsp-hd-select {
                background: rgba(255, 255, 255, 0.15);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                outline: none;
                cursor: pointer;
            }
            .yfsp-hd-select option {
                background: #1e1e24;
                color: #fff;
            }
            .yfsp-hd-close {
                background: rgba(255, 255, 255, 0.12);
                color: #eee;
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .yfsp-hd-close:hover {
                background: rgba(255, 77, 79, 0.85);
                color: #fff;
                border-color: transparent;
            }
            .yfsp-artplayer-container {
                flex: 1;
                width: 100%;
                height: 100%;
            }

            /* 提示 Toast */
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
        }, 3200);
    }

    // 初始化样式注入
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

})();
