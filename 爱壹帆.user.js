// ==UserScript==
// @name         爱壹帆 1080P 高清换源播放
// @namespace    https://github.com/Niklaus88/UserScript
// @version      2.9.27
// @description  为爱壹帆（yfsp.tv）接入第三方真·1080P/4K蓝光切片源，彻底修复电影播放搜索时清晰度标签（如576P）被误识别为集数（第576集）导致找源失败的严重Bug（引入分辨率全量免疫过滤与电影类别绝对锁定）、精准确保非电影电视剧/动漫/综艺选集与连载集数不受任何影响、重磅引入低端影视官方主站 (DDYS.app) 专属极速【亚太线路 (1080P/原画)】并保持Top 2黄金起播高优先级、同步引入555电影专属高速蓝光集群与低端影视专属1080P/新浪极清线路，全新重构iOS 26/27纯白高透液体玻璃播放系统（彻底重构双模式独立自愈响应系统实现窗口模式进窗即显移出立退与全屏模式触底140px宽幅热区毫秒级滑升双向完美自愈、彻底清除代码多余空格消除篡改猴所有黄色感叹号语法警告、精准修复首集状态下【上一集】与末集状态下【下一集】未呈现沉稳暗灰色的Bug、彻底杜绝全局按钮高特异性规则覆盖禁用态、支持DOM矢量填色与高优先级CSS双重灰阶着色、彻底修复上一集/下一集切换期间旧视频背景声音泄露与加载层覆盖导致播放器失联卡死Bug、非电影类连载节目专属全新重磅上线【上一集/下一集】无缝秒切功能，严格锁定控制栏排版为【上一集⏮】->【播放▶】->【下一集⏭】->【音量🔊】->【时间戳】、采用方案A内嵌无刷新平滑切流保持全屏不被打断并静默同步地址栏与页面选集高亮、首集与末集智能半透明置灰防呆、视频播放完毕或片尾跳过自动连播下一集、精准收敛设置抽屉面板宽度至精致紧凑比例消除空旷感、彻底消除Artplayer默认居中导致的图标文字参差不齐Bug实现设置项图标与文字绝对左对齐、精准修复设置抽屉菜单右侧箭头图标变形切角与左侧矢量图标实心填充Bug、精准隔离控制按钮样式彻底修复时间戳与进度条重叠挤压Bug、精修控制按钮悬停微圆环光效消除过大长方形高晕、柔和收敛进度条选中微动动画与刺目泛光光晕、为设置面板专属重绘精致SVG矢量图标、全新重构线路优先级评分模型将555·极速蓝光-R锁定为Top 1默认起播源、555·极速蓝光-b锁定为Top 2黄金备选、全源检索并发化并将超时熔断压制在3.5秒以内、精准屏蔽主页大图轮播背景视频、规范统一播放器左上角标题显示格式为【XXX - 第N集】），免除VIP限制，深度净网去广告，精准季数识别与防串季打分系统，全源接入Hls智能自愈防断点抗失真锁音引擎并完美定位UP主关注卡片，支持多线路自由切换与进度无缝同步
// @author       Don E.Knuth
// @match        https://www.yfsp.tv/*
// @match        https://yfsp.tv/*
// @icon         https://www.yfsp.tv/favicon.ico
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_webRequest
// @connect      555k06.com
// @connect      55dy60.com
// @connect      555dy.net
// @connect      ddys.app
// @connect      *.ddys.app
// @connect      v2.ddys.app
// @connect      v3.ddys.app
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

    console.log(`${TAG} 脚本已启动 (v2.9.10) - 彻底修复电影模式576P误转集数Bug并保障电视剧集数完整`);

    // 自动重写 DDYS 官方直链防盗链 Referer 请求头（保障亚太节点极速播放）
    if (typeof GM_webRequest !== 'undefined') {
        try {
            GM_webRequest([
                { selector: '*://*.ddys.app/*', action: { redirect: { headers: { 'Referer': 'https://ddys.app/' } } } }
            ], function () {});
        } catch (e) {
            console.warn(`${TAG} GM_webRequest 规则注册异常:`, e);
        }
    }

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
    let currentEpisodeNum = ''; // 默认为空（电影/单片无集数，多集剧集才记录数字）
    let isMovieMode = false; // 标识是否为电影单片模式
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

            // 识别是否为电影类别（显式电影分类）
            const isMovieCategory = (info.typeName === '电影' || info.channelName === '电影' || info.columnName === '电影' || info.type === 'movie' || info.channel === 'movie');
            if (isMovieCategory) {
                isMovieMode = true;
                currentEpisodeNum = '';
            }

            if (info.mediaTitle && !isMovieCategory) {
                // 彻底清洗清晰度与质量标签（坚决杜绝将 576P / 720P / 1080P 误提取为第 576 集，同时剔除免费/VIP等干扰词）
                const cleanMediaTitle = String(info.mediaTitle)
                    .replace(/\b\d{3,4}[pP]\b|\b[24]k\b|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]/gi, '')
                    .replace(/超清|高清|标清|蓝光|原画|正片|国语|粤语|英语|免费|VIP|超前点播|预告|付费/g, '')
                    .trim();
                const commonResolutions = [240, 360, 480, 576, 720, 1080, 1440, 2160];
                let epMatch = cleanMediaTitle.match(/第\s*(\d+)\s*[集话期]/);
                if (!epMatch) {
                    const numM = cleanMediaTitle.match(/(?:^|[-_\s]+)0*(\d{1,4})(?:$|[-_\s]+)/);
                    if (numM && !commonResolutions.includes(parseInt(numM[1], 10))) {
                        epMatch = numM;
                    }
                }
                if (epMatch) {
                    currentEpisodeNum = String(parseInt(epMatch[1], 10));
                    isMovieMode = false;
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
        if (info) {
            const isMovieCategory = (info.typeName === '电影' || info.channelName === '电影' || info.columnName === '电影' || info.type === 'movie' || info.channel === 'movie');
            if (isMovieCategory) {
                isMovieMode = true;
                currentEpisodeNum = '';
            }
            if (info.title || info.name || info.videoName) {
                const raw = info.title || info.name || info.videoName;
                const parsed = parseTitleAndEp(raw);
                if (parsed.title) currentVideoTitle = parsed.title;
                if (!isMovieCategory && parsed.ep) {
                    currentEpisodeNum = parsed.ep;
                    isMovieMode = false;
                }
                console.log(`${TAG} 接口捕获影视: [${currentVideoTitle}], 类型: [${isMovieMode ? '电影单片' : '连续剧'}], 集数: [${currentEpisodeNum || '无集数'}]`);
                scheduleRefresh();
            }
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
        if (!raw) return { title: '', ep: '' };
        let text = raw
            .replace(/-\s*爱壹帆.*/i, '')
            .replace(/_爱壹帆.*/i, '')
            .replace(/在线观看.*/i, '')
            .replace(/\b(?:240|360|480|576|720|1080|1440|2160|4320)[pP]\b|\b[24]k\b/gi, '')
            .replace(/HD|BD|4K|1080P|720P|576P|480P|360P/gi, '')
            .replace(/[\[\(【（].*?[\]\)】）]/g, '')
            .replace(/[《》]/g, '')
            .trim();

        let ep = '';

        // 模式 A: 复合分集与业务标签，如 "嫁金钗-01-免费"、"替嫁医女-01-VIP"、"庆余年-05-超前点播"
        const mA = text.match(/[-_\s]+0*(\d{1,4})[-_\s]*(?:免费|VIP|超前点播|预告|正片|付费|抢先|完整版|未删减)/i);
        if (mA) {
            ep = mA[1];
            text = text.replace(/[-_\s]+0*\d{1,4}[-_\s]*(?:免费|VIP|超前点播|预告|正片|付费|抢先|完整版|未删减).*/i, '').trim();
        }

        // 模式 B: 标准带集字样，如 "第01集"、"第154集-免费"、"EP102"
        if (!ep) {
            const mB = text.match(/(?:第\s*(\d+)\s*[集话期]|EP\s*(\d+))/i);
            if (mB) {
                ep = mB[1] || mB[2];
                text = text.replace(/(?:第\s*\d+\s*[集话期]|EP\s*\d+).*/i, '').trim();
            }
        }

        // 模式 C: 纯尾部数字分集，如 "嫁金钗 01"、"仙逆 154"、"斗破苍穹-03"、"凡人修仙传_20"（排除 1900-2099 年份与常见分辨率 240/360/480/576/720/1080）
        if (!ep) {
            const mC = text.match(/(?:^|[-_\s]+)0*(\d{1,4})$/);
            if (mC) {
                const numVal = parseInt(mC[1], 10);
                const commonResolutions = [240, 360, 480, 576, 720, 1080, 1440, 2160];
                if (!(numVal >= 1900 && numVal <= 2099) && !commonResolutions.includes(numVal)) {
                    ep = String(numVal);
                    text = text.replace(/(?:^|[-_\s]+)\d{1,4}$/, '').trim();
                }
            }
        }

        // 清理尾部残留的分辨率数值、业务标签与连接符，如 "Ali G: 我系水? - 576"、"抓娃娃-免费"
        text = text
            .replace(/[-_\s]*(?:240|360|480|576|720|1080|1440|2160)$/, '')
            .replace(/[-_\s]*(?:免费|VIP|超前点播|预告|正片|付费|抢先|完整版|未删减)$/i, '')
            .replace(/[\s\-:_—·：]+$/, '')
            .trim();

        return {
            title: text,
            ep: ep ? String(parseInt(ep, 10)) : ''
        };
    }

    // 核心季数与影视名称归一化（将 "第2季" <=> "第二季" <=> "2" <=> "Ⅱ" 标准化，支撑精准跨源打分匹配）
    function normalizeTitleForMatch(str) {
        if (!str) return '';
        const chineseNumMap = { 
            '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
            'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6', 'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', 'Ⅹ': '10'
        };
        return str
            .replace(/第\s*([一二三四五六七八九十\d]+)\s*[季部]/g, (_, num) => chineseNumMap[num] || num)
            .replace(/([一二三四五六七八九十])季/g, (_, num) => chineseNumMap[num] || num)
            .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, ch => chineseNumMap[ch] || ch)
            .replace(/[:：·\-_—\s]+/g, '')
            .toLowerCase();
    }

    // 智能影视标题与季数防串打分算法（彻底杜绝第2季误选第1季）
    function calculateMatchScore(candidateTitle, targetTitle, kw) {
        if (!candidateTitle || !targetTitle) return 0;
        const normTarget = normalizeTitleForMatch(targetTitle);
        const normCandidate = normalizeTitleForMatch(candidateTitle);

        const targetSeasonMatch = targetTitle.match(/第\s*([一二三四五六七八九十\d]+)\s*[季部]|([一二三四五六七八九十\d]+)[季部]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|(?:\s+)(\d+)$/);
        const candidateSeasonMatch = candidateTitle.match(/第\s*([一二三四五六七八九十\d]+)\s*[季部]|([一二三四五六七八九十\d]+)[季部]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|(?:\s+)(\d+)$/);

        // 完全同构匹配（如 斩神之凡尘神域第2季 与 斩神之凡尘神域2 或 斩神之凡尘神域Ⅱ）
        if (normCandidate === normTarget) return 100;

        // 如果用户目标明确指定了季数（如第二季/第2季），候选片名却缺少季数标识，属于跨季/第一季错配，严重降权
        if (targetSeasonMatch && !candidateSeasonMatch) {
            return 20;
        }

        // 如果两者均有季数但季数不相同（如第一季与第二季），绝对严禁匹配
        if (targetSeasonMatch && candidateSeasonMatch) {
            const normT = normTarget.slice(-1);
            const normC = normCandidate.slice(-1);
            if (normT !== normC) return 0;
        }

        if (normCandidate.startsWith(normTarget) || normTarget.startsWith(normCandidate)) return 80;
        if (normCandidate.includes(normTarget) || normTarget.includes(normCandidate)) return 60;
        if (candidateTitle === kw || candidateTitle.includes(kw) || kw.includes(candidateTitle)) return 50;
        return 10;
    }

    function generateKeywords(raw) {
        if (!raw) return [];
        let text = raw
            .replace(/-\s*爱壹帆.*/i, '')
            .replace(/_爱壹帆.*/i, '')
            .replace(/在线观看.*/i, '')
            .replace(/HD|BD|4K|1080P/gi, '')
            .replace(/[\[\(【（].*?[\]\)】）]/g, '')
            .replace(/[《》]/g, '')
            .replace(/[-_\s]+0*\d{1,4}[-_\s]*(?:免费|VIP|超前点播|预告|正片|付费|抢先|完整版|未删减).*/i, '')
            .replace(/第\s*\d+\s*[集话期].*/, '')
            .replace(/(?:^|[-_\s]+)0*\d{1,4}$/, '')
            .replace(/[-_\s]*(?:免费|VIP|超前点播|预告|正片|付费|抢先|完整版|未删减)$/i, '')
            .replace(/[\s\-:_—·：]+$/, '')
            .trim();

        const list = [];
        if (text) list.push(text);

        const chineseNumMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九', '10': '十' };
        const numToChineseMap = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10' };

        // 多级季数衍生泛化（如 "第2季" <=> "2" <=> "第二季"）
        const mSeasonNum = text.match(/第\s*(\d+)\s*[季部]/);
        if (mSeasonNum) {
            const num = mSeasonNum[1];
            const cn = chineseNumMap[num] || num;
            const vNumNoSpace = text.replace(/第\s*\d+\s*[季部]/, num).replace(/\s+/g, '').trim();
            const vNum = text.replace(/第\s*\d+\s*[季部]/, ` ${num}`).replace(/\s+/g, ' ').trim();
            const vCn = text.replace(/第\s*\d+\s*[季部]/, `第${cn}季`).replace(/\s+/g, ' ').trim();
            [vNumNoSpace, vNum, vCn].forEach(v => {
                if (v && !list.includes(v)) list.push(v);
            });
        }

        const mSeasonCn = text.match(/第\s*([一二三四五六七八九十])\s*[季部]/);
        if (mSeasonCn) {
            const cn = mSeasonCn[1];
            const num = numToChineseMap[cn] || cn;
            const vNumNoSpace = text.replace(/第\s*[一二三四五六七八九十]\s*[季部]/, num).replace(/\s+/g, '').trim();
            const vNum = text.replace(/第\s*[一二三四五六七八九十]\s*[季部]/, ` ${num}`).replace(/\s+/g, ' ').trim();
            const vArab = text.replace(/第\s*[一二三四五六七八九十]\s*[季部]/, `第${num}季`).replace(/\s+/g, ' ').trim();
            [vNumNoSpace, vNum, vArab].forEach(v => {
                if (v && !list.includes(v)) list.push(v);
            });
        }

        // 如果是剧集或动漫，增加带集数的关键词，精准直达目标集或专项切片
        if (!isMovieMode && currentEpisodeNum) {
            const epKw1 = `${text} 第${currentEpisodeNum}集`;
            const epKw2 = `${text} ${currentEpisodeNum}`;
            if (!list.includes(epKw1)) list.push(epKw1);
            if (!list.includes(epKw2)) list.push(epKw2);
        }

        // 移除 "第x季 / 第x部 / 第x篇"
        const noSeason = text.replace(/第\s*[一二三四五六七八九十\d]+\s*[季部篇章]/g, '').replace(/[\s\-:_—·：]+$/, '').trim();
        if (noSeason && !list.includes(noSeason)) list.push(noSeason);

        if (!isMovieMode && currentEpisodeNum && noSeason) {
            const epKwNoSeason = `${noSeason} 第${currentEpisodeNum}集`;
            if (!list.includes(epKwNoSeason)) list.push(epKwNoSeason);
        }

        // 替换冒号与分隔符为空格
        const clean = text.replace(/[:：·\-_—]/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean && !list.includes(clean)) list.push(clean);

        const cleanNoSeason = noSeason.replace(/[:：·\-_—]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanNoSeason && !list.includes(cleanNoSeason)) list.push(cleanNoSeason);

        return list.filter(k => k.length >= 2);
    }

    function isPlayPage() {
        const path = (location.pathname || '').toLowerCase();
        // 显式主页、频道聚合页、榜单页、搜索页一律排除
        if (path === '/' || path === '' || path === '/home' || path === '/index' || path === '/index.html') {
            return false;
        }
        if (/^\/(list|type|category|search|rank|user|vip|app|history|short)/i.test(path)) {
            return false;
        }
        // 明确的播放页路径标识
        if (path.includes('/play') || path.includes('/watch') || path.includes('/video/') || path.includes('/v/')) {
            return true;
        }
        // 结构兜底：有选集列表或播放器核心容器
        if (document.querySelector('.player-media-list, .detail-info, .video-detail, .aa-videoplayer-wrap')) {
            return true;
        }
        return false;
    }

    function detectVideoInfoFromDOM() {
        if (!isPlayPage()) return;
        // 保留接口可能已先行截获的集数信息，绝不盲目清空
        let detectedEp = currentEpisodeNum || '';

        // 1. 优先提取当前页面原生标题
        // document.title 具有天然的页面隔离性，绝对不会被右侧边栏“相关推荐”或“猜你喜欢”卡片所污染
        let rawTitle = '';
        const docParsed = parseTitleAndEp(document.title);
        if (docParsed.title) {
            rawTitle = docParsed.title;
            if (docParsed.ep && !detectedEp) {
                detectedEp = docParsed.ep;
            }
        }

        // 2. 局部受限扫描：若 document.title 未获取到有效片名，仅在播放器核心详情区域查找
        // 坚决排除任何侧边栏、推荐位、热播榜、以及全局 header 导航条内的标题元素
        if (!rawTitle || rawTitle.length < 2) {
            const candidateSelectors = [
                '.video-detail h1',
                '.detail-info h1',
                '.video-info h1',
                '.player-container .video-name',
                '.media-info h1',
                'h1.video-title',
                'h1.title'
            ];
            for (const sel of candidateSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    if (!el.closest('.sidebar, .aside, .recommend, .related, .recommend-box, .related-box, [class*="recommend"], [class*="related"], [class*="sidebar"], [class*="rank"], [class*="hot"], header, nav, .header, .nav')) {
                        const txt = (el.textContent || '').trim();
                        if (txt) {
                            rawTitle = txt;
                            break;
                        }
                    }
                }
            }
        }

        const parsed = parseTitleAndEp(rawTitle);
        if (parsed.title) currentVideoTitle = parsed.title;
        if (parsed.ep && !detectedEp) {
            detectedEp = parsed.ep;
        }

        // 3. 从爱壹帆播放列表/选集按钮抓取当前激活的高亮集数
        const activeEp = document.querySelector('.player-media-list .active, .episode-item.active, .ep-item.active, .anthology-item.active, .series-item.active, [class*="episode"].active, [class*="ep-item"].active');
        if (activeEp && activeEp.textContent) {
            const m = activeEp.textContent.match(/(?:第\s*)?(\d+)\s*[集话期]?/);
            if (m) {
                detectedEp = String(parseInt(m[1], 10));
            }
        }

        // 4. 从 URL 中智能提取集数（严密区分：电影单段ID vs 电视剧两段/多段分集路径）
        if (!detectedEp) {
            // 路径规则 1: 爱壹帆原生分集两段式路径，如 /play/801071/4 或 /play/801071/4.html
            const pathTwoSegments = location.href.match(/\/play\/\d+\/(\d+)(?:\.html)?(?:$|[?#])/i) || location.href.match(/\/\d+\/(\d+)(?:\.html)?(?:$|[?#])/);
            // 路径规则 2: 三段连字符式路径，如 /play/801071-1-4.html
            const pathHyphenSegment = location.href.match(/\/\d+-\d+-(\d+)(?:\.html)?(?:$|[?#])/);
            // 路径规则 3: 显式查询参数或分级路径，如 ?ep=4, ?p=4, ?nid=4, /ep/4
            const queryEp = location.href.match(/[?&](?:ep|episode|p|nid)=(\d+)/i);
            const pathExplicitEp = location.href.match(/\/(?:ep|episode|p)\/(\d+)(?:\.html)?(?:$|[?#])/i);

            const urlEpMatch = pathTwoSegments || pathHyphenSegment || queryEp || pathExplicitEp;
            if (urlEpMatch) {
                const epNumVal = parseInt(urlEpMatch[1], 10);
                const commonResolutions = [240, 360, 480, 576, 720, 1080, 1440, 2160];
                if (!commonResolutions.includes(epNumVal)) {
                    detectedEp = String(epNumVal);
                }
            }
        }

        // 5. 检查多集连载特征与电影标签
        const pageText = document.body ? document.body.innerText : '';
        const hasSeriesText = /更新[到至]\s*\d+\s*[集话期]|共\s*\d+\s*[集话期]|\d+\s*集全|连载中|分集剧情/.test(pageText);
        const epButtons = Array.from(document.querySelectorAll(
            '.player-media-list a, .episode-item, .ep-item, .anthology-item, .series-item, [class*="episode-item"], [class*="ep-item"]'
        )).filter(el => !el.closest('.recommend, .related, .sidebar, .aside, [class*="recommend"], [class*="related"]'));

        // 严格限定在主影视信息区域内查找“电影”标签（绝不扫描全局 header 导航条或侧栏推荐）
        const mainInfoContainer = document.querySelector('.detail-info, .video-detail, .media-info, .video-info, .player-container') || document.body;
        const hasMovieTag = Array.from(mainInfoContainer.querySelectorAll('.tag, .genre, .breadcrumb, .video-tag, .info-item, .info-tags span, .label, .detail-info-item')).some(el => {
            if (el.closest('header, nav, .header, .nav, .sidebar, .aside, .recommend, .related, [class*="recommend"], [class*="related"]')) {
                return false;
            }
            const txt = (el.textContent || '').trim();
            return txt === '电影' || txt === '微电影' || txt === '网络电影';
        });

        // 6. 电视剧/动漫/综艺多集模式 vs 电影单片模式精准收敛
        // 核心准则：若明确具备电影标签，或既无选集列表按钮且无连载字样，坚决收敛为电影单片模式！
        // 只有当有 2 个以上选集按钮、页面有“更新至/全xx集”连载字样、或者标题/选集确实激活了“第X集”时，才属于连续剧
        const isExplicitMultiEp = (epButtons && epButtons.length >= 2) || hasSeriesText || (activeEp && activeEp.textContent);
        const hasExplicitEpWord = /(?:第\s*\d+\s*[集话期]|EP\s*\d+)/i.test(document.title) || /(?:第\s*\d+\s*[集话期]|EP\s*\d+)/i.test(rawTitle);

        if (hasMovieTag && !isExplicitMultiEp) {
            isMovieMode = true;
            currentEpisodeNum = '';
        } else if (isExplicitMultiEp || hasExplicitEpWord) {
            isMovieMode = false;
            currentEpisodeNum = detectedEp || '1';
        } else {
            // 兜底：既无选集列表也无连载字样，无显式集数词，判定为电影单片
            isMovieMode = true;
            currentEpisodeNum = '';
        }
    }

    // =========================================================================
    // 3. 第三方影视源检索：555电影专属集群 + 低端影视专属1080P/新浪极清 + 官方独立切片源
    // =========================================================================
    function getRefererForUrl(url) {
        if (url.includes('ddys.app')) return 'https://ddys.app/';
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
                    timeout: 3500, // 优化为 3.5 秒快速熔断（原 7000），极大减少换源等待
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
                    timeout: 3500, // 优化为 3.5 秒快速熔断（原 7000）
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
                    timeout: 1500, // 探针优化为 1.5 秒
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

    function parse555SearchCards(searchHtml) {
        const list = [];
        // 严格以 module-card-item 卡片为作用域切片，杜绝跨卡片正则串位错误匹配
        const chunks = searchHtml.split('class="module-card-item');
        for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i];
            const idMatch = chunk.match(/href="\/voddetail\/(\d+)\.html"/);
            if (!idMatch) continue;
            const id = idMatch[1];
            const titleMatch = chunk.match(/<strong>([\s\S]*?)<\/strong>/) || chunk.match(/alt="([^"]+)"/) || chunk.match(/title="([^"]+)"/);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
            if (id && title && !list.some(item => item.id === id)) {
                list.push({ id, title });
            }
        }
        return list;
    }

    // 核心：深度解析 555 电影的全部多线路与切片列表 (支持精准卡片打分与防串季匹配)
    async function search555Lines(keywords, targetTitle) {
        const host = 'https://555k06.com';
        const matchedCards = [];
        let bestScore = 0;

        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/vodsearch/-------------.html?wd=${encodeURIComponent(kw)}`);
                const cards = parse555SearchCards(searchHtml);
                for (const card of cards) {
                    const score = calculateMatchScore(card.title, targetTitle || kw, kw);
                    if (score >= 60) {
                        if (score > bestScore) bestScore = score;
                        if (!matchedCards.some(c => c.id === card.id)) {
                            matchedCards.push({ id: card.id, title: card.title, score: score });
                        }
                    }
                }
            } catch (e) {}
        }

        // 筛选最高分档位的候选卡片（若存在100分完全匹配，则保留所有100分条目，如空枪的多个同名资源分流）
        const targetCards = matchedCards.filter(c => c.score === bestScore && bestScore >= 50);
        if (!targetCards || targetCards.length === 0) return [];

        console.log(`${TAG} 555精准匹配到 ${targetCards.length} 个同名/高分条目:`, targetCards.map(c => `ID=${c.id}(${c.title})`).join(', '));

        const allLines = [];
        const seenLineKeys = new Set();

        // 并发获取所有同名条目的播放线路并合并去重
        await Promise.allSettled(targetCards.map(async (card) => {
            try {
                const detailHtml = await requestText(`${host}/voddetail/${card.id}.html`);
                const tabNames = [];
                const reTab = /data-dropdown-value="([^"]+)"/g;
                let tm;
                while ((tm = reTab.exec(detailHtml)) !== null) {
                    tabNames.push(tm[1].trim());
                }

                const reList = /<div[^>]*class="[^"]*module-play-list[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
                let lm;
                let idx = 0;

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

                    if (eps.length > 0) {
                        const lineFullName = `555·${lineName}`;
                        // 排重标识：同一线路名称 + 首集播放链接
                        const dedupKey = `${lineFullName}_${eps[0].playLink}`;
                        if (!seenLineKeys.has(dedupKey)) {
                            seenLineKeys.add(dedupKey);
                            allLines.push({
                                sourceId: `555_${card.id}_${idx}`,
                                sourceName: lineFullName,
                                is555: true,
                                episodes: eps
                            });
                        }
                    }
                    idx++;
                }
            } catch (err) {
                console.warn(`${TAG} 555详情解析异常 (ID=${card.id}):`, err);
            }
        }));

        return allLines;
    }

    // 核心：深度解析低端影视官方主站 (DDYS.app) 专属极速「亚太线路 (1080P/原画)」
    async function searchDDYSAppLine(keywords, targetTitle) {
        const host = 'https://ddys.app';
        let postPath = null;
        let matchedTitle = '';
        let bestScore = 0;

        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/?s=${encodeURIComponent(kw)}&post_type=post`, {
                    'Referer': 'https://ddys.app/'
                });
                if (!searchHtml) continue;
                if (searchHtml.includes('ddys-protect-gate') || searchHtml.includes('ddys-protect-panel')) {
                    console.log(`${TAG} [DDYS.app] 检测到官方门禁验证，跳过主站直接检索`);
                    return null;
                }

                const aRegex = /<a\s+[^>]*href="(?:https?:\/\/ddys\.app)?(\/[a-zA-Z0-9_\-\.]+\/)"[^>]*rel="bookmark"[^>]*>([\s\S]*?)<\/a>/gi;
                let m;
                while ((m = aRegex.exec(searchHtml)) !== null) {
                    const link = m[1];
                    if (/^\/(category|tag|author|page|member|search)\//i.test(link)) continue;
                    const title = m[2].replace(/<[^>]+>/g, '').trim();
                    const score = calculateMatchScore(title, targetTitle || kw, kw);
                    if (score > bestScore) {
                        bestScore = score;
                        postPath = link;
                        matchedTitle = title;
                        if (bestScore === 100) break;
                    }
                }
                if (bestScore === 100) break;
            } catch (e) {}
        }

        if (!postPath || bestScore < 50) return null;
        console.log(`${TAG} DDYS.app官方精准打分匹配: ${matchedTitle} (${postPath}), 得分=${bestScore}`);

        try {
            const detailHtml = await requestText(`${host}${postPath}`, {
                'Referer': 'https://ddys.app/'
            });
            if (!detailHtml || detailHtml.includes('ddys-protect-gate')) return null;

            const jsonMatch = detailHtml.match(/<script class="ddys-playlist-data" type="application\/json">([\s\S]*?)<\/script>/i);
            if (!jsonMatch) {
                console.log(`${TAG} DDYS.app《${matchedTitle}》未包含播放列表 JSON 数据`);
                return null;
            }

            const playlistData = JSON.parse(jsonMatch[1]);
            const seasons = playlistData.seasons || [];
            if (!seasons.length) return null;

            // 智能季数匹配：若影片有多个季，优先匹配目标季（例如第2季）
            let targetSeasonObj = null;
            if (seasons.length > 1 && targetTitle) {
                const sMatch = targetTitle.match(/第\s*([一二三四五六七八九十\d]+)\s*[季部]|Season\s*(\d+)/i);
                if (sMatch) {
                    const cnMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
                    const rawS = sMatch[1] || sMatch[2];
                    const targetSNum = cnMap[rawS] || parseInt(rawS, 10);
                    if (targetSNum) {
                        targetSeasonObj = seasons.find(s => s.season === targetSNum || (s.title && s.title.includes(String(targetSNum))));
                    }
                }
            }

            const activeSeasons = targetSeasonObj ? [targetSeasonObj] : seasons;
            const eps = [];

            for (const s of activeSeasons) {
                const tracks = s.tracks || [];
                for (let i = 0; i < tracks.length; i++) {
                    const t = tracks[i];
                    // 优先锁定用户指定的亚太线路 (v2)，若无则备用美国线路 (v3) 或默认源
                    const streamUrl = (t.nodeSources && (t.nodeSources.v2 || t.nodeSources.v3)) || t.src || '';
                    if (!streamUrl) continue;

                    const rawTitle = t.title ? t.title.trim() : '';
                    let num = t.episode ? String(t.episode) : '';
                    if (!num) {
                        const numMatch = rawTitle.match(/\d+/);
                        num = numMatch ? String(parseInt(numMatch[0], 10)) : String(eps.length + 1);
                    }

                    eps.push({
                        title: rawTitle || `第${num}集`,
                        num: num,
                        url: streamUrl
                    });
                }
            }

            if (eps.length === 0) return null;

            eps.sort((a, b) => {
                const na = parseInt(a.num, 10);
                const nb = parseInt(b.num, 10);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return 0;
            });

            return {
                sourceId: 'ddys_app_v2',
                sourceName: 'DDYS·亚太线路 (官方极速)',
                is555: false,
                isDDYSApp: true,
                vodName: matchedTitle,
                episodes: eps
            };
        } catch (err) {
            console.warn(`${TAG} DDYS.app官方详情解析异常:`, err);
            return null;
        }
    }

    // 核心：深度解析低端影视 (DDYS) 专属极清「播放源 2 (1080P)」
    async function searchDDYSLine(keywords, targetTitle) {
        const host = 'https://ddys.io';
        let moviePath = null;
        let matchedTitle = '';
        let bestScore = 0;

        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/search?q=${encodeURIComponent(kw)}`);
                const h3Regex = /<h3[^>]*>[\s\S]*?<a\s+href="(\/movie\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi;
                let m;
                while ((m = h3Regex.exec(searchHtml)) !== null) {
                    const link = m[1];
                    const title = m[2].replace(/<[^>]+>/g, '').trim();
                    const score = calculateMatchScore(title, targetTitle || kw, kw);
                    if (score > bestScore) {
                        bestScore = score;
                        moviePath = link;
                        matchedTitle = title;
                        if (bestScore === 100) break;
                    }
                }
                if (bestScore === 100) break;
            } catch (e) {}
        }

        if (!moviePath || bestScore < 50) return null;
        console.log(`${TAG} DDYS精准打分匹配影视: ${matchedTitle} (${moviePath}), 得分=${bestScore}`);

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
                sourceName: 'DDYS·播放源2',
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
    async function searchDDYSOneLine(keywords, targetTitle) {
        const host = 'https://ddys.one';
        let vodPath = null;
        let vodTitle = '';
        let bestScore = 0;

        for (const kw of keywords) {
            try {
                const searchHtml = await requestText(`${host}/?s=${encodeURIComponent(kw)}&post_type=post`, {
                    'Referer': 'https://ddys.one/'
                });
                const aRegex = /<a\s+href="(\/vod\/\d+\/)"\s+rel="bookmark">([\s\S]*?)<\/a>/gi;
                let m;
                while ((m = aRegex.exec(searchHtml)) !== null) {
                    const link = m[1];
                    const title = m[2].replace(/<[^>]+>/g, '').trim();
                    const score = calculateMatchScore(title, targetTitle || kw, kw);
                    if (score > bestScore) {
                        bestScore = score;
                        vodPath = link;
                        vodTitle = title;
                        if (bestScore === 100) break;
                    }
                }
                if (bestScore === 100) break;
            } catch (e) {}
        }

        if (!vodPath || bestScore < 50) return null;
        console.log(`${TAG} DDYS.one精准打分匹配影视: ${vodTitle} (${vodPath}), 得分=${bestScore}`);

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
                sourceName: 'DDYS·X节点',
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

        // 1. 并发请求 555 电影专属集群、低端影视官方 DDYS.app、低端影视 DDYS.io、低端影视 DDrk (DDYS.one)
        const [res555, resDDYSApp, resDDYS, resDDYSOne] = await Promise.allSettled([
            search555Lines(keywords, title),
            searchDDYSAppLine(keywords, title),
            searchDDYSLine(keywords, title),
            searchDDYSOneLine(keywords, title)
        ]);

        if (res555.status === 'fulfilled' && Array.isArray(res555.value) && res555.value.length > 0) {
            matchedSources.push(...res555.value);
            console.log(`${TAG} 成功载入 555 电影专属线路: ${res555.value.length} 条`);
        }

        if (resDDYSApp.status === 'fulfilled' && resDDYSApp.value) {
            matchedSources.push(resDDYSApp.value);
            console.log(`${TAG} 成功载入低端影视官方主站专属线路: ${resDDYSApp.value.sourceName} (${resDDYSApp.value.episodes.length} 集)`);
        }

        if (resDDYS.status === 'fulfilled' && resDDYS.value) {
            matchedSources.push(resDDYS.value);
            console.log(`${TAG} 成功载入低端影视专属线路: ${resDDYS.value.sourceName} (${resDDYS.value.episodes.length} 集)`);
        }

        if (resDDYSOne.status === 'fulfilled' && resDDYSOne.value) {
            matchedSources.push(resDDYSOne.value);
            console.log(`${TAG} 成功载入低端影视DDrk专属线路: ${resDDYSOne.value.sourceName} (${resDDYSOne.value.episodes.length} 集)`);
        }

        // 2. 极速快反熔断：若 555 或 DDYS 已成功检索到高品质线路，直接结束检索（通常仅耗时 0.8~1.8 秒）
        // 只有当 555/DDYS 未搜到或结果为空时，才启用第三方备用采集源并发检索
        if (matchedSources.length === 0) {
            console.log(`${TAG} 专属蓝光库未命中，启用第三方备用采集源并发检索...`);
            const kw = keywords[0] || title;
            const cmsTasks = SOURCES.map(async src => {
                try {
                    const data = await requestApi(src.api + encodeURIComponent(kw));
                    if (!data || !data.list || !data.list.length) return null;

                    let bestVod = null;
                    let bestScore = 0;
                    for (const vod of data.list) {
                        const score = calculateMatchScore(vod.vod_name, title || kw, kw);
                        if (score > bestScore) {
                            bestScore = score;
                            bestVod = vod;
                            if (bestScore === 100) break;
                        }
                    }

                    if (!bestVod || bestScore < 50 || !bestVod.vod_play_url) return null;
                    const matchedVod = bestVod;

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
                        return {
                            sourceId: src.id,
                            sourceName: src.name,
                            is555: false,
                            vodName: matchedVod.vod_name,
                            episodes: parsedPlaylists[0]
                        };
                    }
                } catch (err) {
                    return null;
                }
            });

            const cmsResults = await Promise.allSettled(cmsTasks);
            for (const r of cmsResults) {
                if (r.status === 'fulfilled' && r.value) {
                    matchedSources.push(r.value);
                }
            }
        }

        return matchedSources;
    }

    // =========================================================================
    // 4. 定位爱壹帆视频播放容器 (getBoundingClientRect 准确定位，排除首页轮播预告背景)
    // =========================================================================
    function findVideoContainer() {
        if (!isPlayPage()) return null;

        const video = document.querySelector('video:not(.artplayer-video):not(.yfsp-custom-video)');
        if (!video) return null;

        // 坚决排除首页轮播大图/预告片/背景视频
        if (video.closest('.banner, .carousel, .slide, .hero, .swiper, .top-recommend, .home-banner, .slider, [class*="banner"], [class*="swiper"], [class*="carousel"]')) {
            return null;
        }

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
        // 主页或非播放页坚决不展示换源按钮与播放遮罩，若有残留立即清理
        if (!isPlayPage()) {
            const toolbar = document.getElementById('yfsp-hd-toolbar');
            if (toolbar) toolbar.remove();
            const overlay = document.getElementById('yfsp-hd-overlay');
            if (overlay) overlay.remove();
            return;
        }

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
                        <span id="yfsp-hd-title-text" class="yfsp-hd-title">加载中...</span>
                    </div>
                    <div class="yfsp-hd-actions">
                        <div class="yfsp-hd-source-wrap">
                            <button id="yfsp-hd-source-btn" class="yfsp-hd-source-btn" type="button" title="点击切换播放线路">
                                <span id="yfsp-hd-source-name">正在加载线路...</span>
                                <svg class="yfsp-hd-arrow" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                            </button>
                            <div id="yfsp-hd-source-dropdown" class="yfsp-hd-source-dropdown"></div>
                        </div>
                        <button id="yfsp-hd-close-btn" class="yfsp-hd-close" type="button" title="返回爱壹帆原版播放">✕ 返回原版</button>
                    </div>
                </div>
                <div id="yfsp-artplayer-container" class="yfsp-artplayer-container">
                    <div id="yfsp-hd-loading-box" class="yfsp-hd-loading">
                        <div class="yfsp-hd-spinner"></div>
                        <div id="yfsp-hd-loading-text" class="yfsp-hd-loading-msg">正在为您检索真 1080P</div>
                    </div>
                </div>
            `;
            container.appendChild(overlay);

            // 绑定关闭按钮
            overlay.querySelector('#yfsp-hd-close-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deactivateHdPlayer();
            });

            // 绑定自定义毛玻璃线路下拉抽屉
            const sourceBtn = overlay.querySelector('#yfsp-hd-source-btn');
            const sourceDropdown = overlay.querySelector('#yfsp-hd-source-dropdown');
            if (sourceBtn && sourceDropdown) {
                sourceBtn.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                });
                sourceBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                sourceBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    sourceDropdown.classList.toggle('show');
                });
                sourceDropdown.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                });
                sourceDropdown.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                sourceDropdown.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                document.addEventListener('click', () => {
                    sourceDropdown.classList.remove('show');
                });
            }
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

    // 全局热键捕获（优先拦截空格键播放/暂停，防止被原生页面吸收或页面滚动跳动）
    window.addEventListener('keydown', (e) => {
        if (!isHdActive) return;

        // 避免在用户输入弹幕、搜索或评论时拦截
        const activeEl = document.activeElement;
        if (activeEl) {
            const tag = (activeEl.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || activeEl.isContentEditable) {
                return;
            }
        }

        // 1. 空格键：控制播放与暂停
        if (e.code === 'Space' || e.keyCode === 32) {
            e.preventDefault();
            e.stopPropagation();

            if (artInstance) {
                artInstance.isFocus = true;
                artInstance.toggle();
            } else {
                const customVideo = document.querySelector('.yfsp-custom-video');
                if (customVideo) {
                    if (customVideo.paused) {
                        customVideo.play().catch(() => {});
                    } else {
                        customVideo.pause();
                    }
                }
            }
            return;
        }

        // 2. 方向键：左/右步进快退快进，上/下调节音量
        if (artInstance) {
            artInstance.isFocus = true;
            if (e.code === 'ArrowLeft' || e.keyCode === 37) {
                e.preventDefault();
                e.stopPropagation();
                artInstance.backward = 5;
            } else if (e.code === 'ArrowRight' || e.keyCode === 39) {
                e.preventDefault();
                e.stopPropagation();
                artInstance.forward = 5;
            } else if (e.code === 'ArrowUp' || e.keyCode === 38) {
                e.preventDefault();
                e.stopPropagation();
                artInstance.volume = Math.min(1, (artInstance.volume || 0) + 0.1);
            } else if (e.code === 'ArrowDown' || e.keyCode === 40) {
                e.preventDefault();
                e.stopPropagation();
                artInstance.volume = Math.max(0, (artInstance.volume || 0) - 0.1);
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
        const title = currentVideoTitle || '当前影视';
        const hasEp = !isMovieMode && currentEpisodeNum;
        const epDisplay = hasEp ? ` - 第${currentEpisodeNum}集` : '';
        const searchMsg = hasEp ? `第 ${currentEpisodeNum} 集` : '正片';

        const titleText = document.getElementById('yfsp-hd-title-text');
        if (titleText) titleText.textContent = `${title}${epDisplay}`;

        showLoading(`正在为您检索《${title}》${searchMsg}真 1080P`);

        // 开始检索
        const matchedSources = await searchHighDefinitionStreams(title);

        if (!matchedSources || matchedSources.length === 0) {
            showErrorUI(`未能在第三方高清库中检索到《${title}》`, title);
            return;
        }

        currentMatchedList = matchedSources;

        // 核心评分模型：按【集数有效性 + 线路品质】重构优先级排序
        // 确保 555·极速蓝光-R 永远作为 Top 1 默认首选，555·极速蓝光-b 作为 Top 2 备选
        function getSourceWeight(source, ep) {
            let weight = 0;
            // 1. 目标集数有效性（若指定了集数，切实收录目标集的线路拥有 1000 分大权重门槛）
            if (ep) {
                const hasTargetEp = source.episodes && source.episodes.some(e => e.num === ep || (e.title && e.title.includes(ep)));
                if (hasTargetEp) weight += 1000;
            } else {
                weight += 1000;
            }

            const name = (source.sourceName || '').toLowerCase();
            // 2. 线路特定品质权重（用户定制优先级）：
            if (name.includes('极速蓝光-r') || name.includes('-r')) {
                weight += 100; // Top 1: 555·极速蓝光-R（默认首选起播线路）
            } else if (name.includes('亚太线路') || (source.sourceId && source.sourceId === 'ddys_app_v2')) {
                weight += 90; // Top 2: DDYS·亚太线路 (官方极速1080P/原画画质，延迟极低)
            } else if (name.includes('极速蓝光-b') || name.includes('-b')) {
                weight += 80; // Top 3: 555·极速蓝光-b（默认第二搜索备选源）
            } else if (name.includes('极速蓝光-js') || name.includes('-js')) {
                weight += 60; // Top 4: 555·极速蓝光-js
            } else if (name.includes('极速蓝光')) {
                weight += 50; // Top 5: 555·极速蓝光通用系列（-f, -s等）
            } else if (name.includes('高清蓝光') || name.includes('高清')) {
                weight += 40; // Top 6: 555·高清蓝光（降至极速系列之后）
            } else if (source.sourceId && source.sourceId.includes('ddys')) {
                weight += 30; // Top 7: 低端影视 DDYS 其他备用节点
            } else {
                weight += 10; // Top 8: 其他第三方独立采集源
            }

            return weight;
        }

        const targetEp = (!isMovieMode && currentEpisodeNum) ? currentEpisodeNum : '';
        matchedSources.sort((a, b) => getSourceWeight(b, targetEp) - getSourceWeight(a, targetEp));

        selectedSourceIndex = 0;

        // 自定义液体玻璃线路抽屉渲染
        function renderSourceDropdown(ep) {
            const btnName = document.getElementById('yfsp-hd-source-name');
            const dropdown = document.getElementById('yfsp-hd-source-dropdown');
            if (!dropdown || !matchedSources || !matchedSources.length) return;

            const cur = matchedSources[selectedSourceIndex] || matchedSources[0];
            let curBadge = '';
            if (ep) {
                const hasTarget = cur.episodes.some(e => e.num === ep || (e.title && e.title.includes(ep)));
                curBadge = hasTarget ? ` (含第${ep}集)` : ` (仅至第${cur.episodes.length}集)`;
            }
            if (btnName) btnName.textContent = `${cur.sourceName}${curBadge}`;

            dropdown.innerHTML = '';
            matchedSources.forEach((s, idx) => {
                let statusBadge = '';
                if (ep) {
                    const hasTarget = s.episodes.some(e => e.num === ep || (e.title && e.title.includes(ep)));
                    statusBadge = hasTarget ? ` (含第${ep}集)` : ` (仅至第${s.episodes.length}集)`;
                }
                const item = document.createElement('button');
                item.className = 'yfsp-hd-source-item' + (idx === selectedSourceIndex ? ' active' : '');
                item.type = 'button';
                const checkSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                item.innerHTML = `<span class="yfsp-hd-source-text">${s.sourceName}${statusBadge}</span>${idx === selectedSourceIndex ? `<span class="yfsp-hd-active-check">${checkSvg}</span>` : ''}`;
                item.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                });
                item.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    selectedSourceIndex = idx;
                    dropdown.classList.remove('show');
                    renderSourceDropdown(ep);
                    playCurrentEpisodeInHd();
                });
                dropdown.appendChild(item);
            });
        }

        renderSourceDropdown(targetEp);

        playCurrentEpisodeInHd();
    }

    // 状态与集数联动
    let hasSkippedOpening = false;
    let hasSkippedEnding = false;

    // 同步爱壹帆原生页面选集状态与浏览器地址栏
    function syncPageEpisodeState(targetEp) {
        try {
            const epButtons = Array.from(document.querySelectorAll(
                '.player-media-list a, .episode-item, .ep-item, .anthology-item, .series-item, [class*="episode-item"], [class*="ep-item"]'
            )).filter(el => !el.closest('.recommend, .related, .sidebar, .aside, [class*="recommend"], [class*="related"]'));

            let matchedBtn = null;
            for (const btn of epButtons) {
                const txt = (btn.textContent || '').trim();
                const m = txt.match(/(?:第\s*)?0*(\d{1,4})\s*(?:集|话|期)?/);
                if (m && parseInt(m[1], 10) === targetEp) {
                    matchedBtn = btn;
                    break;
                }
            }

            if (matchedBtn) {
                epButtons.forEach(b => b.classList.remove('active'));
                matchedBtn.classList.add('active');

                if (matchedBtn.scrollIntoView) {
                    matchedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }

                const href = matchedBtn.getAttribute('href');
                if (href && window.history && window.history.pushState) {
                    const newUrl = new URL(href, location.href).href;
                    if (newUrl !== location.href) {
                        window.history.pushState(null, '', newUrl);
                    }
                }
            }
        } catch (e) {
            console.warn(`${TAG} 同步网页选集状态异常:`, e);
        }
    }

    // 更新上一集/下一集按钮的置灰/启用状态与提示
    function updatePrevNextButtons() {
        if (isMovieMode || !artInstance) return;
        const curEp = parseInt(currentEpisodeNum || '1', 10);
        const isFirst = curEp <= 1;

        // 计算当前节目最大总集数（综合多源与页面信息）
        let maxTotalEp = 0;
        if (currentMatchedList && currentMatchedList.length) {
            currentMatchedList.forEach(s => {
                if (s.episodes) {
                    s.episodes.forEach(e => {
                        const n = parseInt(e.num, 10);
                        if (!isNaN(n)) maxTotalEp = Math.max(maxTotalEp, n);
                    });
                }
            });
        }
        const epButtons = Array.from(document.querySelectorAll(
            '.player-media-list a, .episode-item, .ep-item, .anthology-item, .series-item, [class*="episode-item"], [class*="ep-item"]'
        )).filter(el => !el.closest('.recommend, .related, .sidebar, .aside, [class*="recommend"], [class*="related"]'));
        epButtons.forEach(b => {
            const m = (b.textContent || '').match(/(?:第\s*)?0*(\d{1,4})\s*(?:集|话|期)?/);
            if (m) maxTotalEp = Math.max(maxTotalEp, parseInt(m[1], 10));
        });

        const isLast = maxTotalEp > 0 ? (curEp >= maxTotalEp) : false;

        const prevBtn = document.querySelector('.art-control-prev-ep');
        const nextBtn = document.querySelector('.art-control-next-ep');

        if (prevBtn) {
            const svg = prevBtn.querySelector('svg');
            const path = prevBtn.querySelector('path');
            if (isFirst) {
                prevBtn.classList.add('art-control-disabled');
                prevBtn.title = '已是第一集';
                if (svg) svg.setAttribute('fill', '#737373');
                if (path) path.setAttribute('fill', '#737373');
            } else {
                prevBtn.classList.remove('art-control-disabled');
                prevBtn.title = `上一集 (第${curEp - 1}集)`;
                if (svg) svg.setAttribute('fill', '#ffffff');
                if (path) path.setAttribute('fill', '#ffffff');
            }
        }

        if (nextBtn) {
            const svg = nextBtn.querySelector('svg');
            const path = nextBtn.querySelector('path');
            if (isLast) {
                nextBtn.classList.add('art-control-disabled');
                nextBtn.title = '已是最新集';
                if (svg) svg.setAttribute('fill', '#737373');
                if (path) path.setAttribute('fill', '#737373');
            } else {
                nextBtn.classList.remove('art-control-disabled');
                nextBtn.title = `下一集 (第${curEp + 1}集)`;
                if (svg) svg.setAttribute('fill', '#ffffff');
                if (path) path.setAttribute('fill', '#ffffff');
            }
        }
    }

    // 方案 A：平滑秒级换集起播 (全屏观影不打断，静默同步页面状态)
    async function switchToEpisode(targetEpNum) {
        if (isMovieMode) return;
        const targetEp = parseInt(targetEpNum, 10);
        if (isNaN(targetEp) || targetEp < 1) return;

        console.log(`${TAG} 正在切换至第 ${targetEp} 集...`);

        // 立即硬暂停旧视频与旧音频，坚决消除换集期间的旧声音泄露
        if (artInstance) {
            try {
                artInstance.pause();
                if (artInstance.video) {
                    artInstance.video.pause();
                    artInstance.video.muted = true; // 强制静音，杜绝残响
                }
                if (artInstance.loading) {
                    artInstance.loading.show = true;
                }
                artInstance.notice.show = `正在载入第 ${targetEp} 集...`;
            } catch (e) {}
        }

        currentEpisodeNum = String(targetEp);
        lastProgressTime = 0;
        hasSkippedOpening = false;
        hasSkippedEnding = false;

        // 联动爱壹帆原生页面选集状态与浏览器地址栏
        syncPageEpisodeState(targetEp);

        // 调度播放器换集起播
        await playCurrentEpisodeInHd();

        // 更新按钮状态
        updatePrevNextButtons();
    }

    // 播放指定集数 (支持 555 线路即点即解与高速缓存)
    async function playCurrentEpisodeInHd() {
        if (!currentMatchedList || !currentMatchedList.length) return;
        const currentSource = currentMatchedList[selectedSourceIndex] || currentMatchedList[0];

        let matchedEp = null;
        if (isMovieMode || !currentEpisodeNum) {
            // 电影单片模式：优先匹配标题包含“正片/HD/BD”的切片，或首个切片
            matchedEp = currentSource.episodes.find(e => e.title && (e.title.includes('正片') || e.title.includes('HD') || e.title.includes('BD'))) || currentSource.episodes[0];
        } else {
            const targetEp = currentEpisodeNum || '1';
            matchedEp = currentSource.episodes.find(e => e.num === targetEp);

            // 容错 1：按单集标题精准包含（如 "第17集"、"第17话"）
            if (!matchedEp) {
                matchedEp = currentSource.episodes.find(e => {
                    const t = e.title || '';
                    return t === `第${targetEp}集` || t === `第${targetEp}话` || t === targetEp || t.includes(`第${targetEp}集`);
                });
            }

            // 容错 2：带边界的安全数字匹配（杜绝 1 误匹配 17）
            if (!matchedEp) {
                const epRegex = new RegExp(`(?:^|[^0-9])${targetEp}(?:[^0-9]|$)`);
                matchedEp = currentSource.episodes.find(e => epRegex.test(e.title || ''));
            }

            // 容错 3：按集数序号安全索引（仅在该线路实际总集数充足时允许）
            if (!matchedEp && currentSource.episodes.length >= parseInt(targetEp, 10)) {
                const idx = parseInt(targetEp, 10) - 1;
                if (currentSource.episodes[idx]) {
                    matchedEp = currentSource.episodes[idx];
                }
            }
        }

        if (!matchedEp) {
            const targetEp = currentEpisodeNum || '1';
            // 如果当前选中的线路确实没有该集（例如555暂未更新），自动探测其他收录该集的可用线路
            const alternativeIdx = currentMatchedList.findIndex(s => s.episodes.some(e => e.num === targetEp || (e.title && e.title.includes(targetEp))));
            if (alternativeIdx !== -1 && alternativeIdx !== selectedSourceIndex) {
                console.log(`${TAG} [${currentSource.sourceName}] 暂未更新第 ${targetEp} 集，自动优选已收录该集的线路: [${currentMatchedList[alternativeIdx].sourceName}]`);
                selectedSourceIndex = alternativeIdx;
                const btnName = document.getElementById('yfsp-hd-source-name');
                if (btnName && currentMatchedList[selectedSourceIndex]) {
                    btnName.textContent = currentMatchedList[selectedSourceIndex].sourceName;
                }
                playCurrentEpisodeInHd();
                return;
            }

            const errLabel = isMovieMode ? '正片' : `第 ${targetEp} 集 (该源目前仅收录至第 ${currentSource.episodes.length} 集)`;
            showErrorUI(`在 [${currentSource.sourceName}] 中未找到${errLabel}切片，请切换其他已更新线路`, currentVideoTitle);
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
        if (titleText) {
            if (isMovieMode) {
                // 电影模式：若标题是“正片”或原片名，友好展示；若为“第1集”等上游模板字样则省略，保持纯净电影标题
                const isGenericEp = /^(第\s*1\s*集|0?1)$/.test((matchedEp.title || '').trim());
                const epSuffix = isGenericEp ? '' : ` - ${matchedEp.title}`;
                titleText.textContent = `${currentVideoTitle}${epSuffix}`;
            } else {
                // 电视剧/动漫/综艺连载模式：严格规范统一为 【XXX - 第N集】
                let epLabel = matchedEp.title ? matchedEp.title.trim() : '';
                const epNumMatch = epLabel.match(/(\d+)/);
                if (epNumMatch) {
                    const n = parseInt(epNumMatch[1], 10);
                    epLabel = `第${n}集`;
                } else if (currentEpisodeNum) {
                    epLabel = `第${currentEpisodeNum}集`;
                }
                titleText.textContent = epLabel ? `${currentVideoTitle} - ${epLabel}` : currentVideoTitle;
            }
        }

        // 刷新右上角线路徽标
        const sourceBtnName = document.getElementById('yfsp-hd-source-name');
        if (sourceBtnName && currentSource) {
            const curEp = currentEpisodeNum || '1';
            const hasTarget = currentSource.episodes.some(e => e.num === curEp || (e.title && e.title.includes(curEp)));
            const curBadge = isMovieMode ? '' : (hasTarget ? ` (含第${curEp}集)` : ` (仅至第${currentSource.episodes.length}集)`);
            sourceBtnName.textContent = `${currentSource.sourceName}${curBadge}`;
        }

        renderPlayer(matchedEp.url);
    }

    // 渲染播放器 (Artplayer 优先，原生 Hls/MP4 自动兜底，进度无缝承接，支持平滑换集不退出全屏)
    function renderPlayer(m3u8Url) {
        const container = document.getElementById('yfsp-artplayer-container');
        if (!container) return;

        const isMp4 = m3u8Url.includes('.mp4') || (!m3u8Url.includes('.m3u8') && !m3u8Url.includes('m3u8'));

        // 方案 A 核心：如果播放器实例已存在且完整挂载于页面，无刷新平滑秒切流（全屏观影不被打断，进度归零）
        const isArtInDom = container.querySelector('.art-video-player');
        if (artInstance && artInstance.video && isArtInDom) {
            artInstance.notice.show = `正在载入第 ${currentEpisodeNum} 集...`;
            if (artInstance.video) {
                artInstance.video.muted = false; // 恢复有声播放
            }
            artInstance.switchUrl(m3u8Url, isMp4 ? 'mp4' : 'm3u8').then(() => {
                if (artInstance.loading) {
                    artInstance.loading.show = false;
                }
                artInstance.play();
                updatePrevNextButtons();
                const skipOpening = parseInt(GM_getValue('yfsp_skip_opening', 0), 10) || 0;
                if (skipOpening > 0) {
                    artInstance.currentTime = skipOpening;
                    artInstance.notice.show = `已为您自动跳过片头 ${skipOpening} 秒`;
                }
            }).catch(e => {
                console.warn(`${TAG} switchUrl 平滑切流受阻，执行实例重建:`, e);
                rebuildArtPlayer(container, m3u8Url);
            });
            return;
        }

        rebuildArtPlayer(container, m3u8Url);
    }

    // 全量构建/重建 ArtPlayer 实例
    function rebuildArtPlayer(container, m3u8Url) {
        // 清理旧播放器
        if (artInstance) {
            try { artInstance.destroy(); } catch (e) {}
            artInstance = null;
        }
        container.innerHTML = '';

        const isMp4 = m3u8Url.includes('.mp4') || (!m3u8Url.includes('.m3u8') && !m3u8Url.includes('m3u8'));

        // 统一的高鲁棒性 Hls.js 抗失真引擎（全源继承：专攻贴片广告切片导致的音频采样率突变与海量伪断点干扰）
        const createTunedHls = () => {
            if (typeof Hls === 'undefined' || !Hls.isSupported()) return null;
            const hls = new Hls({
                enableWorker: false, // 禁用 Worker 跨线程解封装，避免跨线程音频时钟漂移
                lowLatencyMode: false,
                maxAudioFramesDrift: 4, // 允许适度容忍4帧微漂移，由播放器平滑对齐，杜绝硬拉伸变调
                forceKeyFrameOnDiscontinuity: true, // 核心：断点强制对齐关键帧，彻底根治插播广告引发的变声
                backBufferLength: 15, // 及时释放已播放旧切片缓冲区，避免多断点导致 SourceBuffer 碎片累积与声卡时钟崩溃
                appendErrorMaxRetry: 5,
                autoStartLoad: true,
                pLoader: class extends Hls.DefaultConfig.loader {
                    load(context, config, callbacks) {
                        const origSuccess = callbacks.onSuccess;
                        callbacks.onSuccess = function (response, stats, ctx, networkDetails) {
                            if (typeof response.data === 'string') {
                                const text = response.data;
                                const discMatches = text.match(/#EXT-X-DISCONTINUITY/g);
                                const discCount = discMatches ? discMatches.length : 0;
                                // 核心自愈：当检测到切片流中伪断点超标（如极速蓝光-ws等源人为注入上百个断点）时，自动剥离伪断点保持连续播放轴，杜绝音频解码时钟崩溃变声
                                if (discCount > 3 || (discCount > 0 && ctx && ctx.url && (ctx.url.includes('wsyzy') || ctx.url.includes('ws')))) {
                                    response.data = text.replace(/#EXT-X-DISCONTINUITY\r?\n?/g, '');
                                    console.log(`${TAG} [音频自愈引擎] 捕获切片伪断点干扰 (${discCount}处)，已智能平滑净化 m3u8，彻底根除音频失真！`);
                                }
                            }
                            origSuccess.call(this, response, stats, ctx, networkDetails);
                        };
                        super.load(context, config, callbacks);
                    }
                }
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
            const applyLock = () => {
                try {
                    video.preservesPitch = true;
                    if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = true;
                    if ('mozPreservesPitch' in video) video.mozPreservesPitch = true;
                } catch (e) {}
            };
            applyLock();
            if (!video._pitchLocked) {
                video._pitchLocked = true;
                video.addEventListener('play', applyLock);
                video.addEventListener('loadedmetadata', applyLock);
                video.addEventListener('ratechange', applyLock);
            }
        };

        // 方式 1: 优先使用 Artplayer
        if (typeof Artplayer !== 'undefined') {
            try {
                artInstance = new Artplayer({
                    container: container,
                    url: m3u8Url,
                    type: isMp4 ? 'mp4' : 'm3u8',
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
                        },
                        mp4: function (video, url, art) {
                            lockAudioPitch(video);
                            video.src = url;
                        }
                    },
                    theme: '#ffffff',
                    autoplay: true,
                    autoSize: true,
                    i18n: {
                        'zh-cn': {
                            'Show Setting': '设置',
                            'Hide Setting': '设置'
                        }
                    },
                    playbackRate: false,
                    aspectRatio: false,
                    miniProgressBar: false,
                    setting: true,
                    settings: [
                        {
                            icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/><circle cx="12" cy="14" r="2"/></svg>',
                            width: 184,
                            html: '倍速',
                            tooltip: '1.0×',
                            selector: [
                                { html: '0.5×', value: 0.5 },
                                { html: '0.75×', value: 0.75 },
                                { default: true, html: '1.0×', value: 1.0 },
                                { html: '1.25×', value: 1.25 },
                                { html: '1.5×', value: 1.5 },
                                { html: '2.0×', value: 2.0 }
                            ],
                            onSelect: function (item) {
                                artInstance.playbackRate = item.value;
                                return item.html;
                            }
                        },
                        {
                            icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="5" x2="3" y2="19"/><polygon points="8 5 15 12 8 19 8 5"/><polygon points="14 5 21 12 14 19 14 5"/></svg>',
                            width: 184,
                            html: '跳过片头',
                            tooltip: GM_getValue('yfsp_skip_opening', 0) ? `${GM_getValue('yfsp_skip_opening', 0)}秒` : '关闭',
                            selector: [
                                { default: !GM_getValue('yfsp_skip_opening', 0), html: '关闭', value: 0 },
                                { default: GM_getValue('yfsp_skip_opening', 0) === 60, html: '跳过 60 秒', value: 60 },
                                { default: GM_getValue('yfsp_skip_opening', 0) === 90, html: '跳过 90 秒', value: 90 },
                                { default: GM_getValue('yfsp_skip_opening', 0) === 100, html: '跳过 100 秒', value: 100 },
                                { default: GM_getValue('yfsp_skip_opening', 0) === 120, html: '跳过 120 秒', value: 120 }
                            ],
                            onSelect: function (item) {
                                GM_setValue('yfsp_skip_opening', item.value);
                                return item.value ? `${item.value}秒` : '关闭';
                            }
                        },
                        {
                            icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 5 10 12 3 19 3 5"/><polygon points="9 5 16 12 9 19 9 5"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="21" y1="5" x2="21" y2="19"/></svg>',
                            width: 184,
                            html: '跳过片尾',
                            tooltip: GM_getValue('yfsp_skip_ending', 0) ? `${GM_getValue('yfsp_skip_ending', 0)}秒` : '关闭',
                            selector: [
                                { default: !GM_getValue('yfsp_skip_ending', 0), html: '关闭', value: 0 },
                                { default: GM_getValue('yfsp_skip_ending', 0) === 60, html: '跳过 60 秒', value: 60 },
                                { default: GM_getValue('yfsp_skip_ending', 0) === 90, html: '跳过 90 秒', value: 90 },
                                { default: GM_getValue('yfsp_skip_ending', 0) === 120, html: '跳过 120 秒', value: 120 }
                            ],
                            onSelect: function (item) {
                                GM_setValue('yfsp_skip_ending', item.value);
                                return item.value ? `${item.value}秒` : '关闭';
                            }
                        }
                    ],
                    hotkey: true,
                    pip: true,
                    fullscreen: true,
                    fullscreenWeb: false,
                    miniProgressBar: false,
                    playsInline: true,
                    autoPlayback: true,
                    controls: (!isMovieMode && currentEpisodeNum) ? [
                        {
                            name: 'prev-ep',
                            position: 'left',
                            index: 1,
                            html: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1zm11.23 1.34a1.2 1.2 0 0 1 1.77 1.04v9.24a1.2 1.2 0 0 1-1.77 1.04l-7.7-4.62a1.2 1.2 0 0 1 0-2.08l7.7-4.62z" fill="${parseInt(currentEpisodeNum || '1', 10) <= 1 ? '#737373' : '#ffffff'}"/></svg>`,
                            tooltip: parseInt(currentEpisodeNum || '1', 10) <= 1 ? '已是第一集' : '上一集',
                            click: function () {
                                const cur = parseInt(currentEpisodeNum || '1', 10);
                                const prevBtn = document.querySelector('.art-control-prev-ep');
                                if (cur <= 1 || (prevBtn && prevBtn.classList.contains('art-control-disabled'))) {
                                    if (artInstance && artInstance.notice) artInstance.notice.show = '已是第一集';
                                    return;
                                }
                                switchToEpisode(cur - 1);
                            }
                        },
                        {
                            name: 'next-ep',
                            position: 'left',
                            index: 3,
                            html: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1zM6.77 6.34A1.2 1.2 0 0 0 5 7.38v9.24a1.2 1.2 0 0 0 1.77 1.04l7.7-4.62a1.2 1.2 0 0 0 0-2.08l-7.7-4.62z" fill="#ffffff"/></svg>',
                            tooltip: '下一集',
                            click: function () {
                                const cur = parseInt(currentEpisodeNum || '1', 10);
                                const nextBtn = document.querySelector('.art-control-next-ep');
                                if (nextBtn && nextBtn.classList.contains('art-control-disabled')) {
                                    if (artInstance && artInstance.notice) artInstance.notice.show = '已是最新集';
                                    return;
                                }
                                switchToEpisode(cur + 1);
                            }
                        }
                    ] : []
                });

                // 进度无缝承接与双重静音保障
                artInstance.on('ready', () => {
                    artInstance.isFocus = true;
                    if (artInstance.video) {
                        lockAudioPitch(artInstance.video);
                    }
                    if (lastProgressTime > 0) {
                        console.log(`${TAG} 1080P 播放器就绪，自动无缝跳至进度: ${lastProgressTime.toFixed(1)} 秒`);
                        artInstance.currentTime = lastProgressTime;
                    }
                    muteAndPauseAllNativeVideos();
                    updatePrevNextButtons();
                });

                // 自动化跳过片头与片尾
                artInstance.on('video:timeupdate', () => {
                    const skipOpening = parseInt(GM_getValue('yfsp_skip_opening', 0), 10) || 0;
                    if (skipOpening > 0 && !hasSkippedOpening && artInstance.currentTime < skipOpening && artInstance.currentTime > 0) {
                        hasSkippedOpening = true;
                        artInstance.currentTime = skipOpening;
                        artInstance.notice.show = `已为您自动跳过片头 ${skipOpening} 秒`;
                    }

                    const skipEnding = parseInt(GM_getValue('yfsp_skip_ending', 0), 10) || 0;
                    if (skipEnding > 0 && !hasSkippedEnding && artInstance.duration > 0 && (artInstance.duration - artInstance.currentTime) <= skipEnding) {
                        hasSkippedEnding = true;
                        if (!isMovieMode && currentEpisodeNum) {
                            const curEp = parseInt(currentEpisodeNum, 10);
                            artInstance.notice.show = `已到达片尾，自动播放下一集...`;
                            setTimeout(() => {
                                switchToEpisode(curEp + 1);
                            }, 800);
                        } else {
                            artInstance.notice.show = '已到达片尾';
                            artInstance.currentTime = artInstance.duration - 0.5;
                        }
                    }
                });

                // 双模式自愈控制流（未全屏：滑动进窗即显、移出立退；全屏：视口底部140px宽幅热区感应与平滑升退）
                let autoHideTimer = null;
                let cursorTimer = null;
                let isDraggingControl = false;
                let isControlsAwake = true;

                const getPlayerEl = () => {
                    if (artInstance && artInstance.template && artInstance.template.$player) {
                        return artInstance.template.$player;
                    }
                    return document.querySelector('.art-video-player') || container;
                };

                const getIsFullscreen = () => {
                    return !!(
                        (artInstance && (artInstance.fullscreen || artInstance.fullscreenWeb)) ||
                        document.fullscreenElement ||
                        document.webkitFullscreenElement ||
                        document.mozFullScreenElement ||
                        document.msFullscreenElement ||
                        (artInstance && artInstance.template && artInstance.template.$player && artInstance.template.$player.classList.contains('art-fullscreen')) ||
                        (container && container.classList.contains('art-fullscreen'))
                    );
                };

                const hideControls = () => {
                    if (!artInstance || !artInstance.playing) return;
                    if (artInstance.setting && artInstance.setting.show) return;
                    if (isDraggingControl) return;

                    const pEl = getPlayerEl();
                    if (pEl) {
                        pEl.classList.add('yfsp-controls-hidden');
                        if (getIsFullscreen()) {
                            pEl.classList.add('yfsp-cursor-hidden');
                        }
                    }
                    const overlay = document.getElementById('yfsp-hd-overlay');
                    if (overlay) overlay.classList.add('yfsp-controls-hidden');
                    isControlsAwake = false;
                };

                const wakeControls = () => {
                    const pEl = getPlayerEl();
                    if (pEl) {
                        pEl.classList.remove('yfsp-controls-hidden');
                        pEl.classList.remove('yfsp-cursor-hidden');
                    }
                    if (container) {
                        container.classList.remove('yfsp-controls-hidden');
                        container.classList.remove('yfsp-cursor-hidden');
                    }
                    const domPlayer = document.querySelector('.art-video-player');
                    if (domPlayer && domPlayer !== pEl) {
                        domPlayer.classList.remove('yfsp-controls-hidden');
                        domPlayer.classList.remove('yfsp-cursor-hidden');
                    }
                    const overlay = document.getElementById('yfsp-hd-overlay');
                    if (overlay) overlay.classList.remove('yfsp-controls-hidden');
                    if (autoHideTimer) {
                        clearTimeout(autoHideTimer);
                        autoHideTimer = null;
                    }
                    isControlsAwake = true;
                };

                const scheduleRetreat = (delay = 600) => {
                    if (!artInstance || !artInstance.playing) return;
                    // 非全屏模式下：只要鼠标在播放器区域内，完全不执行倒计时休眠，保持常显！
                    if (!getIsFullscreen()) return;
                    if (artInstance.setting && artInstance.setting.show) return;
                    const sourceDropdown = document.getElementById('yfsp-hd-source-dropdown');
                    if (sourceDropdown && sourceDropdown.classList.contains('show')) return;
                    if (isDraggingControl) return;

                    if (autoHideTimer) clearTimeout(autoHideTimer);
                    autoHideTimer = setTimeout(hideControls, delay);
                };

                const showCursor = () => {
                    const pEl = getPlayerEl();
                    if (pEl) pEl.classList.remove('yfsp-cursor-hidden');
                    if (cursorTimer) clearTimeout(cursorTimer);
                    if (artInstance && artInstance.playing && getIsFullscreen()) {
                        cursorTimer = setTimeout(() => {
                            if (!isControlsAwake && pEl) {
                                pEl.classList.add('yfsp-cursor-hidden');
                            }
                        }, 2000);
                    }
                };

                // 统一鼠标交互路由中心（严格区分未全屏与全屏模式）
                const handleUnifiedMouseMove = (e) => {
                    if (!e) return;
                    showCursor();

                    // 【模式 A: 非全屏窗口模式】
                    // 核心原则：只要鼠标物理坐标在播放框矩形内，无论在哪个像素点，全部保持100%常驻，绝无抖动闪现！
                    // 离开播放框矩形范围，立即平滑隐退。
                    if (!getIsFullscreen()) {
                        const rect = container.getBoundingClientRect();
                        const isInBox = (
                            e.clientX >= rect.left &&
                            e.clientX <= rect.right &&
                            e.clientY >= rect.top &&
                            e.clientY <= rect.bottom
                        );

                        if (isInBox) {
                            wakeControls();
                        } else {
                            const sourceDropdown = document.getElementById('yfsp-hd-source-dropdown');
                            if (sourceDropdown && sourceDropdown.classList.contains('show')) return;
                            if (artInstance && artInstance.playing && !isDraggingControl) {
                                hideControls();
                            }
                        }
                        return;
                    }

                    // 【模式 B: 全屏沉浸模式】（顶部 100px 与底部 140px 热区唤醒，视线中央自动平滑休眠）
                    if (artInstance && !artInstance.playing) {
                        wakeControls();
                        return;
                    }

                    const screenH = window.innerHeight || screen.height;
                    const distanceFromBottom = screenH - e.clientY;
                    const isNearBottomHotzone = (distanceFromBottom >= -10 && distanceFromBottom <= 140);
                    const isNearTopHotzone = (e.clientY <= 100);

                    if (!isControlsAwake) {
                        if (isNearBottomHotzone || isNearTopHotzone) {
                            wakeControls();
                            scheduleRetreat(2500);
                        }
                    } else {
                        const target = e.target;
                        const isOverTop = e.clientY <= 100;
                        const isOverPanel = target && target.closest && target.closest('.art-volume-panel, .art-control-volume, .art-settings, .yfsp-hd-header, .yfsp-hd-source-dropdown');

                        if (isNearBottomHotzone || isOverTop || isOverPanel || isDraggingControl) {
                            wakeControls();
                            scheduleRetreat(2500);
                        } else {
                            scheduleRetreat(600);
                        }
                    }
                };

                // 统一挂载在全局 document 与 window 上，杜绝内部 DOM 嵌套导致 mouseleave 误判闪烁
                document.addEventListener('mousemove', handleUnifiedMouseMove, { passive: true });
                window.addEventListener('mousemove', handleUnifiedMouseMove, { passive: true });

                // 鼠标直接离开浏览器视口时收起
                document.addEventListener('mouseleave', () => {
                    if (!getIsFullscreen()) {
                        const sourceDropdown = document.getElementById('yfsp-hd-source-dropdown');
                        if (sourceDropdown && sourceDropdown.classList.contains('show')) return;
                        if (artInstance && artInstance.playing && !isDraggingControl) {
                            hideControls();
                        }
                    }
                });

                // 模式 B: 全屏模式（底部 140px 宽幅黄金热区感应与平滑升退）
                // 全屏状态变动联动：进出全屏即刻呼出底栏并在 2.5 秒后平滑沉退
                const onFullscreenChange = () => {
                    wakeControls();
                    scheduleRetreat(2500);
                };
                artInstance.on('fullscreen', onFullscreenChange);
                artInstance.on('fullscreenWeb', onFullscreenChange);
                document.addEventListener('fullscreenchange', onFullscreenChange, { passive: true });
                document.addEventListener('webkitfullscreenchange', onFullscreenChange, { passive: true });

                // 播放/暂停状态联动：暂停时持续常驻显示控制栏，播放时启动自动休眠倒计时
                artInstance.on('play', () => {
                    if (getIsFullscreen()) {
                        scheduleRetreat(1000);
                    }
                });
                artInstance.on('pause', () => {
                    wakeControls();
                });
                artInstance.on('video:ended', () => {
                    wakeControls();
                    if (!isMovieMode && currentEpisodeNum) {
                        const curEp = parseInt(currentEpisodeNum, 10);
                        artInstance.notice.show = `本集播放完毕，自动播放下一集...`;
                        setTimeout(() => {
                            switchToEpisode(curEp + 1);
                        }, 1200);
                    }
                });

                // 设置菜单联动：展开菜单时保持常显，收起后恢复沉退逻辑；并主动为原生未设 viewBox 的箭头补齐属性防止矢量切角
                const fixSettingSvgs = () => {
                    try {
                        const svgs = container.querySelectorAll('.art-settings .art-setting-item-right-icon svg, .art-settings .art-setting-item-back svg');
                        svgs.forEach(svg => {
                            if (!svg.getAttribute('viewBox')) {
                                svg.setAttribute('viewBox', '0 0 32 32');
                            }
                        });
                    } catch (e) {}
                };
                artInstance.on('setting', (show) => {
                    if (show) {
                        wakeControls();
                        setTimeout(fixSettingSvgs, 20);
                    } else {
                        scheduleRetreat(600);
                    }
                });

                // 鼠标交互：按住拖拽进度条或音量时不触发隐藏
                container.addEventListener('mousedown', () => { 
                    isDraggingControl = true; 
                    wakeControls(); 
                });
                window.addEventListener('mouseup', () => { 
                    isDraggingControl = false; 
                    scheduleRetreat(600); 
                });

                // 初始化时即刻同步首尾集置灰状态，呼出底栏并在 2.5 秒后无缝沉退
                updatePrevNextButtons();
                setTimeout(updatePrevNextButtons, 50);
                setTimeout(updatePrevNextButtons, 200);
                setTimeout(updatePrevNextButtons, 500);
                wakeControls();
                scheduleRetreat(2500);
                return;
            } catch (err) {
                console.warn(`${TAG} Artplayer 初始化异常，降级为原生 Hls 播放:`, err);
            }
        }

        // 方式 2: 原生 HTML5 Video + Hls.js 坚固兜底
        console.log(`${TAG} 使用原生 HTML5 Video + Hls/MP4 渲染`);
        const videoEl = document.createElement('video');
        videoEl.className = 'yfsp-custom-video';
        videoEl.controls = true;
        videoEl.autoplay = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.backgroundColor = '#000';
        lockAudioPitch(videoEl);
        container.appendChild(videoEl);

        const fallbackHls = !isMp4 ? createTunedHls() : null;
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

    // 辅助界面：加载中状态 (当播放器已就绪挂载时绝不破坏现有 DOM，使用 Artplayer 原生 notice 与 loading 浮层)
    function showLoading(msg) {
        const container = document.getElementById('yfsp-artplayer-container');
        const isArtInDom = container && container.querySelector('.art-video-player');
        if (artInstance && artInstance.video && isArtInDom) {
            try {
                artInstance.pause();
                if (artInstance.video) {
                    artInstance.video.pause();
                    artInstance.video.muted = true;
                }
                artInstance.notice.show = msg;
                if (artInstance.loading) {
                    artInstance.loading.show = true;
                }
            } catch (e) {}
            return;
        }
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
        if (artInstance) {
            try { artInstance.destroy(); } catch (e) {}
            artInstance = null;
        }
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
        if (!isPlayPage()) {
            if (isHdActive) deactivateHdPlayer();
            const toolbar = document.getElementById('yfsp-hd-toolbar');
            if (toolbar) toolbar.remove();
            const overlay = document.getElementById('yfsp-hd-overlay');
            if (overlay) overlay.remove();
            return;
        }
        detectVideoInfoFromDOM();
        injectUI();
        if (isHdActive && !isMovieMode && currentEpisodeNum && currentEpisodeNum !== lastEp) {
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
            currentVideoTitle = '';
            currentEpisodeNum = '';
            isMovieMode = false;
            lastEp = '';
            if (!isPlayPage()) {
                if (isHdActive) deactivateHdPlayer();
                const toolbar = document.getElementById('yfsp-hd-toolbar');
                if (toolbar) toolbar.remove();
                const overlay = document.getElementById('yfsp-hd-overlay');
                if (overlay) overlay.remove();
            }
            setTimeout(scheduleRefresh, 600);
        }
        if (isPlayPage()) {
            detectVideoInfoFromDOM();
            injectUI();
        } else {
            const toolbar = document.getElementById('yfsp-hd-toolbar');
            if (toolbar) toolbar.remove();
            const overlay = document.getElementById('yfsp-hd-overlay');
            if (overlay) overlay.remove();
        }

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
                height: 90px;
                box-sizing: border-box;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding: 16px 24px;
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                z-index: 99;
                pointer-events: auto;
                /* 从上往下极淡渐变遮罩，保护亮画面下的标题可读性 */
                background: linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.22) 50%, transparent 100%) !important;
                transition: opacity 0.25s ease !important;
                opacity: 1 !important;
            }

            /* 跟随控制栏同步淡出隐藏 */
            .yfsp-hd-overlay.yfsp-controls-hidden .yfsp-hd-header,
            .art-video-player.yfsp-controls-hidden ~ .yfsp-hd-header,
            .yfsp-hd-overlay:has(.yfsp-controls-hidden) .yfsp-hd-header {
                opacity: 0 !important;
                pointer-events: none !important;
            }
            /* 但如果线路下拉框处于展开状态，强制保持常驻，绝不可淡出或丢失交互 */
            .yfsp-hd-overlay:has(#yfsp-hd-source-dropdown.show) .yfsp-hd-header,
            .yfsp-hd-overlay.yfsp-controls-hidden:has(#yfsp-hd-source-dropdown.show) .yfsp-hd-header {
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            .yfsp-hd-info {
                pointer-events: auto;
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 4px 0 !important;
                display: flex;
                align-items: center;
            }
            .yfsp-hd-title {
                font-size: 15px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
                letter-spacing: 0.4px !important;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65), 0 0 2px rgba(0, 0, 0, 0.8) !important;
                user-select: none;
            }
            .yfsp-hd-actions {
                pointer-events: auto;
                display: flex;
                align-items: center;
                gap: 16px;
            }
            .yfsp-hd-source-wrap {
                position: relative;
                pointer-events: auto;
                z-index: 100;
            }
            .yfsp-hd-source-btn {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 4px 6px !important;
                color: #ffffff;
                font-size: 13px !important;
                font-weight: 500 !important;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                opacity: 0.88 !important;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65), 0 0 2px rgba(0, 0, 0, 0.8) !important;
                transition: opacity 0.2s ease, transform 0.2s ease !important;
            }
            .yfsp-hd-source-btn:hover {
                opacity: 1 !important;
                background: transparent !important;
                transform: none !important;
                filter: brightness(1.2) !important;
            }
            .yfsp-hd-source-btn .yfsp-hd-arrow {
                stroke: #ffffff !important;
                filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.65)) !important;
                transition: transform 0.2s ease;
            }
            .yfsp-hd-source-dropdown {
                position: absolute;
                top: calc(100% + 6px);
                right: 0;
                width: 240px;
                max-height: 280px;
                overflow-y: auto;
                overflow-x: hidden;
                border-radius: 16px;
                /* 暖暗温润高透底色，完美贴合视频画面暖调 */
                background: rgba(28, 24, 22, 0.38) !important;
                backdrop-filter: blur(32px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(32px) saturate(200%) !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.22) !important;
                padding: 6px 8px;
                display: none;
                flex-direction: column;
                gap: 3px;
                z-index: 100;
                /* 优雅收敛微细半透滚动条 */
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255, 255, 255, 0.35) transparent !important;
            }
            .yfsp-hd-source-dropdown::-webkit-scrollbar {
                width: 4px !important;
            }
            .yfsp-hd-source-dropdown::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .yfsp-hd-source-dropdown::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.32) !important;
                border-radius: 999px !important;
            }
            .yfsp-hd-source-dropdown::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.55) !important;
            }
            .yfsp-hd-source-dropdown.show {
                display: flex;
            }
            .yfsp-hd-source-item {
                width: 100%;
                text-align: left;
                padding: 7px 10px;
                border-radius: 11px;
                background: transparent;
                border: none;
                color: rgba(255, 255, 255, 0.88);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
                transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
                box-sizing: border-box;
            }
            .yfsp-hd-source-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            .yfsp-hd-source-item:hover {
                background: rgba(255, 255, 255, 0.14);
                color: #ffffff;
            }
            .yfsp-hd-source-item.active {
                background: rgba(255, 255, 255, 0.22);
                color: #ffffff;
                font-weight: 600;
            }
            .yfsp-hd-active-check {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                flex-shrink: 0;
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
            }
            .yfsp-hd-close {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 4px 6px !important;
                color: #ffffff !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                cursor: pointer;
                opacity: 0.82 !important;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65), 0 0 2px rgba(0, 0, 0, 0.8) !important;
                transition: opacity 0.2s ease, transform 0.2s ease !important;
            }
            .yfsp-hd-close:hover {
                opacity: 1 !important;
                background: transparent !important;
                color: #ffffff !important;
                border-color: transparent;
                transform: none !important;
                filter: brightness(1.2) !important;
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

            /* =========================================================================
             * 极简沉浸无感控制栏系统 (Seamless Immersive Controls Core)
             * ========================================================================= */
            .art-video-player {
                --art-theme: #ffffff !important;
                --art-font-color: #ffffff !important;
                --art-widget-background: transparent !important;
            }
            /* 1. 控制栏贴底线性渐变遮罩：告别胶囊边框与毛玻璃，与画面浑然一体 */
            .art-video-player .art-bottom {
                top: auto !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100% !important;
                height: 52px !important;
                padding: 0 24px 10px !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 12px !important;
                /* 从下往上自然淡出黑色渐变，无边界感，高度覆盖控制栏近2倍区域 */
                background: linear-gradient(to top, rgba(0, 0, 0, 0.52) 0%, rgba(0, 0, 0, 0.28) 45%, transparent 100%) !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                pointer-events: auto !important;
                transition: opacity 0.25s ease !important;
                opacity: 1 !important;
                transform: none !important;
                overflow: visible !important;
            }
            /* 控制栏隐退：0.25s 自然淡出，不位移不抢视线 */
            .art-video-player.yfsp-controls-hidden .art-bottom {
                opacity: 0 !important;
                transform: none !important;
                pointer-events: none !important;
            }
            /* 观影无干扰隐蔽指针 */
            .art-video-player.yfsp-cursor-hidden,
            .art-video-player.yfsp-cursor-hidden * {
                cursor: none !important;
            }
            /* 彻底根除进度条与控制器割裂问题：坚决锁定进度条在胶囊内部，彻底屏蔽 Artplayer 默认的偏移降级 */
            .art-video-player .art-bottom .art-progress,
            .art-video-player .art-bottom .art-controls,
            .art-video-player .art-bottom .art-controls-left,
            .art-video-player .art-bottom .art-controls-right,
            .art-video-player.art-mini-progress-bar .art-bottom .art-progress,
            .art-video-player.art-mini-progress-bar .art-bottom .art-controls,
            .art-video-player.art-hover .art-bottom .art-progress,
            .art-video-player.art-control-show .art-bottom .art-progress {
                transform: none !important;
            }
            .art-video-player.art-mini-progress-bar .art-bottom {
                background-image: none !important;
            }
            .art-video-player .art-bottom .art-controls {
                display: contents !important;
                overflow: visible !important;
            }
            /* 2. 左侧区：上一集、播放、下一集、音量、时间紧凑排列 */
            .art-video-player .art-bottom .art-controls-left {
                order: 1 !important;
                display: flex !important;
                align-items: center !important;
                gap: 3px !important;
                height: 100% !important;
                flex-shrink: 0 !important;
                overflow: visible !important;
            }
            /* 严格锁定左侧控制栏次序：[⏮ 上一集] -> [▶ 播放] -> [⏭ 下一集] -> [🔊 音量] -> [时间戳] */
            .art-video-player .art-controls-left .art-control-prev-ep {
                order: 1 !important;
            }
            .art-video-player .art-controls-left .art-control-playAndPause {
                order: 2 !important;
            }
            .art-video-player .art-controls-left .art-control-next-ep {
                order: 3 !important;
            }
            .art-video-player .art-controls-left .art-control-volume {
                order: 4 !important;
            }
            .art-video-player .art-controls-left .art-control-time {
                order: 5 !important;
            }
            /* 上一集与下一集按钮专属样式 */
            .art-video-player .art-control-prev-ep,
            .art-video-player .art-control-next-ep {
                cursor: pointer !important;
            }
            .art-video-player .art-control-prev-ep svg,
            .art-video-player .art-control-next-ep svg {
                width: 18px !important;
                height: 18px !important;
                display: block !important;
                fill: #ffffff !important;
                stroke: none !important;
                filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.65)) !important;
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }
            /* 禁用态（第一集的上一集、最后一集的下一集）：真·沉稳暗灰阶 + 彻底禁用点击与悬停动画 */
            .art-video-player .art-bottom .art-control.art-control-prev-ep.art-control-disabled,
            .art-video-player .art-bottom .art-control.art-control-next-ep.art-control-disabled {
                opacity: 0.35 !important;
                cursor: not-allowed !important;
                pointer-events: none !important;
                transform: none !important;
                background: transparent !important;
            }
            .art-video-player .art-bottom .art-control.art-control-prev-ep.art-control-disabled:hover,
            .art-video-player .art-bottom .art-control.art-control-next-ep.art-control-disabled:hover {
                opacity: 0.35 !important;
                background: transparent !important;
                transform: none !important;
            }
            .art-video-player .art-bottom .art-control.art-control-prev-ep.art-control-disabled svg,
            .art-video-player .art-bottom .art-control.art-control-next-ep.art-control-disabled svg,
            .art-video-player .art-bottom .art-control.art-control-prev-ep.art-control-disabled svg path,
            .art-video-player .art-bottom .art-control.art-control-next-ep.art-control-disabled svg path {
                fill: #737373 !important;
                color: #737373 !important;
                filter: none !important;
            }
            /* 时间戳文字：纯白 + 轻微文字投影，亮暗背景皆分明 */
            .art-video-player .art-control-time {
                font-size: 11px !important;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
                color: #ffffff !important;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65) !important;
                padding: 0 6px !important;
                margin: 0 !important;
                width: auto !important;
                height: 100% !important;
                display: inline-flex !important;
                align-items: center !important;
                letter-spacing: 0.5px !important;
                user-select: none !important;
                white-space: nowrap !important;
                background: transparent !important;
                border-radius: 0 !important;
                flex-shrink: 0 !important;
            }
            .art-video-player .art-control-time:hover {
                background: transparent !important;
                transform: none !important;
            }
            /* 3. 中间区：自适应轻量进度条 */
            .art-video-player .art-bottom .art-progress {
                order: 2 !important;
                flex: 1 1 auto !important;
                min-width: 120px !important;
                margin: 0 10px !important;
                padding: 0 !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                cursor: pointer !important;
                overflow: visible !important;
            }
            .art-video-player .art-control-progress {
                height: 4px !important;
                display: flex !important;
                align-items: center !important;
                width: 100% !important;
                transition: height 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                overflow: visible !important;
                background: transparent !important;
                border-radius: 999px !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .art-video-player .art-control-progress:hover {
                background: transparent !important;
                transform: none !important;
            }
            .art-video-player .art-bottom .art-progress:hover .art-control-progress {
                height: 5.5px !important;
            }
            /* 未播放轨道：半透明白 0.3 */
            .art-video-player .art-control-progress-inner {
                background-color: rgba(255, 255, 255, 0.3) !important;
                border-radius: 999px !important;
                height: 100% !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
            }
            /* 缓冲轨道：稍亮半透明白 0.5 */
            .art-video-player .art-progress-loaded {
                background-color: rgba(255, 255, 255, 0.5) !important;
                border-radius: 999px !important;
            }
            /* 已播放进度：纯白 */
            .art-video-player .art-progress-played {
                background: #ffffff !important;
                border-radius: 999px !important;
            }
            /* 播放圆点指针：简洁白点 */
            .art-video-player .art-progress-indicator {
                width: 10px !important;
                height: 10px !important;
                background: #ffffff !important;
                border: none !important;
                border-radius: 50% !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 2px rgba(255, 255, 255, 0.8) !important;
                transform: scale(0.9) !important;
                transition: transform 0.15s ease-out !important;
            }
            .art-video-player .art-bottom .art-progress:hover .art-progress-indicator {
                transform: scale(1.15) !important;
            }
            /* 悬停时间戳提示：纯文字无边框浮动显示（跟手跟随，正上方 14px，加阴影保证高亮清晰） */
            .art-video-player .art-progress-tip {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                color: #ffffff !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.6) !important;
                padding: 0 !important;
                bottom: 14px !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                z-index: 100 !important;
                transition: none !important;
            }
            /* 4. 右侧区：极简三键流 [设置] [画中画] [全屏] */
            .art-video-player .art-bottom .art-controls-right {
                order: 3 !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                height: 100% !important;
                flex-shrink: 0 !important;
            }
            .art-video-player .art-control-playbackRate,
            .art-video-player .art-control-aspectRatio,
            .art-video-player .art-control-fullscreenWeb {
                display: none !important;
            }
            .art-video-player .art-control-setting {
                order: 1 !important;
            }
            .art-video-player .art-control-pip {
                order: 2 !important;
                display: flex !important;
            }
            .art-video-player .art-control-fullscreen {
                order: 3 !important;
            }
            /* 5. 悬停呼出垂直长条音量胶囊 (完善 Artplayer volume-panel 容器结构) */
            .art-video-player .art-control-volume {
                position: relative !important;
                overflow: visible !important;
            }
            .art-video-player .art-volume-panel {
                position: absolute !important;
                bottom: 50px !important;
                left: 50% !important;
                transform: translateX(-50%) translateY(8px) scale(0.95) !important;
                width: 38px !important;
                height: 135px !important;
                padding: 0 !important;
                opacity: 0 !important;
                pointer-events: none !important;
                transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
                z-index: 100 !important;
                overflow: visible !important;
            }
            .art-video-player .art-control-volume:hover .art-volume-panel,
            .art-video-player .art-volume-panel:hover {
                opacity: 1 !important;
                pointer-events: auto !important;
                transform: translateX(-50%) translateY(0) scale(1) !important;
            }
            /* 鼠标移动过渡桥接，杜绝图标与面板微小间隙导致失焦闪退 */
            .art-video-player .art-volume-panel::after {
                content: '' !important;
                position: absolute !important;
                bottom: -18px !important;
                left: 0 !important;
                right: 0 !important;
                height: 20px !important;
                pointer-events: auto !important;
            }
            .art-video-player .art-volume-panel .art-volume-inner {
                width: 100% !important;
                height: 100% !important;
                border-radius: 16px !important;
                /* 深度通透柔和质感：透出影视画面底层暖影，微光高斯漫射 */
                background: rgba(28, 24, 22, 0.38) !important;
                backdrop-filter: blur(32px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(32px) saturate(200%) !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.22) !important;
                padding: 12px 0 10px !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .art-video-player .art-volume-panel .art-volume-slider {
                width: 100% !important;
                flex: 1 !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                position: relative !important;
                cursor: pointer !important;
            }
            .art-video-player .art-volume-panel .art-volume-handle {
                width: 4px !important;
                height: 100% !important;
                background: rgba(255, 255, 255, 0.3) !important;
                border-radius: 999px !important;
                position: relative !important;
                overflow: hidden !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
            }
            .art-video-player .art-volume-panel .art-volume-loaded {
                background: #ffffff !important;
                border-radius: 999px !important;
            }
            .art-video-player .art-volume-panel .art-volume-indicator {
                width: 10px !important;
                height: 10px !important;
                background: #ffffff !important;
                border-radius: 50% !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 2px rgba(255, 255, 255, 0.8) !important;
                position: absolute !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
            }
            .art-video-player .art-volume-panel .art-volume-value {
                color: #ffffff !important;
                font-size: 11px !important;
                font-weight: 500 !important;
                font-family: ui-monospace, SFMono-Regular, monospace !important;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65) !important;
            }
            /* 6. 设置抽屉面板：轻量化半透明磨砂质感，融入画面，不显沉重 */
            .art-video-player .art-settings {
                position: absolute !important;
                top: auto !important;
                bottom: 66px !important;
                right: 24px !important;
                left: auto !important;
                width: 180px !important;
                height: auto !important;
                max-height: 320px !important;
                border-radius: 16px !important;
                /* 深度通透柔和质感：透出影视画面底层暖影，微光高斯漫射 */
                background: rgba(28, 24, 22, 0.38) !important;
                backdrop-filter: blur(32px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(32px) saturate(200%) !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.22) !important;
                padding: 6px 8px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255, 255, 255, 0.35) transparent !important;
                z-index: 95 !important;
            }
            .art-video-player .art-settings::-webkit-scrollbar {
                width: 4px !important;
            }
            .art-video-player .art-settings::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .art-video-player .art-settings::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.32) !important;
                border-radius: 999px !important;
            }
            .art-video-player .art-settings .art-setting-panel {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                height: auto !important;
            }
            .art-video-player .art-settings .art-setting-item {
                border-radius: 10px !important;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                padding: 8px 10px !important;
                height: 36px !important;
                color: #ffffff !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                box-sizing: border-box !important;
                cursor: pointer !important;
            }
            .art-video-player .art-settings .art-setting-item:hover {
                background: rgba(255, 255, 255, 0.12) !important;
            }
            /* 左侧功能项专属：彻底重置为严格靠左对齐（强力覆盖 Artplayer 默认的 justify-content: center），彻底消除各功能因字数不同导致的错落下沉参差不齐 */
            .art-video-player .art-settings .art-setting-item .art-setting-item-left {
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 8px !important;
                flex: 1 !important;
                min-width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                text-align: left !important;
            }
            /* 图标容器：固定 20px 宽度、严格居中图标，确保每行文字拥有完全一致的水平起始基准线 */
            .art-video-player .art-settings .art-setting-item .art-setting-item-left-icon {
                width: 20px !important;
                min-width: 20px !important;
                height: 20px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 !important;
                padding: 0 !important;
                flex-shrink: 0 !important;
            }
            /* 主菜单自定义功能项 SVG 图标（倍速、跳过片头、跳过片尾）：空心线性质感 */
            .art-video-player .art-settings .art-setting-item:not(.art-setting-item-back) .art-setting-item-left-icon > svg {
                width: 17px !important;
                height: 17px !important;
                display: block !important;
                fill: none !important;
                stroke: #ffffff !important;
                stroke-width: 2 !important;
                stroke-linecap: round !important;
                stroke-linejoin: round !important;
                opacity: 0.9 !important;
            }
            .art-video-player .art-settings .art-setting-item:not(.art-setting-item-back) .art-setting-item-left-icon > svg * {
                fill: none !important;
                stroke: #ffffff !important;
            }
            .art-video-player .art-settings .art-setting-item-left-text {
                font-size: 13px !important;
                font-weight: 500 !important;
                color: rgba(255, 255, 255, 0.92) !important;
                white-space: nowrap !important;
                letter-spacing: 0.2px !important;
            }
            /* 子菜单选项对勾（选中的倍速等）：保留占位与严格左对齐 */
            .art-video-player .art-settings .art-setting-item .art-icon-check {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 18px !important;
                height: 18px !important;
            }
            .art-video-player .art-settings .art-setting-item .art-icon-check svg {
                width: 14px !important;
                height: 14px !important;
                display: block !important;
                fill: #ffffff !important;
                stroke: none !important;
            }
            /* 右侧数值指示与向右箭头：严格靠右对齐 */
            .art-video-player .art-settings .art-setting-item .art-setting-item-right {
                display: flex !important;
                align-items: center !important;
                justify-content: flex-end !important;
                gap: 2px !important;
                margin-left: auto !important;
                flex-shrink: 0 !important;
            }
            .art-video-player .art-settings .art-setting-item-right-tooltip {
                font-size: 12px !important;
                color: rgba(255, 255, 255, 0.62) !important;
                white-space: nowrap !important;
                margin-right: 2px !important;
            }
            .art-video-player .art-settings .art-setting-item-right-icon {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 16px !important;
                min-width: 16px !important;
                height: 16px !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
            }
            .art-video-player .art-settings .art-setting-item-right-icon .art-icon {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                opacity: 0.65 !important;
                transition: opacity 0.2s ease !important;
            }
            .art-video-player .art-settings .art-setting-item:hover .art-setting-item-right-icon .art-icon {
                opacity: 0.95 !important;
            }
            .art-video-player .art-settings .art-setting-item-right-icon svg,
            .art-video-player .art-settings .art-setting-item-back .art-setting-item-left-icon svg {
                width: 18px !important;
                height: 18px !important;
                display: block !important;
                fill: #ffffff !important;
                stroke: none !important;
                overflow: visible !important;
            }
            /* 返回上一级按钮分隔线与微调 */
            .art-video-player .art-settings .art-setting-item-back {
                border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
                margin-bottom: 4px !important;
                padding-bottom: 8px !important;
            }
            /* 7. 控制按钮沉浸投影与无边框微光 */
            .art-video-player .art-bottom .art-control:not(.art-control-progress):not(.art-control-time):not(.art-control-disabled) {
                height: 36px !important;
                width: 36px !important;
                border-radius: 50% !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0 !important;
                margin: 0 1px !important;
                background: transparent !important;
                color: #ffffff !important;
                filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.65)) !important;
                opacity: 0.9 !important;
                transition: opacity 0.2s ease, transform 0.2s ease !important;
            }
            .art-video-player .art-bottom .art-control:not(.art-control-progress):not(.art-control-time):not(.art-control-disabled) svg {
                fill: #ffffff !important;
                color: #ffffff !important;
            }
            .art-video-player .art-bottom .art-control:not(.art-control-progress):not(.art-control-time):not(.art-control-disabled):hover {
                opacity: 1 !important;
                background: transparent !important;
                transform: scale(1.08) !important;
                filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.8)) brightness(1.2) !important;
            }
            /* 控制条按钮悬停提示 (tooltip)：纯文字无背景沉浸风格，去除深色实心块，保证亮画面清晰可读 */
            .art-video-player [class*=hint--]:after {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                color: #ffffff !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 2px rgba(0, 0, 0, 0.8) !important;
                padding: 0 !important;
                margin-bottom: 9px !important;
                line-height: 1 !important;
                white-space: nowrap !important;
                transform: translateX(-50%) !important;
                transition: opacity 0.15s ease !important;
            }
            .art-video-player [class*=hint--]:before {
                display: none !important;
            }
            /* 禁用 hint.css 默认的 hover 位移动画，保持纯淡入淡出 */
            .art-video-player [class*=hint--]:hover:after {
                transform: translateX(-50%) !important;
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
