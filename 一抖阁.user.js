// ==UserScript==
// @name         一抖阁 - 免费看完整视频（终极版）
// @namespace    https://github.com/Niklaus88/UserScript
// @version      4.3
// @description  绕过试看与每日次数限制，自动提取视频直链，拦截广告与弹窗，支持倍速/画中画/键盘快捷键/自动连播下一集/原画高速下载（已修复分类列表误注入与 yidouge.vip 新域名适配）
// @author       ARE
// @match        *://yidouge.vip/video/*
// @match        *://*.yidouge.vip/video/*
// @match        *://yidouge.com/video/*
// @match        *://*.yidouge.com/video/*
// @match        *://yidouge.cc/video/*
// @match        *://*.yidouge.cc/video/*
// @match        *://yidouge.me/video/*
// @match        *://*.yidouge.me/video/*
// @match        *://yidouge.net/video/*
// @match        *://*.yidouge.net/video/*
// @match        *://yidouge.xyz/video/*
// @match        *://*.yidouge.xyz/video/*
// @match        *://yidouge.top/video/*
// @match        *://*.yidouge.top/video/*
// @match        *://yidouge.tv/video/*
// @match        *://*.yidouge.tv/video/*
// @match        *://yidouge.org/video/*
// @match        *://*.yidouge.org/video/*
// @match        *://yidouge.app/video/*
// @match        *://*.yidouge.app/video/*
// @match        *://yidouge.fun/video/*
// @match        *://*.yidouge.fun/video/*
// @match        *://yidouge.live/video/*
// @match        *://*.yidouge.live/video/*
// @match        *://yidouge.club/video/*
// @match        *://*.yidouge.club/video/*
// @match        *://yidouge.vip/*
// @match        *://*.yidouge.vip/*
// @match        *://yidouge.com/*
// @match        *://*.yidouge.com/*
// @match        *://yidouge.cc/*
// @match        *://*.yidouge.cc/*
// @match        *://yidouge.me/*
// @match        *://*.yidouge.me/*
// @match        *://yidouge.net/*
// @match        *://*.yidouge.net/*
// @match        *://yidouge.xyz/*
// @match        *://*.yidouge.xyz/*
// @match        *://yidouge.top/*
// @match        *://*.yidouge.top/*
// @icon         https://yidouge.vip/favicon.ico
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 判断是否处于单视频播放详情页（防止在分类/合集/首页列表中错误注入播放器）
    function isVideoPage() {
        return window.location.pathname.indexOf('/video/') !== -1 ||
               Boolean(document.querySelector('[data-video-player-wrap], .single-video__player'));
    }

    // 动态获取当前站点引用的 R2 基础存储路径，默认回退至 r2.yidouge.com
    function getR2Base() {
        if (document.documentElement) {
            const m = document.documentElement.innerHTML.match(/https?:\/\/[a-z0-9.-]*r2\.yidouge\.[a-z0-9]+\/changsp\//i);
            if (m) return m[0];
        }
        return 'https://r2.yidouge.com/changsp/';
    }

    // ============================================================
    // 1. 样式拦截与自定义播放器样式注入
    // ============================================================
    function injectCSS() {
        if (document.getElementById('ydg-unlocked-style')) return;
        const css = document.createElement('style');
        css.id = 'ydg-unlocked-style';
        css.textContent = `
            /* 拦截试看提示与遮罩 */
            .watch-status,
            .watch-status--guest,
            .gv-preview-limit-notice,
            .guest-limit-notice,
            .guest-preview-overlay,
            [data-guest-preview-overlay],
            .video-ended-overlay,
            [data-video-ended-overlay],
            .gv-native-recovery,
            .gv-player-loading,
            [data-video-loading],
            [data-age-gate],
            .gv-age-gate {
                display: none !important;
            }

            /* 允许页面滚动（防止原生弹窗锁死 body 滚动） */
            body.gv-preview-modal-open,
            html.gv-age-gate-pending,
            body.gv-age-gate-pending {
                overflow: auto !important;
            }

            /* 隐藏 VIP 推广、多余侧边栏与页脚提示 */
            .single-video-vip-promo,
            [data-vip-promo],
            .vip-promo,
            .video-sidebar--friend-links,
            .video-sidebar--contact,
            .video-sidebar--authors,
            .video-sidebar--vip-entry,
            .site-footer__notice {
                display: none !important;
            }

            /* 自定义解锁播放器整体容器 */
            .ydg-player-container {
                position: relative;
                width: 100%;
                margin: 0 0 16px 0;
                background: #000;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
            }

            /* 视频容器：严格保证 16:9 比例 */
            .ydg-video-box {
                position: relative;
                width: 100%;
                aspect-ratio: 16 / 9;
                background: #000;
                overflow: hidden;
            }

            .ydg-custom-video {
                width: 100%;
                height: 100%;
                object-fit: contain;
                background: #000;
                display: block;
                outline: none;
            }

            /* 底部增强控制栏 */
            .ydg-toolbar {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 16px;
                background: linear-gradient(180deg, #181b28 0%, #10121a 100%);
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                color: #e2e8f0;
                font-size: 13px;
                user-select: none;
            }

            .ydg-toolbar-left,
            .ydg-toolbar-right {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }

            /* 按钮通用样式 */
            .ydg-btn {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                text-decoration: none !important;
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.15);
                background: rgba(255, 255, 255, 0.06);
                color: #e2e8f0;
                transition: all 0.18s ease;
            }

            .ydg-btn:hover {
                background: rgba(255, 255, 255, 0.14);
                border-color: rgba(255, 255, 255, 0.35);
                color: #fff;
            }

            .ydg-btn-primary {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border-color: #3b82f6;
                color: #fff !important;
                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
            }

            .ydg-btn-primary:hover {
                background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
            }

            .ydg-btn-next {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border-color: #10b981;
                color: #fff !important;
                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
            }

            .ydg-btn-next:hover {
                background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.45);
            }

            /* 倍速选择器 */
            .ydg-speeds {
                display: flex;
                align-items: center;
                gap: 3px;
                background: rgba(0, 0, 0, 0.35);
                padding: 3px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .ydg-speed-btn {
                padding: 3px 7px;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: #94a3b8;
                cursor: pointer;
                font-size: 11px;
                font-weight: 500;
                transition: all 0.15s;
            }

            .ydg-speed-btn:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }

            .ydg-speed-btn.active {
                background: #3b82f6;
                color: #fff;
                font-weight: 600;
            }

            /* 解锁标识徽章 */
            .ydg-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                background: rgba(16, 185, 129, 0.14);
                border: 1px solid rgba(16, 185, 129, 0.35);
                border-radius: 4px;
                color: #34d399;
                font-size: 11px;
                font-weight: 500;
            }

            .ydg-shortcuts-hint {
                color: #64748b;
                font-size: 11px;
                cursor: help;
            }

            .ydg-shortcuts-hint:hover {
                color: #94a3b8;
            }

            /* 加载失败提示面板 */
            .ydg-error-panel {
                position: absolute;
                inset: 0;
                background: rgba(10, 10, 15, 0.92);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #f87171;
                font-size: 13px;
                z-index: 10;
                padding: 20px;
                text-align: center;
            }

            @media (max-width: 640px) {
                .ydg-toolbar {
                    padding: 8px 12px;
                    gap: 8px;
                }
                .ydg-toolbar-left,
                .ydg-toolbar-right {
                    width: 100%;
                    justify-content: space-between;
                }
                .ydg-shortcuts-hint {
                    display: none;
                }
            }
        `;
        const root = document.head || document.documentElement || document;
        root.appendChild(css);
    }

    // ============================================================
    // 2. 年龄确认跳过与计数缓存清理
    // ============================================================
    function skipAgeGate() {
        try {
            localStorage.setItem('gv_age_verified', '1');
            sessionStorage.setItem('gv_age_verified', '1');
        } catch (e) {}
        try {
            document.cookie = 'gv_age_verified=1; Max-Age=31536000; Path=/; SameSite=Lax';
        } catch (e) {}

        if (document.documentElement) {
            document.documentElement.classList.remove('gv-age-gate-pending');
        }
        if (document.body) {
            document.body.classList.remove('gv-age-gate-pending');
        }
        document.querySelectorAll('[data-age-gate], .gv-age-gate').forEach(el => {
            el.remove ? el.remove() : (el.style.display = 'none');
        });
    }

    function cleanStorage() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('gv_') && key !== 'gv_age_verified' && key !== 'gv_autoplay_next') ||
                    key.includes('preview') || key.includes('count') || key.includes('watch')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
    }

    // ============================================================
    // 3. 多策略高精准视频源解析（仅在视频详情页运行）
    // ============================================================
    function getVideoInfo() {
        // 关键防护：非视频播放页面直接返回 null，防止分类列表页（如 /v2/ai短剧/）被误提取
        if (!isVideoPage()) {
            return null;
        }

        let videoUrl = '';
        let posterUrl = '';
        let title = '';
        let source = '';
        let nextUrl = '';

        // 提取自动下一集链接
        const nextEl = document.querySelector('[data-next-url], [data-video-next]');
        if (nextEl) {
            nextUrl = nextEl.getAttribute('data-next-url') || nextEl.getAttribute('href') || '';
        }

        // 策略1: 从 wrap DOM 的 data-video-url 获取（最精准）
        const wrap = document.querySelector('[data-video-player-wrap], .single-video__player');
        if (wrap) {
            // 立即将原生试看秒数清零，防止原生脚本并发挂载限制监听器
            wrap.setAttribute('data-guest-preview-seconds', '0');

            posterUrl = wrap.dataset.videoPoster || wrap.getAttribute('data-video-poster') || '';
            const rawUrl = wrap.dataset.videoUrl || wrap.getAttribute('data-video-url');
            if (rawUrl) {
                videoUrl = rawUrl;
                source = 'wrap[data-video-url]';
            }
        }

        // 获取视频标题（仅在视频详情页有效）
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim()) {
            title = h1.textContent.trim();
        } else {
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                title = ogTitle.content.replace(/\s*[-–|].*$/, '').trim();
            } else if (document.title) {
                title = document.title.replace(/\s*[-–|].*$/, '').trim();
            }
        }

        // 策略2: 从 JSON-LD (SEO Schema) 结构化数据解析
        if (!videoUrl) {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const data = JSON.parse(script.textContent);
                    const extractUrl = (obj) => {
                        if (!obj) return null;
                        if (obj.contentUrl) return obj;
                        if (Array.isArray(obj['@graph'])) {
                            for (const item of obj['@graph']) {
                                if (item.contentUrl) return item;
                            }
                        }
                        return null;
                    };
                    const item = extractUrl(data);
                    if (item) {
                        videoUrl = item.contentUrl;
                        if (!posterUrl && item.thumbnailUrl) {
                            posterUrl = Array.isArray(item.thumbnailUrl) ? item.thumbnailUrl[0] : item.thumbnailUrl;
                        }
                        if (!title && item.name) {
                            title = item.name.replace(/\s*[-–|].*$/, '').trim();
                        }
                        source = 'JSON-LD VideoObject';
                        break;
                    }
                } catch (e) {}
            }
        }

        // 策略3: 从整个 HTML 源代码中正则匹配 R2 存储直链
        if (!videoUrl && document.documentElement) {
            const html = document.documentElement.innerHTML;
            const match = html.match(/https?:\/\/[a-z0-9.-]*r2\.yidouge\.[a-z0-9]+\/changsp\/[^"'\s<>&]+\.mp4/i);
            if (match) {
                videoUrl = match[0].replace(/\\u002F/gi, '/').replace(/\\/g, '');
                source = 'HTML源代码正则匹配';
            }
        }

        // 策略4与策略5（仅在确认处于 /video/ 页面时才允许基于标题/slug 猜测，防止列表页盲目拼接）
        if (!videoUrl && window.location.pathname.indexOf('/video/') !== -1) {
            const r2Base = getR2Base();
            if (title) {
                const cleanTitle = title.replace(/[《》]/g, '').trim();
                if (cleanTitle) {
                    videoUrl = r2Base + encodeURI(cleanTitle) + '.mp4';
                    source = '视频真实标题构造';
                }
            }
            if (!videoUrl) {
                const path = window.location.pathname;
                const slug = path.replace(/^\/video\//, '').replace(/\/$/, '');
                if (slug) {
                    const decoded = decodeURIComponent(slug);
                    videoUrl = r2Base + encodeURI(decoded) + '.mp4';
                    source = 'URL slug 构造';
                }
            }
        }

        if (videoUrl) {
            return {
                url: videoUrl,
                poster: posterUrl,
                title: title,
                source: source,
                nextUrl: nextUrl
            };
        }
        return null;
    }

    // ============================================================
    // 4. 原生播放器与增强控制栏创建
    // ============================================================
    function createPlayer(wrap, info) {
        if (!wrap || wrap.querySelector('#ydg-unlocked-video')) return;

        console.log(`[一抖阁] 解锁视频成功！`);
        console.log(`[一抖阁] 来源: ${info.source}`);
        console.log(`[一抖阁] 直链: ${info.url}`);

        // 彻底移除原站播放器限制属性，避免 video-player.js 挂载预览定时器
        wrap.removeAttribute('data-guest-preview-seconds');
        wrap.removeAttribute('data-video-player-wrap');
        wrap.removeAttribute('data-video-url');

        // 清理原站点 ArtPlayer 实例及残留遮罩节点
        if (wrap.goonArtplayer && typeof wrap.goonArtplayer.destroy === 'function') {
            try { wrap.goonArtplayer.destroy(); } catch (e) {}
        }
        wrap.innerHTML = '';
        wrap.classList.add('is-artplayer-ready');

        // 构建独立播放器容器
        const container = document.createElement('div');
        container.className = 'ydg-player-container';

        // 视频容器 (16:9)
        const videoBox = document.createElement('div');
        videoBox.className = 'ydg-video-box';

        // 视频元素（不使用 gv-system-player 类名，防止原站脚本劫持）
        const video = document.createElement('video');
        video.id = 'ydg-unlocked-video';
        video.className = 'ydg-custom-video';
        video.controls = true;
        video.autoplay = false;
        video.preload = 'metadata';
        video.playsInline = true;
        if (info.poster) video.poster = info.poster;

        const sourceEl = document.createElement('source');
        sourceEl.src = info.url;
        sourceEl.type = 'video/mp4';
        video.appendChild(sourceEl);

        // 记忆播放速度与记忆播放进度
        const savedSpeed = parseFloat(localStorage.getItem('ydg_last_speed')) || 1.0;
        video.playbackRate = savedSpeed;

        const progressKey = 'ydg_progress_' + info.url;
        video.addEventListener('loadedmetadata', () => {
            try {
                const savedTime = parseFloat(sessionStorage.getItem(progressKey));
                if (savedTime && savedTime > 5 && savedTime < video.duration - 10) {
                    video.currentTime = savedTime;
                }
            } catch (e) {}
        });

        let saveTimer = null;
        video.addEventListener('timeupdate', () => {
            if (!saveTimer) {
                saveTimer = setTimeout(() => {
                    saveTimer = null;
                    try {
                        if (video.currentTime > 5) {
                            sessionStorage.setItem(progressKey, video.currentTime);
                        }
                    } catch (e) {}
                }, 2000);
            }
        });

        // 视频播放结束自动连播下一集
        if (info.nextUrl) {
            video.addEventListener('ended', () => {
                console.log('[一抖阁] 视频播放完毕，准备自动进入下一集:', info.nextUrl);
                setTimeout(() => {
                    window.location.href = info.nextUrl;
                }, 1000);
            });
        }

        // 播放异常捕获面板
        const errorPanel = document.createElement('div');
        errorPanel.className = 'ydg-error-panel';
        errorPanel.style.display = 'none';
        errorPanel.innerHTML = `
            <div>⚠️ 视频流加载中断或地址失效</div>
            <div style="display:flex;gap:10px;">
                <button type="button" class="ydg-btn ydg-btn-primary" id="ydg-retry-btn">🔄 重新加载</button>
                <a class="ydg-btn" href="${info.url}" target="_blank">🔗 浏览器中打开</a>
            </div>
        `;
        errorPanel.querySelector('#ydg-retry-btn').addEventListener('click', () => {
            errorPanel.style.display = 'none';
            video.load();
            video.play().catch(() => {});
        });

        video.addEventListener('error', () => {
            console.warn('[一抖阁] 视频加载发生错误:', info.url);
            errorPanel.style.display = 'flex';
        });

        videoBox.appendChild(video);
        videoBox.appendChild(errorPanel);

        // 构造控制栏
        const toolbar = document.createElement('div');
        toolbar.className = 'ydg-toolbar';

        // 左侧控制区
        const toolbarLeft = document.createElement('div');
        toolbarLeft.className = 'ydg-toolbar-left';

        // 1. 高速下载按钮
        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'ydg-btn ydg-btn-primary';
        downloadBtn.href = info.url;
        const filename = (info.title ? info.title.replace(/[\\/:*?"<>|]/g, '') : '一抖阁视频') + '.mp4';
        downloadBtn.download = filename;
        downloadBtn.target = '_blank';
        downloadBtn.rel = 'noopener noreferrer';
        downloadBtn.innerHTML = '⬇ 下载完整视频';
        downloadBtn.title = '直接从高速 CDN 下载原画 MP4';

        // 2. 下一集按钮（如果存在）
        if (info.nextUrl) {
            const nextBtn = document.createElement('a');
            nextBtn.className = 'ydg-btn ydg-btn-next';
            nextBtn.href = info.nextUrl;
            nextBtn.innerHTML = '⏭ 下一集';
            nextBtn.title = '点击播放下一集内容';
            toolbarLeft.appendChild(nextBtn);
        }

        // 3. 复制直链按钮
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'ydg-btn';
        copyBtn.innerHTML = '📋 复制直链';
        copyBtn.title = '复制视频直链到剪贴板，可粘贴至迅雷/IDM/浏览器直接下载';
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(info.url);
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '✅ 已复制直链';
                copyBtn.style.borderColor = '#10b981';
                copyBtn.style.color = '#34d399';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                    copyBtn.style.borderColor = '';
                    copyBtn.style.color = '';
                }, 2000);
            } catch (err) {
                window.prompt('请手动复制视频直链：', info.url);
            }
        });

        // 4. 画中画切换按钮
        const pipBtn = document.createElement('button');
        pipBtn.type = 'button';
        pipBtn.className = 'ydg-btn';
        pipBtn.innerHTML = '📺 画中画';
        pipBtn.title = '进入画中画悬浮窗播放模式';
        pipBtn.addEventListener('click', async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else if (document.pictureInPictureEnabled) {
                    await video.requestPictureInPicture();
                }
            } catch (e) {
                console.error('画中画切换失败', e);
            }
        });

        toolbarLeft.appendChild(downloadBtn);
        toolbarLeft.appendChild(copyBtn);
        if (document.pictureInPictureEnabled) {
            toolbarLeft.appendChild(pipBtn);
        }

        // 右侧控制区：倍速 + 解锁状态 + 快捷键提示
        const toolbarRight = document.createElement('div');
        toolbarRight.className = 'ydg-toolbar-right';

        // 倍速控制组
        const speedBox = document.createElement('div');
        speedBox.className = 'ydg-speeds';
        const speeds = [0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
        const speedButtons = [];

        speeds.forEach(rate => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ydg-speed-btn';
            btn.textContent = rate + 'x';
            if (rate === savedSpeed) btn.classList.add('active');
            btn.addEventListener('click', () => {
                video.playbackRate = rate;
                speedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                localStorage.setItem('ydg_last_speed', rate);
            });
            speedBox.appendChild(btn);
            speedButtons.push(btn);
        });

        // 解锁徽章
        const badge = document.createElement('span');
        badge.className = 'ydg-badge';
        badge.innerHTML = '🎬 完整版已解锁';

        // 快捷键提示
        const shortcutsHint = document.createElement('span');
        shortcutsHint.className = 'ydg-shortcuts-hint';
        shortcutsHint.title = '空格: 播放/暂停\n←/→: 快退/快进 5s (按住Shift: 10s)\n↑/↓: 调节音量\nF: 全屏切换\nM: 静音切换';
        shortcutsHint.textContent = '⌨ 快捷键';

        toolbarRight.appendChild(speedBox);
        toolbarRight.appendChild(badge);
        toolbarRight.appendChild(shortcutsHint);

        toolbar.appendChild(toolbarLeft);
        toolbar.appendChild(toolbarRight);

        container.appendChild(videoBox);
        container.appendChild(toolbar);
        wrap.appendChild(container);

        // 移除全局可能存在的遮罩
        document.querySelectorAll('[data-guest-preview-overlay], [data-video-ended-overlay]').forEach(el => el.remove());
        if (document.body) document.body.classList.remove('gv-preview-modal-open');
    }

    // ============================================================
    // 5. 键盘快捷键监听
    // ============================================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const targetTag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '');
            if (targetTag === 'input' || targetTag === 'textarea' || (e.target && e.target.isContentEditable)) {
                return;
            }

            const video = document.getElementById('ydg-unlocked-video');
            if (!video) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (video.paused) video.play(); else video.pause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 10 : 5));
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + (e.shiftKey ? 10 : 5));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    break;
                case 'KeyF':
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => {});
                    } else {
                        const box = video.closest('.ydg-video-box') || video;
                        if (box.requestFullscreen) {
                            box.requestFullscreen().catch(() => {});
                        } else if (video.webkitEnterFullscreen) {
                            video.webkitEnterFullscreen();
                        }
                    }
                    break;
                case 'KeyM':
                    e.preventDefault();
                    video.muted = !video.muted;
                    break;
            }
        });
    }

    // ============================================================
    // 6. 执行流程与生命周期监听
    // ============================================================
    function trySetup() {
        skipAgeGate();

        // 关键防护：非视频播放页面绝不执行播放器初始化与 DOM 注入
        if (!isVideoPage()) {
            return false;
        }

        if (document.getElementById('ydg-unlocked-video')) {
            return true;
        }

        const info = getVideoInfo();
        if (!info || !info.url) return false;

        // 仅在原站真实播放器容器存在时才接管注入
        const wrap = document.querySelector('[data-video-player-wrap], .single-video__player');
        if (wrap) {
            createPlayer(wrap, info);
            return true;
        }

        // 兜底方案：仅当处于 /video/ 详情页且有 .single-video 时才创建容器，严禁向分类列表页 main 注入！
        if (window.location.pathname.indexOf('/video/') !== -1) {
            const singleVideo = document.querySelector('.single-video');
            if (singleVideo) {
                const newWrap = document.createElement('div');
                newWrap.className = 'single-video__player';
                singleVideo.insertBefore(newWrap, singleVideo.firstChild);
                createPlayer(newWrap, info);
                return true;
            }
        }

        return false;
    }

    function init() {
        injectCSS();
        skipAgeGate();
        cleanStorage();

        // 只有视频页才进入安装播放器逻辑
        if (!isVideoPage()) {
            return;
        }

        // 立即尝试一次
        if (trySetup()) return;

        // DOMContentLoaded 时尝试
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                injectCSS();
                skipAgeGate();
                trySetup();
            });
        }

        // 使用 MutationObserver 实时捕捉容器插入，确保在最短时间内接管
        const observer = new MutationObserver(() => {
            skipAgeGate();
            if (trySetup()) {
                observer.disconnect();
            }
        });

        const targetNode = document.documentElement || document;
        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });

        // 兜底定时轮询（最多持续 6 秒）
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            skipAgeGate();
            if (trySetup() || attempts >= 15) {
                clearInterval(timer);
                observer.disconnect();
            }
        }, 400);
    }

    // 单页应用 (SPA) 与历史路由切换拦截
    let lastUrl = location.href;
    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            const existing = document.querySelector('.ydg-player-container');
            if (existing) existing.remove();
            setTimeout(init, 50);
        }
    }

    const _pushState = history.pushState;
    if (_pushState) {
        history.pushState = function() {
            const ret = _pushState.apply(this, arguments);
            window.dispatchEvent(new Event('ydg_locationchange'));
            return ret;
        };
    }
    const _replaceState = history.replaceState;
    if (_replaceState) {
        history.replaceState = function() {
            const ret = _replaceState.apply(this, arguments);
            window.dispatchEvent(new Event('ydg_locationchange'));
            return ret;
        };
    }
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('ydg_locationchange')));
    window.addEventListener('ydg_locationchange', checkUrlChange);

    // 快捷键与主逻辑启动
    setupKeyboardShortcuts();
    init();

})();
