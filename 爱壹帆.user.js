// ==UserScript==
// @name         爱壹帆 1080P 高清换源播放
// @namespace    https://github.com/Niklaus88/UserScript
// @version      2.6.9
// @description  为爱壹帆（yfsp.tv）接入第三方真·1080P/4K蓝光切片源，同步引入555电影专属高速蓝光集群与低端影视专属1080P/新浪极清线路，一键切换极清画质，免除VIP限制，深度净网去广告，全源接入Hls音频断点抗失真锁音引擎并完美定位UP主关注卡片，支持多线路自由切换与进度无缝同步
// @author       Don E.Knuth
// @match        https://www.yfsp.tv/*
// @match        https://yfsp.tv/*
// @icon         https://www.yfsp.tv/favicon.ico
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      555k06.com
// @connect      55dy60.com
// @connect      555dy.net
// @connect      ddys.io
// @connect      ddys.one
// @connect      xluuss.com
// @connect      gsuus.com
// @connect      fengbao13.com
// @connect      v.fengbao14.com
// @connect      bfzyapi.com
// @connect      suoniapi.com
// @connect      hhzyapi.com
// @connect      subocaiji.com
// @connect      cj.lziapi.com
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js
// @require      https://cdn.jsdelivr.net/npm/artplayer@5.1.7/dist/artplayer.legacy.js
// ==/UserScript==

