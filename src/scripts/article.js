
            var auroraBg = document.getElementById('aurora-bg');

            // 壁纸为主背景，极光仅作加载失败后备
            function hideAuroraBackground() {
                if (!auroraBg || auroraBg.classList.contains('hidden')) return;
                auroraBg.classList.add('fade-out');
                setTimeout(function() {
                    auroraBg.classList.add('hidden');
                    auroraBg.style.display = 'none';
                }, 1200);
            }

            const loadingErrors = [];
            let articleImageObserver = null;
            let currentRotation = 0;
            let loadingOverlayHidden = false;
            let wallpaperResolved = false;
            let lastBrightness = null;

            document.body.style.backgroundImage = 'none';

            async function simpleFetch(url, options = {}) {
                const response = await fetch(url, options);
                if (!response.ok) throw new Error(`请求失败: ${response.status}`);
                return response;
            }

            function showToast(message, type = 'info') {
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                const progress = document.createElement('div');
                progress.className = 'toast-progress';
                const msg = document.createElement('div');
                msg.textContent = message;
                toast.appendChild(progress);
                toast.appendChild(msg);
                container.appendChild(toast);
                requestAnimationFrame(() => toast.classList.add('show'));
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        if (container.contains(toast)) container.removeChild(toast);
                    }, 400);
                }, 3000);
            }

            function updateLoadingProgress(percentage, subtext) {
                const progressBar = document.getElementById('loading-progress-bar');
                const subtextEl = document.getElementById('loading-subtext');
                if (progressBar) progressBar.style.width = Math.min(percentage, 100) + '%';
                if (subtextEl && subtext) subtextEl.textContent = subtext;
            }

            function hideLoadingOverlay() {
                if (loadingOverlayHidden) return;
                loadingOverlayHidden = true;
                const overlay = document.getElementById('loading-overlay');
                if (!overlay) return;
                updateLoadingProgress(100, '加载完成˶>ᗜ<˶');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.classList.add('hidden');
                    overlay.style.display = 'none';
                }, 500);
            }

            function addLoadingError(msg) {
                loadingErrors.push(msg);
            }

            function flushLoadingErrors() {
                if (loadingErrors.length === 0) return;
                const unique = [...new Set(loadingErrors)];
                unique.forEach(err => showToast(err, 'error'));
                loadingErrors.length = 0;
            }

            // 亮度分析与自适应调节
            function analyzeWallpaperBrightness(img) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const sampleSize = 100;
                canvas.width = sampleSize;
                canvas.height = sampleSize;
                ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
                const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
                const data = imageData.data;

                const centerXStart = Math.floor(sampleSize * 0.25);
                const centerXEnd = Math.floor(sampleSize * 0.75);
                const centerYStart = Math.floor(sampleSize * 0.25);
                const centerYEnd = Math.floor(sampleSize * 0.75);
                const cornerSize = Math.floor(sampleSize * 0.15);

                let totalLum = 0, totalPixels = 0;
                let centerLum = 0, centerPixels = 0;
                let cornersLum = 0, cornersPixels = 0;

                for (let y = 0; y < sampleSize; y++) {
                    for (let x = 0; x < sampleSize; x++) {
                        const idx = (y * sampleSize + x) * 4;
                        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                        totalLum += lum;
                        totalPixels++;

                        if (x >= centerXStart && x < centerXEnd && y >= centerYStart && y < centerYEnd) {
                            centerLum += lum;
                            centerPixels++;
                        }

                        if ((x < cornerSize && y < cornerSize) ||
                            (x >= sampleSize - cornerSize && y < cornerSize) ||
                            (x < cornerSize && y >= sampleSize - cornerSize) ||
                            (x >= sampleSize - cornerSize && y >= sampleSize - cornerSize)) {
                            cornersLum += lum;
                            cornersPixels++;
                        }
                    }
                }

                const avgLum = totalLum / totalPixels;
                const avgCenter = centerLum / centerPixels;
                const avgCorners = cornersLum / cornersPixels;

                return { avg: avgLum, center: avgCenter, corners: avgCorners };
            }

            function applyBrightnessAdjustment(brightness) {
                const overlay = document.getElementById('brightness-overlay');
                if (!overlay) return;

                const avg = brightness.avg;
                const center = brightness.center;
                const corners = brightness.corners;

                                // 整体亮度调节：平均亮度超过 150 时，叠加整体暗化
                const overallAlpha = Math.max(0, Math.min(0.65, (avg - 150) / 105 * 0.65));
                let backgroundStyle = '';

                if (overallAlpha > 0.01) {
                    backgroundStyle += `linear-gradient(rgba(0,0,0,${overallAlpha}), rgba(0,0,0,${overallAlpha}))`;
                }

                const centerDiff = center - corners;
                const cornersDiff = corners - center;
                const threshold = 18;

                let radialGradient = '';
                if (centerDiff > threshold) {
                  // 中心偏亮，添加中心暗化径向渐变
                  const centerAlpha = Math.min(0.55, centerDiff / 80 * 0.55);
                  radialGradient = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${centerAlpha}) 0%, rgba(0,0,0,0) 70%)`;
                } else if (cornersDiff > threshold) {
                  // 四角偏亮，添加暗角效果（中心透明，边缘暗）
                  const cornerAlpha = Math.min(0.5, cornersDiff / 80 * 0.5);
                  radialGradient = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,${cornerAlpha}) 100%)`;
                }

                if (radialGradient) {
                    backgroundStyle = backgroundStyle ? backgroundStyle + ', ' + radialGradient : radialGradient;
                }

                if (backgroundStyle) {
                    overlay.style.background = backgroundStyle;
                    overlay.classList.add('active');
                } else {
                    overlay.classList.remove('active');
                    overlay.style.background = 'transparent';
                }
            }

            function loadImage(imgUrl) {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        document.body.style.backgroundImage = 'url(' + imgUrl + ')';
                        document.documentElement.classList.add('wallpaper-active');
                        hideAuroraBackground();

                        try {
                            lastBrightness = analyzeWallpaperBrightness(img);
                            applyBrightnessAdjustment(lastBrightness);
                        } catch (e) {
                            console.warn('亮度分析失败，跳过自适应调节', e);
                        }

                        resolve(true);
                    };
                    img.onerror = () => resolve(false);
                    img.src = imgUrl;
                    if (img.complete) {
                        if (img.naturalWidth > 0) {
                            document.body.style.backgroundImage = 'url(' + imgUrl + ')';
                            document.documentElement.classList.add('wallpaper-active');
                            hideAuroraBackground();
                            try {
                                lastBrightness = analyzeWallpaperBrightness(img);
                                applyBrightnessAdjustment(lastBrightness);
                            } catch (e) {}
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }
                });
            }

            async function loadWallpaperFromConfig() {
                try {
                    const res = await simpleFetch('../wallpaper.json');
                    const data = await res.json();
                    if (data && data.length) {
                        const entry = data[Math.floor(Math.random() * data.length)];
                        let imgUrl = entry.path;
                        if (!/^https?:\/\//i.test(imgUrl)) {
                            imgUrl = '../' + imgUrl;
                        }
                        return await loadImage(imgUrl);
                    }
                    return false;
                } catch (e) {
                    console.warn('壁纸配置加载失败:', e);
                    return false;
                }
            }

            async function loadWallpaperBackground() {
                if (wallpaperResolved) return true;
                try {
                    const result = await loadWallpaperFromConfig();
                    if (result) {
                        wallpaperResolved = true;
                        return true;
                    }
                } catch (e) {
                    console.warn('壁纸加载异常:', e);
                }
                return false;
            }

            function prepareArticleImagesForLazyLoading() {
                const images = document.querySelectorAll('.article-full-content img');
                if (images.length === 0) return false;
                images.forEach(img => {
                    if (img.complete && img.naturalWidth > 0) return;
                    const src = img.getAttribute('src');
                    if (src && !img.hasAttribute('data-src')) {
                        img.setAttribute('data-src', src);
                        img.removeAttribute('src');
                        img.classList.add('lazy-img');
                    }
                });
                return document.querySelectorAll('.article-full-content img[data-src]').length > 0;
            }

            function startArticleImageLazyLoading() {
                const lazyImages = document.querySelectorAll('.article-full-content img[data-src]');
                if (lazyImages.length === 0) return;
                if (articleImageObserver) articleImageObserver.disconnect();
                articleImageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            const dataSrc = img.getAttribute('data-src');
                            if (dataSrc) {
                                img.src = dataSrc;
                                img.removeAttribute('data-src');
                                img.onload = () => {
                                    img.classList.remove('lazy-img');
                                    img.classList.add('lazy-loaded');
                                };
                                img.onerror = () => {
                                    img.classList.remove('lazy-img');
                                    img.classList.add('lazy-error');
                                };
                            }
                            articleImageObserver.unobserve(img);
                        }
                    });
                }, { root: null, rootMargin: '250px', threshold: 0 });
                lazyImages.forEach(img => articleImageObserver.observe(img));
            }

            function preventTocScrollPropagation() {
                const tocContainer = document.getElementById('toc-container');
                if (tocContainer) {
                    tocContainer.addEventListener('wheel', function(e) {
                        const isScrollable = this.scrollHeight > this.clientHeight;
                        const isAtTop = this.scrollTop === 0;
                        const isAtBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - 1;
                        const scrollingUp = e.deltaY < 0;
                        const scrollingDown = e.deltaY > 0;
                        if ((isAtTop && scrollingUp) || (isAtBottom && scrollingDown)) return true;
                        if (isScrollable) e.stopPropagation();
                    }, { passive: false });
                }
            }

            // 代码块折叠行数阈值
            const CODE_FOLD_LINE_THRESHOLD = 15;
            // 折叠时最大高度
            const CODE_FOLD_MAX_HEIGHT = '26rem';

            function addCopyButtonsToCodeBlocks() {
                const codeBlocks = document.querySelectorAll('.article-full-content pre');
                codeBlocks.forEach((pre) => {
                    const code = pre.querySelector('code');
                    if (!code) return;

                    const codeText = code.innerText || code.textContent || '';
                    const lines = codeText.split('\n');
                    const lineCount = lines.length;
                    const needsFold = lineCount > CODE_FOLD_LINE_THRESHOLD;

                    var language = (code.className || '').replace('language-', '');
                    if (!language || language === 'code') {
                        var shikiPre = code.closest ? code.closest('pre') : null;
                        var dataLang = shikiPre ? (shikiPre.getAttribute('data-language') || '') : '';
                        if (dataLang) { language = dataLang; }
                    }
                    if (!language) { language = 'code'; }
                    const langLabel = document.createElement('span');
                    langLabel.className = 'code-language';
                    langLabel.textContent = language;
                    pre.appendChild(langLabel);

                    if (needsFold) {
                        const foldButton = document.createElement('button');
                        foldButton.className = 'fold-btn';
                        foldButton.innerHTML = '<i class="fas fa-chevron-down"></i> 展开';
                        foldButton.setAttribute('aria-label', '展开代码');
                        foldButton.setAttribute('title', '展开代码块');

                        // 初始折叠状态
                        pre.classList.add('code-folded');
                        pre.style.maxHeight = CODE_FOLD_MAX_HEIGHT;
                        pre.style.overflow = 'hidden';
                        let isFolded = true;

                        foldButton.addEventListener('click', () => {
                            if (isFolded) {
                                // 展开：先获取实际高度，然后过渡到实际高度
                                pre.classList.remove('code-folded');
                                const actualHeight = pre.scrollHeight;
                                pre.style.maxHeight = actualHeight + 'px';
                                pre.style.overflow = 'hidden'; // 过渡期间保持hidden，防止滚动条闪现
                                foldButton.innerHTML = '<i class="fas fa-chevron-up"></i> 折叠';
                                foldButton.setAttribute('aria-label', '折叠代码');
                                foldButton.setAttribute('title', '折叠代码块');
                                
                                const onTransitionEnd = () => {
                                    pre.style.maxHeight = 'none';
                                    pre.style.overflow = 'auto';
                                    pre.removeEventListener('transitionend', onTransitionEnd);
                                };
                                pre.addEventListener('transitionend', onTransitionEnd);
                                isFolded = false;
                            } else {
                                // 折叠：过渡到固定折叠高度
                                pre.classList.add('code-folded');
                                pre.style.maxHeight = CODE_FOLD_MAX_HEIGHT;
                                pre.style.overflow = 'hidden';
                                foldButton.innerHTML = '<i class="fas fa-chevron-down"></i> 展开';
                                foldButton.setAttribute('aria-label', '展开代码');
                                foldButton.setAttribute('title', '展开代码块');
                                isFolded = true;
                            }
                        });

                        pre.appendChild(foldButton);
                    }

                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-btn';
                    copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                    copyButton.addEventListener('click', () => {
                        const textToCopy = code.innerText || code.textContent;
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            copyButton.innerHTML = '<i class="fas fa-check"></i> 已复制';
                            copyButton.classList.add('success');
                            showToast('代码已复制到剪贴板', 'success');
                            setTimeout(() => {
                                copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                                copyButton.classList.remove('success');
                            }, 2000);
                        }).catch(err => {
                            console.error('复制失败:', err);
                            copyButton.innerHTML = '<i class="fas fa-times"></i> 失败';
                            copyButton.classList.add('error');
                            setTimeout(() => {
                                copyButton.innerHTML = '<i class="fas fa-copy"></i> 复制';
                                copyButton.classList.remove('error');
                            }, 2000);
                        });
                    });
                    pre.appendChild(copyButton);
                });
            }

            // 重新计算阅读时间（仅计算中文字符）
            function recalculateReadingTime() {
                const readingTimeEl = document.querySelector('.reading-time');
                if (!readingTimeEl) return;

                const contentEl = document.querySelector('.article-full-content');
                if (!contentEl) return;

                const textContent = contentEl.textContent || contentEl.innerText || '';
                const chineseChars = textContent.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
                const chineseCount = chineseChars ? chineseChars.length : 0;

                const wordsPerMinute = 400;
                const minutes = Math.max(1, Math.ceil(chineseCount / wordsPerMinute));

                readingTimeEl.textContent = '预计阅读时间: ' + minutes + ' 分钟';
            }

            function handleImageClick(e) {
                const target = e.target;
                if (target.tagName === 'IMG' && target.closest('.article-full-content')) {
                    const imgSrc = target.src;
                    if (!imgSrc && target.hasAttribute('data-src')) return;
                    if (imgSrc && !target.closest('a')) {
                        const lightbox = document.getElementById('lightbox');
                        const lightboxImg = document.getElementById('lightbox-img');
                        lightboxImg.src = imgSrc;
                        lightboxImg.style.transform = 'rotate(0deg)';
                        currentRotation = 0;
                        lightbox.style.display = 'flex';
                    }
                }
                if (target.tagName === 'IMG' && target.closest('a') && target.closest('.article-full-content')) {
                    e.preventDefault();
                    const link = target.closest('a');
                    showLinkConfirm(link.href);
                }
            }

            function closeLightbox() {
                document.getElementById('lightbox').style.display = 'none';
                hideLinkConfirm();
            }

            function rotateCW() {
                const lightboxImg = document.getElementById('lightbox-img');
                if (!lightboxImg || document.getElementById('lightbox').style.display !== 'flex') return;
                currentRotation += 90;
                lightboxImg.style.transform = `rotate(${currentRotation}deg)`;
            }

            function rotateCCW() {
                const lightboxImg = document.getElementById('lightbox-img');
                if (!lightboxImg || document.getElementById('lightbox').style.display !== 'flex') return;
                currentRotation -= 90;
                lightboxImg.style.transform = `rotate(${currentRotation}deg)`;
            }

            function showLinkConfirm(url) {
                const confirmEl = document.getElementById('link-confirm');
                const linkUrlEl = document.getElementById('link-url');
                linkUrlEl.textContent = url;
                linkUrlEl.href = url;
                confirmEl.style.display = 'block';
                setTimeout(() => confirmEl.classList.add('show'), 10);
                document.getElementById('link-confirm-btn').onclick = function() {
                    hideLinkConfirm();
                    window.open(url, '_blank');
                };
            }

            function hideLinkConfirm() {
                const confirmEl = document.getElementById('link-confirm');
                confirmEl.classList.remove('show');
                setTimeout(() => { confirmEl.style.display = 'none'; }, 400);
            }

            function formatRelativeTime(dateStr) {
                if (!dateStr) return '';
                const now = new Date();
                const date = new Date(dateStr);
                const diffMs = now - date;
                const diffMinutes = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                if (diffMinutes < 1) return '刚刚';
                if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
                if (diffHours < 24) return `${diffHours} 小时前`;
                if (diffDays <= 30) return `${diffDays} 天前`;
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }

            function displayLatestInfo() {
                const latestEl = document.getElementById('article-latest');
                const latestTimeEl = document.getElementById('article-latest-time');
                const latestStr = latestEl ? latestEl.dataset.latest : '';
                if (latestStr) {
                    latestEl.style.display = 'inline';
                    latestTimeEl.textContent = formatRelativeTime(latestStr);
                }
            }

            function generateTOC() {
                const tocContainer = document.getElementById('toc-container');
                const tocList = document.getElementById('toc-list');
                const headings = document.querySelectorAll('.article-full-content h2, .article-full-content h3, .article-full-content h4, .article-full-content h5, .article-full-content h6');
                if (headings.length === 0) {
                    tocContainer.style.display = 'none';
                    document.getElementById('toc-toggle').style.display = 'none';
                    return;
                }
                if (window.innerWidth > 1024) {
                    tocContainer.style.display = 'block';
                } else {
                    tocContainer.style.display = 'none';
                }
                tocList.innerHTML = '';
                headings.forEach((heading, index) => {
                    if (!heading.id) heading.id = `heading-${index}`;
                    const listItem = document.createElement('li');
                    const tagLevel = heading.tagName.toLowerCase();
                    listItem.className = 'toc-' + tagLevel;
                    listItem.dataset.id = heading.id;
                    const link = document.createElement('a');
                    link.href = `#${heading.id}`;
                    link.textContent = heading.textContent;
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const targetElement = document.getElementById(heading.id);
                        if (targetElement) {
                            const offsetTop = targetElement.offsetTop - 80;
                            window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                        }
                        if (window.innerWidth <= 1024) tocContainer.style.display = 'none';
                    });
                    listItem.appendChild(link);
                    tocList.appendChild(listItem);
                });
            }

            function adjustTocPosition() {
                if (window.innerWidth <= 1024) return;
                const tocContainer = document.getElementById('toc-container');
                const articleContainer = document.querySelector('.article-container');
                if (!tocContainer || !articleContainer) return;
                if (tocContainer.style.display === 'none' && window.innerWidth > 1024) return;
                const articleRect = articleContainer.getBoundingClientRect();
                const tocWidth = tocContainer.offsetWidth;
                const minGap = 20;
                const articleRightEdge = articleRect.right;
                const viewportWidth = window.innerWidth;
                const tocLeftTarget = articleRightEdge + minGap;
                const tocRightEdge = tocLeftTarget + tocWidth;
                let newRight = viewportWidth - tocRightEdge;
                const minRight = -(tocWidth - 50);
                newRight = Math.max(minRight, Math.min(newRight, viewportWidth - 10));
                tocContainer.style.right = newRight + 'px';
            }

            function updateProgressRing() {
                const progressCircle = document.getElementById('progress-circle');
                if (!progressCircle) return;
                const scrollTop = window.scrollY;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
                const circumference = 2 * Math.PI * 20;
                const offset = circumference * (1 - scrollPercent);
                progressCircle.style.strokeDashoffset = offset;
            }

            function handleScroll() {
                const backToTopBtn = document.getElementById('back-to-top');
                if (window.scrollY > 300) backToTopBtn.classList.add('visible');
                else backToTopBtn.classList.remove('visible');
                highlightTOC();
                updateProgressRing();
                adjustTocPosition();
            }

            function highlightTOC() {
                const headings = document.querySelectorAll('.article-full-content h2, .article-full-content h3, .article-full-content h4, .article-full-content h5, .article-full-content h6');
                const tocItems = document.querySelectorAll('.toc-list li');
                if (headings.length === 0) return;
                let currentHeading = null;
                const scrollPosition = window.scrollY + 100;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                const isAtBottom = windowHeight + window.scrollY >= documentHeight - 100;
                if (isAtBottom) {
                    currentHeading = headings[headings.length - 1];
                } else {
                    for (let i = 0; i < headings.length; i++) {
                        const heading = headings[i];
                        const headingTop = heading.offsetTop;
                        const headingBottom = headingTop + heading.offsetHeight;
                        if ((headingTop <= scrollPosition && headingBottom >= scrollPosition) ||
                            (i === headings.length - 1 && headingTop <= scrollPosition)) {
                            currentHeading = heading;
                            break;
                        }
                        if (headingTop > scrollPosition) {
                            currentHeading = headings[Math.max(0, i - 1)];
                            break;
                        }
                    }
                }
                if (!currentHeading && headings.length > 0) currentHeading = headings[0];
                if (currentHeading) {
                    tocItems.forEach(item => {
                        if (item.dataset.id === currentHeading.id) {
                            item.classList.add('active');
                            if (window.innerWidth > 1024) {
                                const tocContainer = document.getElementById('toc-container');
                                const itemTop = item.offsetTop;
                                const containerHeight = tocContainer.clientHeight;
                                const itemHeight = item.clientHeight;
                                if (itemTop < tocContainer.scrollTop || itemTop + itemHeight > tocContainer.scrollTop + containerHeight) {
                                    tocContainer.scrollTop = itemTop - containerHeight / 2 + itemHeight / 2;
                                }
                            }
                        } else {
                            item.classList.remove('active');
                        }
                    });
                }
            }

            async function loadPoetry() {
                const contentEl = document.getElementById('poetry-content');
                const authorEl = document.getElementById('poetry-author');
                try {
                    contentEl.textContent = '加载中...';
                    authorEl.textContent = '';
                    const response = await fetch('https://v1.jinrishici.com/all.json');
                    const data = await response.json();
                    if (data && data.content) {
                        contentEl.textContent = data.content;
                        authorEl.textContent = `—— ${data.author}`;
                    } else {
                        throw new Error('数据结构不符');
                    }
                } catch (e) {
                    contentEl.textContent = '加载失败';
                    authorEl.textContent = '';
                }
            }

            function formatArticleDateToMonthDay() {
                const dateSpan = document.getElementById('article-date');
                if (!dateSpan) return;
                const rawText = dateSpan.textContent.trim();
                if (!rawText) return;
                const parsedDate = new Date(rawText);
                if (isNaN(parsedDate.getTime())) return;
                const month = parsedDate.getMonth() + 1;
                const day = parsedDate.getDate();
                dateSpan.textContent = `${month}月${day}日`;
            }

            document.addEventListener('DOMContentLoaded', () => {
                updateLoadingProgress(10, '正在准备...');

                const hasLazyImages = prepareArticleImagesForLazyLoading();

                loadWallpaperBackground().then(ok => {
                    if (!ok) {
                        console.log('壁纸加载失败，保持极光背景显示');
                    }
                }).catch(e => {
                    console.warn('壁纸加载异常:', e);
                });

                updateLoadingProgress(55, '正在渲染文章...');
                if (hasLazyImages) startArticleImageLazyLoading();
                addCopyButtonsToCodeBlocks();

                // 优化后的阅读时间（仅中文字符）
                recalculateReadingTime();


                generateTOC();
                displayLatestInfo();
                formatArticleDateToMonthDay();

                document.addEventListener('click', handleImageClick);
                window.addEventListener('scroll', handleScroll);

                let resizeTimeout;
                window.addEventListener('resize', () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        const tocContainer = document.getElementById('toc-container');
                        if (window.innerWidth > 1024) {
                            tocContainer.style.display = 'block';
                            adjustTocPosition();
                        } else {
                            tocContainer.style.display = '';
                        }
                        updateProgressRing();
                    }, 150);
                });

                document.getElementById('back-to-top').addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                document.getElementById('toc-toggle').addEventListener('click', () => {
                    const tocContainer = document.getElementById('toc-container');
                    if (tocContainer.style.display === 'block') {
                        tocContainer.style.display = 'none';
                    } else {
                        tocContainer.style.display = 'block';
                        highlightTOC();
                        const activeItem = document.querySelector('.toc-list li.active');
                        if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
                preventTocScrollPropagation();
                document.getElementById('link-cancel').addEventListener('click', hideLinkConfirm);

                document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
                document.getElementById('lightbox').addEventListener('click', (ev) => {
                    if (ev.target === document.getElementById('lightbox')) closeLightbox();
                });
                document.getElementById('lightbox-rotate-cw').addEventListener('click', rotateCW);
                document.getElementById('lightbox-rotate-ccw').addEventListener('click', rotateCCW);

                updateLoadingProgress(90, '即将完成...');
                loadPoetry();
                document.getElementById('poetry-refresh-btn').addEventListener('click', loadPoetry);

                adjustTocPosition();
                updateProgressRing();

                const footerContent = document.querySelector('#article-footer .footer-content');
                if (footerContent && /保留所有权利/.test(footerContent.textContent)) {
                    footerContent.innerHTML = '<span>作者保留此文章所有权利</span>';
                }

                hideLoadingOverlay();
                flushLoadingErrors();
            });