(function () {
    'use strict';
    /* global Artplayer, Hls */

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const TAG = '[爱壹帆1080P换源]';

    console.log(`${TAG} 脚本已启动 (v2.6.9) - 深度净网去广告与多线路极清集群就绪`);

    // 深度去广告：清理爱壹帆在本地存储中残留的广告横幅配置
    try {
        localStorage.removeItem('ggs_20xx');
        localStorage.removeItem('ggs');
    } catch (e) {}

    // =========================================================================
    // 0. 线路配置 (支持多源自动容灾检索)
    // =========================================================================
    const SOURCES = [
        { id: 'bfzy', name: '暴风线路 (1080P极清)', api: 'https://bfzyapi.com/api.php/provide/vod/?ac=detail&wd=' },
        { id: 'subo', name: '速播线路 (1080P高清)', api: 'https://subocaiji.com/api.php/provide/vod/?ac=detail&wd=' },
        { id: 'hhzy', name: '红牛线路 (1080P高清)', api: 'https://hhzyapi.com/api.php/provide/vod/?ac=detail&wd=' },
        { id: 'lzi', name: '量子线路 (备用高清)', api: 'https://cj.lziapi.com/api.php/provide/vod/?ac=detail&wd=' }
    ];

    // 全局当前状态
    let currentVideoTitle = '';
    let currentEpisodeNum = '1';
    let artInstance = null;
    let isHdActive = false;
    let currentMatchedList = [];
    let selectedSourceIndex = 0;
    let lastProgressTime = 0; // 进度记忆与无缝同步

    // =========================================================================
    // 1. 数据拦截：从后端请求中捕获剧名、集数 + 深度剔除官方片头及暂停广告
    // =========================================================================
    function handlePlayResponse(json) {
        if (!json || !json.data) return false;
        const items = Array.isArray(json.data.info) ? json.data.info :
                      Array.isArray(json.data) ? json.data : null;
        if (!items || !items.length) return false;

        let modified = false;
        items.forEach(info => {
            if (!info || typeof info !== 'object') return;

            if (info.mediaTitle) {
                const epMatch = String(info.mediaTitle).match(/\d+/);
                if (epMatch) {
                    currentEpisodeNum = String(parseInt(epMatch[0], 10));
                    console.log(`${TAG} 接口捕获当前播放集数: 第 ${currentEpisodeNum} 集`);
                }
            }

            // 彻底抹除所有广告配置与流切片
            info.needLogin = false;
            info.isLimitStream = false;
            info.isLimitedStream = false;
            info.isUserFilterAd = true; // 关键：免广告白名单
            info.maxFrontAds = 0; // 关键：片头广告数置 0
            if (Array.isArray(info.startData)) info.startData = [];
            if (Array.isArray(info.pauseData)) info.pauseData = [];

            // 过滤 flvPathList 中的所有广告切片 (带有 link 推广跳转或 duration>0 的推广分片)
            if (Array.isArray(info.flvPathList)) {
                const realStreams = info.flvPathList.filter(item => !item.link && (!item.duration || item.duration === 0));
                if (realStreams.length > 0) {
                    info.flvPathList = realStreams;
                } else {
                    info.flvPathList = info.flvPathList.filter(item => !item.link);
                }
            }
            modified = true;
        });

        scheduleRefresh();
        return modified;
    }

    function handleDetailResponse(json) {
        if (!json || !json.data) return;
        const info = Array.isArray(json.data.info) && json.data.info[0] ? json.data.info[0] : json.data;
        if (info && (info.title || info.name || info.videoName)) {
            const raw = info.title || info.name || info.videoName;
            const parsed = parseTitleAndEp(raw);
            if (parsed.title) currentVideoTitle = parsed.title;
            if (parsed.ep) currentEpisodeNum = parsed.ep;
            console.log(`${TAG} 接口捕获剧名: [${currentVideoTitle}], 集数: [${currentEpisodeNum}]`);
            scheduleRefresh();
        }
    }

    // 劫持 XHR (改写底层 responseText/response 确保前端不播放广告)
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
            const isGgApi = url.includes('/play/o') || url.includes('play/o') || url.includes('get-gg-block-content');

            if (isGgApi) {
                // 彻底拦截右侧边栏与页面全局推广广告接口，直接响应空广告列表
                const emptyGg = JSON.stringify({ systime: `/Date(${Date.now()})/`, data: [], country: "US", regionId: 4 });
                Object.defineProperty(this, 'responseText', {
                    get() { return emptyGg; },
                    configurable: true
                });
                Object.defineProperty(this, 'response', {
                    get() { return emptyGg; },
                    configurable: true
                });
            } else if (isPlayApi || isDetailApi) {
                let patchedText = null;

                const getPatchedResponse = (raw) => {
                    if (patchedText !== null) return patchedText;
                    if (typeof raw !== 'string' || !raw) return raw;

                    try {
                        const json = JSON.parse(raw);
                        if (isDetailApi) {
                            handleDetailResponse(json);
                        }
                        if (isPlayApi) {
                            if (handlePlayResponse(json)) {
                                patchedText = JSON.stringify(json);
                                return patchedText;
                            }
                        }
                    } catch (e) {}
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
    } catch (e) {}

    // 劫持 Fetch
    try {
        const origFetch = win.fetch;
        if (typeof origFetch === 'function') {
            win.fetch = async function (...args) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                const isPlayApi = url.includes('video/play') || url.includes('video-media');
                const isDetailApi = url.includes('video/detail');
                const isGgApi = url.includes('/play/o') || url.includes('play/o') || url.includes('get-gg-block-content');

                if (isGgApi) {
                    const emptyGg = JSON.stringify({ systime: `/Date(${Date.now()})/`, data: [], country: "US", regionId: 4 });
                    return new Response(emptyGg, {
                        status: 200,
                        statusText: 'OK',
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const res = await origFetch.apply(this, args);

                if (isPlayApi || isDetailApi) {
                    try {
                        const clone = res.clone();
                        const json = await clone.json();
                        if (isDetailApi) handleDetailResponse(json);
                        if (isPlayApi && handlePlayResponse(json)) {
                            return new Response(JSON.stringify(json), {
                                status: res.status,
                                statusText: res.statusText,
                                headers: res.headers
                            });
                        }
                    } catch (e) {}
                }
                return res;
            };
        }
    } catch (e) {}

    // =========================================================================
    // 2. 剧名与集数精准提取算法 + 关键词泛化生成
    // =========================================================================
    function parseTitleAndEp(raw) {
        if (!raw) return { title: '', ep: '1' };
        let text = raw
            .replace(/-\s*爱壹帆.*/i, '')
            .replace(/_爱壹帆.*/i, '')
            .replace(/在线观看.*/i, '')
            .replace(/HD|BD|4K|1080P/gi, '')
            .replace(/[\[\(【（].*?[\]\)】）]/g, '')
            .trim();

        let ep = '';
        // 模式 1: "第xx集 / 第xx话 / 第xx期"
        const m1 = text.match(/第\s*(\d+)\s*[集话期]/);
        if (m1) {
            ep = m1[1];
            text = text.replace(/第\s*\d+\s*[集话期].*/, '').trim();
        } else {
            // 模式 2: 末尾空格加数字，如 "沧元图 01"、"凡人修仙传 196"
            const m2 = text.match(/(?:^|\s+|_)(\d{1,4})$/);
            if (m2) {
                ep = m2[1];
                text = text.replace(/(?:^|\s+|_)\d{1,4}$/, '').trim();
            }
        }

        return {
            title: text.replace(/[\s\-:_—·：]+$/, '').trim(),
            ep: ep ? String(parseInt(ep, 10)) : ''
        };
    }

    function generateKeywords(raw) {
        if (!raw) return [];
        let text = raw
            .replace(/-\s*爱壹帆.*/i, '')
            .replace(/_爱壹帆.*/i, '')
            .replace(/在线观看.*/i, '')
            .replace(/HD|BD|4K|1080P/gi, '')
            .replace(/[\[\(【（].*?[\]\)】）]/g, '')
            .replace(/第\s*\d+\s*[集话期].*/, '')
            .replace(/(?:^|\s+|_)0*\d{1,4}$/, '')
            .replace(/[\s\-:_—·：]+$/, '')
            .trim();

        const list = [];
        if (text) list.push(text);

        // 移除 "第x季 / 第x部 / 第x篇"
        const noSeason = text.replace(/第\s*[一二三四五六七八九十\d]+\s*[季部篇章]/g, '').replace(/[\s\-:_—·：]+$/, '').trim();
        if (noSeason && !list.includes(noSeason)) list.push(noSeason);

        // 替换冒号与分隔符为空格
        const clean = text.replace(/[:：·\-_—]/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean && !list.includes(clean)) list.push(clean);

        const cleanNoSeason = noSeason.replace(/[:：·\-_—]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanNoSeason && !list.includes(cleanNoSeason)) list.push(cleanNoSeason);

        return list.filter(k => k.length >= 2);
    }

    function detectVideoInfoFromDOM() {
        // 1. 抓取剧名
        if (!currentVideoTitle) {
            const titleEl = document.querySelector('.title, .video-name, .n-media-title, h1');
            const raw = titleEl ? titleEl.textContent : document.title;
            const parsed = parseTitleAndEp(raw);
            if (parsed.title) currentVideoTitle = parsed.title;
            if (parsed.ep && (!currentEpisodeNum || currentEpisodeNum === '1')) currentEpisodeNum = parsed.ep;
        }

        // 2. 抓取集数
        const activeEp = document.querySelector('.player-media-list .active, .episode-item.active, .ep-item.active');
        if (activeEp && activeEp.textContent) {
            const m = activeEp.textContent.match(/\d+/);
            if (m) currentEpisodeNum = String(parseInt(m[0], 10));
        }
    }

    // =========================================================================
    // 3. 第三方影视源检索：555电影专属集群 + 低端影视专属1080P/新浪极清 + 官方独立切片源
    // =========================================================================
    function getRefererForUrl(url) {
        if (url.includes('ddys.one')) return 'https://ddys.one/';
        if (url.includes('ddys.io')) return 'https://ddys.io/';
        return 'https://555k06.com/';
    }

    function requestText(url, headers = {}) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 7000,
                    headers: Object.assign({
                        'Referer': getRefererForUrl(url),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                    }, headers),
                    onload: res => resolve(res.responseText || ''),
                    onerror: err => reject(err),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            } else {
                fetch(url).then(r => r.text()).then(resolve).catch(reject);
            }
        });
    }

    function requestApi(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 7000,
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
                fetch(url)
                    .then(r => r.json())
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    function normalizeM3u8Url(url) {
        if (!url) return '';
        url = url.trim();
        if (url.includes('.m3u8')) return url;
        if (url.includes('xluuss.com') || url.includes('hhuus.com') || url.includes('bfllvip.com')) {
            return url.replace(/\/+$/, '') + '/index.m3u8';
        }
        return url;
    }

    // 快速探活切片流是否真实可用（非404/403/HTML报错）
    function checkStreamPlayable(url) {
        return new Promise(resolve => {
            if (!url) return resolve(false);
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Range': 'bytes=0-100',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 2000,
                    onload: res => {
                        const ct = (res.responseHeaders || '').toLowerCase();
                        const isHtml = ct.includes('content-type: text/html');
                        const isSuccess = res.status >= 200 && res.status < 400 && !isHtml;
                        resolve(isSuccess);
                    },
                    onerror: () => resolve(false),
                    ontimeout: () => resolve(false)
                });
            } else {
                resolve(true);
            }
        });
    }

    // 核心：深度解析 555 电影的全部多线路与切片列表
    async function search555Lines(keywords) {
        const host = 'https://555k06.com';
        let vodId = null;
        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/vodsearch/-------------.html?wd=${encodeURIComponent(kw)}`);
                const m = searchHtml.match(/\/voddetail\/(\d+)\.html/);
                if (m) {
                    vodId = m[1];
                    console.log(`${TAG} 555匹配影片ID: ${vodId} (关键词: ${kw})`);
                    break;
                }
            } catch (e) {}
        }
        if (!vodId) return [];

        try {
            const detailHtml = await requestText(`${host}/voddetail/${vodId}.html`);
            const tabNames = [];
            const reTab = /data-dropdown-value="([^"]+)"/g;
            let tm;
            while ((tm = reTab.exec(detailHtml)) !== null) {
                tabNames.push(tm[1].trim());
            }

            const reList = /<div[^>]*class="[^"]*module-play-list[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
            let lm;
            let idx = 0;
            const lines = [];

            while ((lm = reList.exec(detailHtml)) !== null && idx < tabNames.length) {
                const lineName = tabNames[idx];
                const reEp = /href="(\/vodplay\/\d+-\d+-\d+\.html)"[^>]*><span>([^<]+)<\/span>/g;
                let em;
                const eps = [];
                while ((em = reEp.exec(lm[0])) !== null) {
                    const epTitle = em[2].trim();
                    const numMatch = epTitle.match(/\d+/);
                    const num = numMatch ? String(parseInt(numMatch[0], 10)) : '';
                    eps.push({
                        title: epTitle,
                        num: num,
                        playLink: em[1],
                        url: '' // 懒加载切片地址
                    });
                }

                // 过滤异常线路：排除底层存在严重切片缺陷的“极速蓝光-ws”（全片内含250多处硬插断点导致声卡时钟累积漂移失真，且画质仅720P），同时保留集数>=2的有效线路
                const cleanName = lineName.replace(/\s+/g, '').toLowerCase();
                const isProblematic = cleanName === '极速蓝光-ws';
                if (eps.length >= 2 && !isProblematic) {
                    lines.push({
                        sourceId: `555_${idx}`,
                        sourceName: `555·${lineName}`,
                        is555: true,
                        episodes: eps
                    });
                }
                idx++;
            }
            return lines;
        } catch (err) {
            console.warn(`${TAG} 555多线路解析失败:`, err);
            return [];
        }
    }

    // 核心：深度解析低端影视 (DDYS) 专属极清「播放源 2 (1080P)」
    async function searchDDYSLine(keywords) {
        const host = 'https://ddys.io';
        let moviePath = null;
        let matchedTitle = '';

        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/search?q=${encodeURIComponent(kw)}`);
                const h3Regex = /<h3[^>]*>[\s\S]*?<a\s+href="(\/movie\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi;
                let m;
                while ((m = h3Regex.exec(searchHtml)) !== null) {
                    const link = m[1];
                    const title = m[2].replace(/<[^>]+>/g, '').trim();
                    if (title === kw || title.includes(kw) || kw.includes(title)) {
                        moviePath = link;
                        matchedTitle = title;
                        break;
                    }
                    if (!moviePath) {
                        moviePath = link;
                        matchedTitle = title;
                    }
                }
                if (moviePath) {
                    console.log(`${TAG} DDYS匹配影视: ${matchedTitle} (${moviePath}), 关键词: ${kw}`);
                    break;
                }
            } catch (e) {}
        }

        if (!moviePath) return null;

        try {
            const detailHtml = await requestText(`${host}${moviePath}`);
            const btnRegex = /<button[^>]*onclick="switchSource\(\d+,\s*'([^']+)',\s*'m3u8'\)"[^>]*>([\s\S]*?)<\/button>/gi;
            let bm;
            let source2Data = null;

            while ((bm = btnRegex.exec(detailHtml)) !== null) {
                const rawPlaylist = bm[1];
                const btnText = bm[2].replace(/<[^>]+>/g, '').trim();
                // 仅筛选用户指定的高质量「播放源 2 (1080P)」，忽略其他低质或卡顿源
                if (btnText.includes('播放源 2') || btnText.includes('播放源2')) {
                    source2Data = { rawPlaylist, btnText };
                    break;
                }
            }

            if (!source2Data) {
                console.log(`${TAG} DDYS影片《${matchedTitle}》未包含「播放源 2 (1080P)」`);
                return null;
            }

            const eps = [];
            const items = source2Data.rawPlaylist.split('#');
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const parts = item.split('$');
                if (parts.length >= 2) {
                    const epTitle = parts[0].trim();
                    const numMatch = epTitle.match(/\d+/);
                    const num = numMatch ? String(parseInt(numMatch[0], 10)) : String(i + 1);
                    eps.push({
                        title: epTitle,
                        num: num,
                        url: normalizeM3u8Url(parts[1])
                    });
                } else if (parts.length === 1 && parts[0].trim().startsWith('http')) {
                    eps.push({
                        title: `第${i + 1}集`,
                        num: String(i + 1),
                        url: normalizeM3u8Url(parts[0])
                    });
                }
            }

            if (eps.length === 0) return null;

            return {
                sourceId: 'ddys_source2',
                sourceName: 'DDYS·播放源2 (1080P)',
                is555: false,
                vodName: matchedTitle,
                episodes: eps
            };
        } catch (err) {
            console.warn(`${TAG} DDYS多线路解析失败:`, err);
            return null;
        }
    }

    // 核心：深度解析低端影视 DDrk 架构 (ddys.one) 专属极清「X节点 (新浪1080P)」
    async function searchDDYSOneLine(keywords) {
        const host = 'https://ddys.one';
        let vodPath = null;
        let vodTitle = '';

        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/?s=${encodeURIComponent(kw)}&post_type=post`, {
                    'Referer': 'https://ddys.one/'
                });
                const m = searchHtml.match(/<a\s+href="(\/vod\/\d+\/)"\s+rel="bookmark">([^<]+)<\/a>/i);
                if (m) {
                    vodPath = m[1];
                    vodTitle = m[2].trim();
                    console.log(`${TAG} DDYS.one匹配影片: ${vodTitle} (${vodPath}), 关键词: ${kw}`);
                    break;
                }
            } catch (e) {}
        }

        if (!vodPath) return null;

        try {
            const vodIdMatch = vodPath.match(/\d+/);
            if (!vodIdMatch) return null;
            const vodId = vodIdMatch[0];

            const detailHtml = await requestText(`${host}${vodPath}`, {
                'Referer': 'https://ddys.one/'
            });

            const epMatches = [...detailHtml.matchAll(/<div class="wp-playlist-item"[^>]*ep_slug="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi)];
            if (!epMatches || epMatches.length === 0) return null;

            const eps = [];
            for (let i = 0; i < epMatches.length; i++) {
                const em = epMatches[i];
                const slug = em[1];
                const rawTitle = em[2].replace(/<[^>]+>/g, '').trim();
                const numMatch = rawTitle.match(/\d+/);
                const num = numMatch ? String(parseInt(numMatch[0], 10)) : String(i + 1);
                eps.push({
                    title: rawTitle,
                    num: num,
                    slug: slug,
                    vodId: vodId,
                    url: ''
                });
            }

            // 按集数升序排列方便顺序定位
            eps.sort((a, b) => {
                const na = parseInt(a.num, 10);
                const nb = parseInt(b.num, 10);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return 0;
            });

            return {
                sourceId: 'ddys_one_xlzy',
                sourceName: 'DDYS·X节点 (新浪1080P)',
                is555: false,
                isDDYSOne: true,
                vodName: vodTitle,
                episodes: eps
            };
        } catch (err) {
            console.warn(`${TAG} DDYS.one详情解析异常:`, err);
            return null;
        }
    }

    async function searchHighDefinitionStreams(title) {
        if (!title) return [];
        const keywords = generateKeywords(title);
        console.log(`${TAG} 正在全网检索 1080P 片源，候选词:`, keywords);

        const matchedSources = [];

        // 1. 优先拉取 555 电影的专属高速线路集群 (多达 6~10 条全网高质量线路)
        try {
            const lines555 = await search555Lines(keywords);
            if (lines555 && lines555.length > 0) {
                matchedSources.push(...lines555);
                console.log(`${TAG} 成功载入 555 电影专属线路: ${lines555.length} 条`);
            }
        } catch (e) {}

        // 2. 检索并接入低端影视 (DDYS.io) 专属「播放源 2 (1080P)」
        try {
            const ddysLine = await searchDDYSLine(keywords);
            if (ddysLine) {
                matchedSources.push(ddysLine);
                console.log(`${TAG} 成功载入低端影视专属线路: ${ddysLine.sourceName} (${ddysLine.episodes.length} 集)`);
            }
        } catch (e) {}

        // 3. 检索并接入低端影视 DDrk (DDYS.one) 专属「X节点 (新浪1080P)」
        try {
            const ddysOneLine = await searchDDYSOneLine(keywords);
            if (ddysOneLine) {
                matchedSources.push(ddysOneLine);
                console.log(`${TAG} 成功载入低端影视DDrk专属线路: ${ddysOneLine.sourceName} (${ddysOneLine.episodes.length} 集)`);
            }
        } catch (e) {}

        // 4. 同时检索官方独立采集站直连线路作为多重容灾保障
        for (const kw of keywords) {
            for (const src of SOURCES) {
                // 如果该独立源已添加，跳过
                if (matchedSources.some(s => s.sourceId === src.id)) continue;

                try {
                    const data = await requestApi(src.api + encodeURIComponent(kw));
                    if (!data || !data.list || !data.list.length) continue;

                    const matchedVod = data.list.find(vod => {
                        const vName = parseTitleAndEp(vod.vod_name).title;
                        return vName === kw || vName.includes(kw) || kw.includes(vName);
                    }) || data.list[0];

                    if (!matchedVod || !matchedVod.vod_play_url) continue;

                    const groups = matchedVod.vod_play_url.split('$$$');
                    const parsedPlaylists = [];

                    for (const g of groups) {
                        const epList = [];
                        const eps = g.split('#');
                        for (const ep of eps) {
                            const parts = ep.split('$');
                            if (parts.length >= 2) {
                                const nameStr = parts[0];
                                const numMatch = nameStr.match(/\d+/);
                                const num = numMatch ? String(parseInt(numMatch[0], 10)) : '';
                                epList.push({
                                    title: nameStr,
                                    num: num,
                                    url: normalizeM3u8Url(parts[1])
                                });
                            }
                        }
                        if (epList.length > 0) parsedPlaylists.push(epList);
                    }

                    if (parsedPlaylists.length > 0) {
                        parsedPlaylists.sort((a, b) => b.length - a.length);
                        matchedSources.push({
                            sourceId: src.id,
                            sourceName: src.name,
                            is555: false,
                            vodName: matchedVod.vod_name,
                            episodes: parsedPlaylists[0]
                        });
                    }
                } catch (err) {}
            }
        }

        return matchedSources;
    }

    // =========================================================================
    // 4. 定位爱壹帆视频播放容器 (getBoundingClientRect 准确定位)
    // =========================================================================
    function findVideoContainer() {
        const video = document.querySelector('video:not(.artplayer-video):not(.yfsp-custom-video)');
        if (!video) return null;

        // 尝试寻找带有播放器特征的容器
        let container = video.closest('.publicplay, .video-player, .aa-videoplayer-wrap, .video-box');
        if (!container) {
            // 向上回溯宽高符合播放器特征的父级
            let el = video.parentElement;
            while (el && el !== document.body) {
                const rect = el.getBoundingClientRect();
                if (rect.width >= 320 && rect.height >= 180) {
                    container = el;
                    break;
                }
                el = el.parentElement;
            }
        }

        if (container) {
            const pos = window.getComputedStyle(container).position;
            if (pos === 'static') {
                container.style.position = 'relative';
            }
        }

        return container || video.parentElement;
    }

    // =========================================================================
    // 5. UI 注入与交互处理
    // =========================================================================
    function injectUI() {
        const container = findVideoContainer();
        if (!container) return;

        // 1. 注入悬浮换源胶囊按钮
        let toolbar = document.getElementById('yfsp-hd-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'yfsp-hd-toolbar';
            toolbar.className = 'yfsp-hd-toolbar';
            toolbar.innerHTML = `
                <button id="yfsp-hd-toggle-btn" class="yfsp-hd-btn" type="button">
                    <span class="hd-icon">⚡</span>
                    <span class="hd-text">切换真 1080P 蓝光</span>
                </button>
            `;
            container.appendChild(toolbar);

            const toggleBtn = toolbar.querySelector('#yfsp-hd-toggle-btn');
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isHdActive) {
                    deactivateHdPlayer();
                } else {
                    activateHdPlayer();
                }
            });
        } else if (toolbar.parentElement !== container) {
            container.appendChild(toolbar);
        }

        // 2. 注入 1080P 高清播放遮罩层
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
                        <button id="yfsp-hd-close-btn" class="yfsp-hd-close" type="button" title="返回爱壹帆原版">✕ 返回原版(576P)</button>
                    </div>
                </div>
                <div id="yfsp-artplayer-container" class="yfsp-artplayer-container">
                    <div id="yfsp-hd-loading-box" class="yfsp-hd-loading">
                        <div class="yfsp-hd-spinner"></div>
                        <div id="yfsp-hd-loading-text" class="yfsp-hd-loading-msg">正在全网检索 1080P 蓝光片源...</div>
                    </div>
                </div>
            `;
            container.appendChild(overlay);

            // 绑定关闭按钮
            overlay.querySelector('#yfsp-hd-close-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deactivateHdPlayer();
            });

            // 绑定线路切换
            overlay.querySelector('#yfsp-hd-source-select').addEventListener('change', (e) => {
                selectedSourceIndex = parseInt(e.target.value) || 0;
                playCurrentEpisodeInHd();
            });
        } else if (overlay.parentElement !== container) {
            container.appendChild(overlay);
        }
    }

    // =========================================================================
    // 4.1 原生播放器音频彻底静音与拦截控制 (防止双声音重叠)
    // =========================================================================
    function getAllNativeVideos() {
        return Array.from(document.querySelectorAll('video')).filter(v => {
            return !v.closest('#yfsp-artplayer-container') &&
                   !v.classList.contains('artplayer-video') &&
                   !v.classList.contains('yfsp-custom-video');
        });
    }

    function muteAndPauseAllNativeVideos() {
        const videos = getAllNativeVideos();
        videos.forEach(v => {
            try {
                if (!v.paused) v.pause();
                v.muted = true;
                v.volume = 0;
            } catch (e) {}
        });
    }

    // 全局捕获阶段拦截原生 video 自动恢复播放
    window.addEventListener('play', (e) => {
        if (isHdActive) {
            const v = e.target;
            if (v && v.tagName === 'VIDEO' &&
                !v.closest('#yfsp-artplayer-container') &&
                !v.classList.contains('artplayer-video') &&
                !v.classList.contains('yfsp-custom-video')) {
                try {
                    v.pause();
                    v.muted = true;
                    v.volume = 0;
                } catch (err) {}
            }
        }
    }, true);

    // 点击激活 1080P
    async function activateHdPlayer() {
        injectUI();
        const overlay = document.getElementById('yfsp-hd-overlay');
        const toggleBtn = document.getElementById('yfsp-hd-toggle-btn');
        if (!overlay) return;

        isHdActive = true;
        overlay.style.display = 'flex';
        if (toggleBtn) {
            toggleBtn.classList.add('active');
            toggleBtn.querySelector('.hd-text').textContent = '1080P 蓝光播放中';
        }

        // 记录原生播放进度并彻底静音、暂停所有原生视频，杜绝声音重叠
        const nativeList = getAllNativeVideos();
        if (nativeList.length > 0 && nativeList[0].currentTime > 0) {
            lastProgressTime = nativeList[0].currentTime;
            console.log(`${TAG} 记录当前原生播放进度: ${lastProgressTime.toFixed(1)} 秒`);
        }
        muteAndPauseAllNativeVideos();

        // 提取剧名与集数
        detectVideoInfoFromDOM();
        const title = currentVideoTitle || '当前剧集';
        const ep = currentEpisodeNum || '1';

        const titleText = document.getElementById('yfsp-hd-title-text');
        if (titleText) titleText.textContent = `${title} (第 ${ep} 集)`;

        showLoading(`正在为您检索《${title}》第 ${ep} 集真 1080P 切片...`);

        // 开始检索
        const matchedSources = await searchHighDefinitionStreams(title);

        if (!matchedSources || matchedSources.length === 0) {
            showErrorUI(`未能在第三方高清库中检索到《${title}》`, title);
            return;
        }

        currentMatchedList = matchedSources;
        selectedSourceIndex = 0;

        // 填充线路下拉
        const select = document.getElementById('yfsp-hd-source-select');
        if (select) {
            select.innerHTML = matchedSources.map((s, idx) => `
                <option value="${idx}">${s.sourceName}</option>
            `).join('');
        }

        playCurrentEpisodeInHd();
    }

    // 播放指定集数 (支持 555 线路即点即解与高速缓存)
    async function playCurrentEpisodeInHd() {
        if (!currentMatchedList || !currentMatchedList.length) return;
        const currentSource = currentMatchedList[selectedSourceIndex] || currentMatchedList[0];

        const targetEp = currentEpisodeNum || '1';
        let matchedEp = currentSource.episodes.find(e => e.num === targetEp);

        // 容错：如果编号未匹配，尝试按单集标题包含或序号索引
        if (!matchedEp) {
            matchedEp = currentSource.episodes.find(e => e.title.includes(targetEp));
        }
        if (!matchedEp && currentSource.episodes.length > 0) {
            const idx = parseInt(targetEp, 10) - 1;
            matchedEp = currentSource.episodes[idx] || currentSource.episodes[currentSource.episodes.length - 1];
        }

        if (!matchedEp) {
            showErrorUI(`在 [${currentSource.sourceName}] 中未找到第 ${targetEp} 集切片`, currentVideoTitle);
            return;
        }

        // 针对 555 线路实时秒级提取真实 m3u8 直链
        if (currentSource.is555 && !matchedEp.url) {
            showLoading(`正在连接 [${currentSource.sourceName}] ${matchedEp.title}...`);
            try {
                const playHtml = await requestText('https://555k06.com' + matchedEp.playLink);
                const pMatch = playHtml.match(/player_aaaa\s*=\s*({[\s\S]*?});/);
                if (pMatch) {
                    const cleanStr = pMatch[1].replace(/<\/script>[\s\S]*/, '');
                    const parsed = JSON.parse(cleanStr);
                    matchedEp.url = parsed.url;
                }
            } catch (err) {
                console.warn(`${TAG} 555切片直链解析异常:`, err);
            }
        }

        // 针对 ddys.one 线路实时提取真实直链 (优先锁定纯净无广告的 X节点/xlzy，智能探活备选高可用 1080P 节点)
        if (currentSource.isDDYSOne && !matchedEp.url) {
            showLoading(`正在连接 [${currentSource.sourceName}] ${matchedEp.title}...`);
            try {
                const playsUrl = `https://ddys.one/ddrk_plays/${matchedEp.vodId}/${matchedEp.slug}`;
                const playsHtml = await requestText(playsUrl, {
                    'Referer': `https://ddys.one/vod/${matchedEp.vodId}/`
                });
                const parsed = JSON.parse(playsHtml);
                const plays = parsed.video_plays || [];

                // 节点优选优先级：优先极清新浪 xlzy，其次高可用且免防盗链的 ikzy (爱坤1080P)、mdzy (魔都1080P)、gszy (光速)、hnzy (红牛)；避开经常404的 bfzy
                const priority = ['xlzy', 'ikzy', 'mdzy', 'hnzy', 'gszy', 'jszy', 'bfzy', 'lzzy'];
                const sortedPlays = [...plays].sort((a, b) => {
                    const ia = priority.indexOf(a.src_site);
                    const ib = priority.indexOf(b.src_site);
                    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                });

                // 智能快速验活：按优先级探测找到第一个真实存活（非404/403/HTML报错）的有效流
                for (const p of sortedPlays) {
                    if (p && p.play_data) {
                        const candidate = normalizeM3u8Url(p.play_data);
                        const isAlive = await checkStreamPlayable(candidate);
                        if (isAlive) {
                            matchedEp.url = candidate;
                            console.log(`${TAG} ddys.one 自动锁定可用切片节点: [${p.src_site}] -> ${candidate}`);
                            break;
                        }
                    }
                }

                // 兜底：若网络检测全部超时，使用排序后的第一条
                if (!matchedEp.url && sortedPlays[0] && sortedPlays[0].play_data) {
                    matchedEp.url = normalizeM3u8Url(sortedPlays[0].play_data);
                }
            } catch (err) {
                console.warn(`${TAG} ddys.one切片直链解析异常:`, err);
            }
        }

        if (!matchedEp.url) {
            showErrorUI(`[${currentSource.sourceName}] 正在缓冲或无切片，请切换其他线路`, currentVideoTitle);
            return;
        }

        console.log(`${TAG} 最终播放流: [${currentSource.sourceName}] ${matchedEp.title} -> ${matchedEp.url}`);

        const titleText = document.getElementById('yfsp-hd-title-text');
        if (titleText) titleText.textContent = `${currentVideoTitle} - ${matchedEp.title} [${currentSource.sourceName}]`;

        renderPlayer(matchedEp.url);
    }

    // 渲染播放器 (Artplayer 优先，原生 Hls 自动兜底，进度无缝承接)
    function renderPlayer(m3u8Url) {
        const container = document.getElementById('yfsp-artplayer-container');
        if (!container) return;

        // 清理旧播放器
        if (artInstance) {
            try { artInstance.destroy(); } catch (e) {}
            artInstance = null;
        }
        container.innerHTML = '';

        // 统一的高鲁棒性 Hls.js 抗失真引擎（全源继承：专攻贴片广告切片导致的音频采样率与时间戳突变）
        const createTunedHls = () => {
            if (typeof Hls === 'undefined' || !Hls.isSupported()) return null;
            const hls = new Hls({
                enableWorker: false, // 禁用 Worker 跨线程解封装，避免跨线程音频时钟漂移
                lowLatencyMode: false,
                maxAudioFramesDrift: 4, // 允许适度容忍4帧微漂移，由播放器平滑对齐，杜绝硬拉伸变调
                forceKeyFrameOnDiscontinuity: true, // 核心：断点强制对齐关键帧，彻底根治插播广告引发的变声
                backBufferLength: 15, // 及时释放已播放旧切片缓冲区，避免多断点导致 SourceBuffer 碎片累积与声卡时钟崩溃
                appendErrorMaxRetry: 5,
                autoStartLoad: true
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.warn(`${TAG} 捕获流媒体断点异常，自动恢复音频管道:`, data);
                            hls.recoverMediaError();
                            break;
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.warn(`${TAG} 捕获网络异常，自动重连:`, data);
                            hls.startLoad();
                            break;
                        default:
                            break;
                    }
                }
            });
            return hls;
        };

        // 浏览器硬件级音频锁音保频（严格锁定音高，杜绝变声）
        const lockAudioPitch = (video) => {
            if (!video) return;
            try {
                video.preservesPitch = true;
                if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = true;
                if ('mozPreservesPitch' in video) video.mozPreservesPitch = true;
            } catch (e) {}
        };

        // 方式 1: 优先使用 Artplayer
        if (typeof Artplayer !== 'undefined') {
            try {
                artInstance = new Artplayer({
                    container: container,
                    url: m3u8Url,
                    type: 'm3u8',
                    customType: {
                        m3u8: function (video, url, art) {
                            lockAudioPitch(video);
                            const hls = createTunedHls();
                            if (hls) {
                                if (art.hls) art.hls.destroy();
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
                    playbackRate: true,
                    aspectRatio: true,
                    setting: true,
                    hotkey: true,
                    pip: true,
                    fullscreen: true,
                    fullscreenWeb: true,
                    miniProgressBar: true,
                    playsInline: true,
                    autoPlayback: true
                });

                // 进度无缝承接与双重静音保障
                artInstance.on('ready', () => {
                    if (artInstance.video) {
                        lockAudioPitch(artInstance.video);
                    }
                    if (lastProgressTime > 0) {
                        console.log(`${TAG} 1080P 播放器就绪，自动无缝跳至进度: ${lastProgressTime.toFixed(1)} 秒`);
                        artInstance.currentTime = lastProgressTime;
                    }
                    muteAndPauseAllNativeVideos();
                });
                return;
            } catch (err) {
                console.warn(`${TAG} Artplayer 初始化异常，降级为原生 Hls 播放:`, err);
            }
        }

        // 方式 2: 原生 HTML5 Video + Hls.js 坚固兜底
        console.log(`${TAG} 使用原生 HTML5 Video + Hls 渲染`);
        const videoEl = document.createElement('video');
        videoEl.className = 'yfsp-custom-video';
        videoEl.controls = true;
        videoEl.autoplay = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.backgroundColor = '#000';
        lockAudioPitch(videoEl);
        container.appendChild(videoEl);

        const fallbackHls = createTunedHls();
        if (fallbackHls) {
            fallbackHls.loadSource(m3u8Url);
            fallbackHls.attachMedia(videoEl);
        } else {
            videoEl.src = m3u8Url;
        }

        if (lastProgressTime > 0) {
            videoEl.currentTime = lastProgressTime;
        }
        muteAndPauseAllNativeVideos();
    }

    // 退出 1080P 并恢复原生播放与声音
    function deactivateHdPlayer() {
        const overlay = document.getElementById('yfsp-hd-overlay');
        const toggleBtn = document.getElementById('yfsp-hd-toggle-btn');
        if (overlay) overlay.style.display = 'none';
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.querySelector('.hd-text').textContent = '切换真 1080P 蓝光';
        }

        let returnTime = 0;
        if (artInstance) {
            returnTime = artInstance.currentTime || 0;
            try { artInstance.pause(); } catch (e) {}
        }
        const customVideo = document.querySelector('.yfsp-custom-video');
        if (customVideo) {
            returnTime = customVideo.currentTime || returnTime;
            try { customVideo.pause(); } catch (e) {}
        }

        isHdActive = false;

        // 恢复爱壹帆原生播放、取消静音、同步进度
        const nativeVideos = getAllNativeVideos();
        nativeVideos.forEach(v => {
            try {
                if (returnTime > 0) {
                    v.currentTime = returnTime;
                }
                v.muted = false;
                v.volume = 1;
                v.play().catch(() => {});
            } catch (e) {}
        });
    }

    // 辅助界面：加载中状态
    function showLoading(msg) {
        const container = document.getElementById('yfsp-artplayer-container');
        if (!container) return;
        container.innerHTML = `
            <div class="yfsp-hd-loading">
                <div class="yfsp-hd-spinner"></div>
                <div class="yfsp-hd-loading-msg">${msg}</div>
            </div>
        `;
    }

    // 辅助界面：未搜到片源时的手动搜索框
    function showErrorUI(msg, currentTitle) {
        const container = document.getElementById('yfsp-artplayer-container');
        if (!container) return;
        container.innerHTML = `
            <div class="yfsp-hd-error-box">
                <div class="yfsp-hd-error-title">⚠️ ${msg}</div>
                <div class="yfsp-hd-error-tip">您可以尝试微调搜索词（如去掉剧名后缀）：</div>
                <div class="yfsp-hd-search-bar">
                    <input id="yfsp-hd-search-input" type="text" value="${currentTitle}" placeholder="输入剧名搜索..." />
                    <button id="yfsp-hd-search-btn" type="button">重新检索</button>
                </div>
                <div style="margin-top: 15px;">
                    <button id="yfsp-hd-back-btn" class="yfsp-hd-close" type="button">返回爱壹帆原版播放</button>
                </div>
            </div>
        `;

        container.querySelector('#yfsp-hd-back-btn').addEventListener('click', deactivateHdPlayer);
        container.querySelector('#yfsp-hd-search-btn').addEventListener('click', () => {
            const val = container.querySelector('#yfsp-hd-search-input').value.trim();
            if (val) {
                currentVideoTitle = val;
                activateHdPlayer();
            }
        });
    }

    // =========================================================================
    // 6. 状态轮询与路由监听 (SPA 选集自动联动)
    // =========================================================================
    let lastUrl = location.href;
    let lastEp = '';

    function scheduleRefresh() {
        detectVideoInfoFromDOM();
        injectUI();
        if (isHdActive && currentEpisodeNum && currentEpisodeNum !== lastEp) {
            lastEp = currentEpisodeNum;
            playCurrentEpisodeInHd();
        }
    }

    setInterval(() => {
        if (isHdActive) {
            muteAndPauseAllNativeVideos();
        }
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            currentEpisodeNum = '1';
            setTimeout(scheduleRefresh, 600);
        }
        detectVideoInfoFromDOM();
        injectUI();

        // 辅助检测：绝对保护右侧 UP 主卡片与关注按钮，严禁误伤
        function isAuthorOrEssential(el) {
            if (!el) return false;
            if (el.closest('video-publisher, .video-publisher, .video-publisher-container, .follow-button, .uploader, .author-block, .name-card, .user-block, .user-center, app-user-meta, app-user-card, [class*="uploader"], [class*="user-status"]')) {
                return true;
            }
            const text = el.textContent || '';
            if (text.includes('关注') || text.includes('已关注') || text.includes('粉丝')) {
                return true;
            }
            return false;
        }

        // 深度巡检清理右侧边栏与全站广告横幅 (PRU/PRD/PB/dabf 等)，彻底收起广告占位
        try {
            const adSelectors = `
                [dabf],
                [code="PRU"], [code="PRD"], [code="PB"],
                [code="VPRU"], [code="VPRD"],
                .pru-transition-style, .prd-transition-style, .prd-top-change,
                .gg-tips-text, .auth-label,
                img[alt="广告"]
            `;
            const adNodes = document.querySelectorAll(adSelectors);
            adNodes.forEach(el => {
                if (isAuthorOrEssential(el)) return;
                let host = el;
                if (el.parentElement && !isAuthorOrEssential(el.parentElement) && !el.parentElement.matches('body, html, main, .container, app-root') && el.parentElement.classList.contains('bl')) {
                    host = el.parentElement;
                }
                host.style.setProperty('display', 'none', 'important');
                host.style.setProperty('height', '0px', 'important');
                host.style.setProperty('min-height', '0px', 'important');
                host.style.setProperty('overflow', 'hidden', 'important');
            });
        } catch (e) {}

        // DOM 深度去广告巡检看门狗 (精确清理片头倒计时与卡屏层，绝不触碰右侧关注栏)
        try {
            const adKeywords = ['暂时无法显示广告', '了解详情', '跳过广告', '广告剩余'];
            const allElements = document.querySelectorAll('div, span, p, a, button');
            allElements.forEach(el => {
                if (el.closest('#yfsp-hd-toolbar') || el.closest('#yfsp-hd-overlay')) return;
                if (isAuthorOrEssential(el)) return; // 绝对保护作者卡片与关注按钮

                const txt = el.textContent ? el.textContent.trim() : '';

                // 仅清理视频播放器内部的“广告”角标
                if (txt === '广告' && el.closest('.video-player, .publicplay, .aa-videoplayer-wrap')) {
                    el.style.setProperty('display', 'none', 'important');
                } else if (adKeywords.some(kw => txt.includes(kw))) {
                    const mask = el.closest('.video-front-ad, .video-pause-ad, .player-ad, [class*="mask"]') || el;
                    if (!isAuthorOrEssential(mask)) {
                        mask.style.setProperty('display', 'none', 'important');
                    }
                } else if (txt.includes('下载该视频')) {
                    // 仅精确隐藏下载推广自身小挂件，绝不往上扩大到整个侧边栏
                    const tip = el.closest('.download-tip, [class*="download"]') || el;
                    if (!isAuthorOrEssential(tip)) {
                        tip.style.setProperty('display', 'none', 'important');
                    }
                }
            });
        } catch (e) {}

        // 原生播放器卡顿自动促醒：如果原生 video 处于 paused 且被片头广告阻断，促醒播放正片
        const nativeVideo = document.querySelector('video:not(.artplayer-video):not(.yfsp-custom-video)');
        if (nativeVideo && !isHdActive && nativeVideo.paused && nativeVideo.currentTime === 0 && nativeVideo.readyState >= 2) {
            nativeVideo.play().catch(() => {});
        }
    }, 350);

    // =========================================================================
    // 7. 样式注入
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('yfsp-hd-style')) return;
        const style = document.createElement('style');
        style.id = 'yfsp-hd-style';
        style.textContent = `
            /* 1. 深度隐藏右侧边栏及页面全局广告横幅组件 (PRU/PRD/PB/SS/dabf 等) */
            [dabf],
            [code="PRU"], [code="PRD"], [code="PB"],
            [code="VPRU"], [code="VPRD"], [code="VPB"],
            [code="SS"], [code="DL"], [code="H4"],
            .pru-transition-style,
            .prd-transition-style,
            .prd-top-change,
            .gg-tips-text,
            .auth-label,
            img[alt="广告"],
            /* 视频播放窗口内部广告组件 */
            .video-player .player-ad,
            .video-player .video-ad,
            .video-player .pause-ad,
            .video-player .video-pause-ad,
            .video-player .video-front-ad,
            .video-player .ad-mark,
            .video-player .ad-tips,
            .video-player .player-ads-wrap,
            .video-player .ads-layer,
            .video-player .aa-ad-wrap,
            .video-player [class*="video-front-ad"],
            .video-player [class*="video-pause-ad"],
            .publicplay .video-front-ad,
            .publicplay .video-pause-ad {
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                visibility: hidden !important;
                width: 0 !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
            }

            /* 2. 绝对保障右侧 UP 主关注卡片结构完整与完美对齐（保持块级流式布局，防止+关注按钮上浮错位） */
            .video-publisher-container {
                display: block !important;
                position: relative !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                margin-top: 14px !important;
            }

            video-publisher,
            .video-publisher {
                display: block !important;
                position: relative !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
                height: auto !important;
            }

            video-publisher .publisher {
                display: block !important;
                position: relative !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
            }

            video-publisher .action {
                display: block !important;
                position: relative !important;
                visibility: visible !important;
                opacity: 1 !important;
                height: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
            }

            video-publisher .follow-button {
                visibility: visible !important;
                opacity: 1 !important;
            }

            .uploader,
            .author-block,
            .name-card,
            .user-block,
            app-user-meta {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            /* 悬浮换源胶囊按钮 (固定停靠在播放器右上角) */
            .yfsp-hd-toolbar {
                position: absolute;
                top: 14px;
                right: 14px;
                z-index: 2147483640;
                pointer-events: auto;
            }
            .yfsp-hd-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                background: linear-gradient(135deg, #ffb400, #ff8c00);
                color: #121216;
                font-weight: 700;
                font-size: 13px;
                border: none;
                outline: none;
                padding: 7px 16px;
                border-radius: 20px;
                cursor: pointer;
                box-shadow: 0 4px 16px rgba(255, 180, 0, 0.4);
                transition: all 0.25s ease;
                user-select: none;
            }
            .yfsp-hd-btn:hover {
                transform: translateY(-2px) scale(1.04);
                box-shadow: 0 6px 22px rgba(255, 180, 0, 0.65);
            }
            .yfsp-hd-btn.active {
                background: rgba(22, 22, 32, 0.9);
                color: #ffb400;
                border: 1px solid rgba(255, 180, 0, 0.6);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
            }

            /* 1080P 遮罩播放层 */
            .yfsp-hd-overlay {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                background: #000;
                z-index: 2147483645;
                display: flex;
                flex-direction: column;
            }
            .yfsp-hd-header {
                height: 48px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.85), transparent);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 16px;
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                z-index: 20;
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
                padding: 2px 7px;
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
                background: rgba(30, 30, 42, 0.85);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 4px;
                padding: 4px 10px;
                font-size: 12px;
                outline: none;
                cursor: pointer;
            }
            .yfsp-hd-close {
                background: rgba(255, 255, 255, 0.15);
                color: #eee;
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 5px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .yfsp-hd-close:hover {
                background: rgba(255, 77, 79, 0.9);
                color: #fff;
                border-color: transparent;
            }
            .yfsp-artplayer-container {
                flex: 1;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            /* 加载中动画 */
            .yfsp-hd-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                color: #ffb400;
            }
            .yfsp-hd-spinner {
                width: 44px;
                height: 44px;
                border: 4px solid rgba(255, 180, 0, 0.2);
                border-top-color: #ffb400;
                border-radius: 50%;
                animation: yfsp-spin 0.8s linear infinite;
            }
            @keyframes yfsp-spin {
                to { transform: rotate(360deg); }
            }
            .yfsp-hd-loading-msg {
                font-size: 14px;
                color: #ddd;
            }

            /* 错误与手动搜索 */
            .yfsp-hd-error-box {
                text-align: center;
                color: #eee;
                max-width: 450px;
                padding: 24px;
                background: rgba(30, 30, 42, 0.9);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .yfsp-hd-error-title {
                font-size: 16px;
                font-weight: 700;
                margin-bottom: 8px;
                color: #ffb400;
            }
            .yfsp-hd-error-tip {
                font-size: 12px;
                color: #aaa;
                margin-bottom: 16px;
            }
            .yfsp-hd-search-bar {
                display: flex;
                gap: 8px;
            }
            .yfsp-hd-search-bar input {
                flex: 1;
                background: #111;
                border: 1px solid #444;
                color: #fff;
                padding: 7px 12px;
                border-radius: 4px;
                outline: none;
            }
            .yfsp-hd-search-bar button {
                background: #ffb400;
                color: #121216;
                border: none;
                font-weight: 700;
                padding: 0 16px;
                border-radius: 4px;
                cursor: pointer;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

})();
