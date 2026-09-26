
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

      document.body.style.backgroundImage = 'none';

      const luckMessages = {
        0: "Σ (・□・;)",
        100: "欧皇就是你辣(ゝ∀･)b",
        range: [
          { min: 1, max: 20, message: "运气不是很好呢(´･_･`)" },
          { min: 21, max: 44, message: "运气略差一点( ¯•ω•¯ )" },
          { min: 45, max: 55, message: "普普通通呢(´･ω･`)" },
          { min: 56, max: 69, message: "又是小幸运的一天~(,,・ω・,,)" },
          { min: 70, max: 89, message: "运气很好呢(๑•̀ㅂ•́)و✧" },
          { min: 90, max: 99, message: "离欧皇只差一点点啦ヽ( ^ω^ ゞ )" }
        ]
      };

      let articlesData = [];
      const loadingErrors = [];
      const ARTICLES_PER_PAGE = 6;
      let currentCategory = 'all';
      let currentPage = 1;
      let currentSearchQuery = '';
      let currentTag = '';
      let searchIndexData = null;
      let searchIndexLoading = false;
      let loadingOverlayHidden = false;
      let wallpaperResolved = false;
      let lastBrightness = null;

      let searchFilters = {
        query: '',
        fields: { title: true, body: true, tags: true, excerpt: true },
        dateFrom: '',
        dateTo: ''
      };

      const datePickerState = {
        from: { year: new Date().getFullYear(), month: new Date().getMonth(), value: '' },
        to: { year: new Date().getFullYear(), month: new Date().getMonth(), value: '' }
      };

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

      function showToast(message, type) {
        type = type || 'info';
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        const msg = document.createElement('div');
        msg.textContent = message;
        toast.appendChild(progress);
        toast.appendChild(msg);
        container.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('show'); });
        setTimeout(function() {
          toast.classList.remove('show');
          setTimeout(function() {
            if (container.contains(toast)) container.removeChild(toast);
          }, 400);
        }, 3000);
      }

      function flushLoadingErrors() {
        if (loadingErrors.length === 0) return;
        var unique = [];
        for (var i = 0; i < loadingErrors.length; i++) {
          if (unique.indexOf(loadingErrors[i]) === -1) unique.push(loadingErrors[i]);
        }
        for (var j = 0; j < unique.length; j++) {
          showToast(unique[j], 'error');
        }
        loadingErrors.length = 0;
      }

      function addLoadingError(msg) {
        loadingErrors.push(msg);
      }

      async function simpleFetch(url, options) {
        return await fetch(url, options || {});
      }

      // ===== 亮度分析 & 自适应调节 =====
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

        // 局部亮度差异调节
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
  return new Promise(function(resolve) {
    var img = new Image();
    img.crossOrigin = 'anonymous';   // 关键：尝试匿名跨域，避免 canvas 污染

    img.onload = function() {
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

    img.onerror = function() { resolve(false); };
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

      function updateRuntime() {
        var start = new Date('2025-07-12T11:04:41');
        var now = new Date();
        var diff = now - start;
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((diff % (1000 * 60)) / 1000);
        var el = document.getElementById('runtime-display');
        if (el) el.textContent = days + '天' + hours + '时' + minutes + '分' + seconds + '秒';
      }

      function initLuckResult() {
        var today = new Date().toDateString();
        var stored = localStorage.getItem('dailyLuck');
        if (stored) {
          var data = JSON.parse(stored);
          if (data.date === today) {
            displayLuckResult(data.value);
            return;
          }
        }
        var el = document.getElementById('luck-result');
        if (el) el.textContent = '?';
      }

      function getDailyLuck() {
        var today = new Date().toDateString();
        var stored = localStorage.getItem('dailyLuck');
        if (stored) {
          var data = JSON.parse(stored);
          if (data.date === today) {
            displayLuckResult(data.value);
            return;
          }
        }
        var value = Math.floor(Math.random() * 101);
        localStorage.setItem('dailyLuck', JSON.stringify({ date: today, value: value }));
        displayLuckResult(value);
      }

      function displayLuckResult(value) {
        var resultEl = document.getElementById('luck-result');
        var messageEl = document.getElementById('luck-message');
        if (!resultEl) return;
        resultEl.textContent = value;
        resultEl.style.transform = 'scale(1.5)';
        setTimeout(function() { resultEl.style.transform = 'scale(1)'; }, 500);
        if (!messageEl) return;
        if (value === 0) messageEl.textContent = luckMessages[0];
        else if (value === 100) messageEl.textContent = luckMessages[100];
        else {
          for (var i = 0; i < luckMessages.range.length; i++) {
            var range = luckMessages.range[i];
            if (value >= range.min && value <= range.max) {
              messageEl.textContent = range.message;
              break;
            }
          }
        }
      }

      function typeWriter(element, text, speed) {
        element.innerHTML = '';
        var wrapper = document.createElement('span');
        var textSpan = document.createElement('span');
        var cursor = document.createElement('span');
        cursor.className = 'typewriter-cursor';
        cursor.textContent = '|';
        wrapper.appendChild(textSpan);
        wrapper.appendChild(cursor);
        element.appendChild(wrapper);
        var i = 0;
        function type() {
          if (i < text.length) {
            textSpan.textContent += text.charAt(i);
            i++;
            var variation = Math.random() * 0.6 + 0.7;
            setTimeout(type, speed * variation);
          } else {
            cursor.classList.add('blink');
          }
        }
        type();
      }

      async function loadSentences() {
        var el = document.getElementById('sentence');
        try {
          var res = await simpleFetch('./sentences.txt');
          if (!res.ok) throw new Error('请求失败');
          var text = await res.text();
          var sentences = text.split('\n').filter(function(line) { return line.trim(); });
          if (sentences.length) {
            var random = sentences[Math.floor(Math.random() * sentences.length)];
            typeWriter(el, random, 80);
          } else throw new Error('空文件');
        } catch (e) {
          console.error('加载美句失败:', e);
          addLoadingError('美句加载失败');
          el.style.display = 'none';
        }
      }

      async function loadWallpaperFromConfig() {
        try {
          var res = await simpleFetch('./wallpaper.json');
          if (!res.ok) throw new Error('请求失败');
          var data = await res.json();
          if (data && data.length) {
            var entry = data[Math.floor(Math.random() * data.length)];
            var imgUrl = entry.path;
            if (!/^https?:\/\//i.test(imgUrl)) {
              imgUrl = './' + imgUrl;
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
          var result = await loadWallpaperFromConfig();
          if (result) {
            wallpaperResolved = true;
            return true;
          }
        } catch (e) {
          console.warn('壁纸加载异常:', e);
        }
        return false;
      }

      async function loadHistoryToday() {
        var el = document.getElementById('history-content');
        try {
          el.innerHTML = '<div class="history-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
          var api = 'https://v2.xxapi.cn/api/history';
          var res = await simpleFetch(api);
          if (!res.ok) throw new Error('接口响应异常');
          var data = await res.json();
          if (data && data.code === 200 && Array.isArray(data.data) && data.data.length > 0) {
            var items = data.data;
            var randomItem = items[Math.floor(Math.random() * items.length)];
            var separatorIndex = randomItem.indexOf(' ');
            var dateStr = '';
            var eventStr = '';
            if (separatorIndex !== -1) {
              dateStr = randomItem.substring(0, separatorIndex);
              eventStr = randomItem.substring(separatorIndex + 1);
            } else {
              dateStr = randomItem;
              eventStr = '';
            }
            el.innerHTML = '<div class="history-date">' + dateStr + '</div><div class="history-event">' + eventStr + '</div>';
          } else if (data && data.msg) {
            throw new Error(data.msg);
          } else {
            throw new Error('未知错误');
          }
          window.historyLoaded = true;
        } catch (e) {
          el.innerHTML = '<div class="history-error">加载失败: ' + e.message + '</div>';
        }
      }

      function loadContacts() {
        var container = document.getElementById('contacts-container');
        if (!container) return;
        var contacts = {
          email: 'xundei_awa@outlook.com',
          qq: '503275418',
          wechat: 'xie503275418',
          github: 'https://github.com/XUNDEI',
          bilibili: 'https://space.bilibili.com/518218011'
        };
        var iconMap = {
          email: { icon: 'fas fa-envelope', label: '邮箱' },
          qq: { icon: 'fab fa-qq', label: 'QQ' },
          github: { icon: 'fab fa-github', label: 'GitHub' },
          wechat: { icon: 'fab fa-weixin', label: '微信' },
          bilibili: { icon: 'fab fa-bilibili', label: 'B站' }
        };
        var html = '';
        var keys = Object.keys(contacts);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var value = contacts[key];
          if (!value || !iconMap[key]) continue;
          var icon = iconMap[key].icon;
          var label = iconMap[key].label;
          html += '<div class="contact-btn" data-contact="' + key + '" data-value="' + value + '"><i class="' + icon + '"></i><div class="contact-tooltip">' + label + '</div></div>';
        }
        container.innerHTML = html;
        var btns = document.querySelectorAll('.contact-btn');
        for (var j = 0; j < btns.length; j++) {
          btns[j].addEventListener('click', function() {
            copyToClipboard(this.dataset.value);
            showToast('已复制到剪贴板', 'success');
          });
        }
      }

      function getSlug(filename) {
        return filename.split('/').pop().replace(/\.md$/, '');
      }

      function formatMonthDay(dateStr) {
        if (!dateStr) return '';
        var match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          var month = parseInt(match[2], 10);
          var day = parseInt(match[3], 10);
          return month + '月' + day + '日';
        }
        return dateStr.substring(0, 10);
      }

      function getLatestSortKey(article) {
        return article.latest ? article.latest : article.date;
      }

      function getArticleTimestamp(article) {
        var dateStr = article.date;
        if (dateStr && dateStr.indexOf('T') === -1) {
          dateStr += 'T00:00:00';
        }
        return Date.parse(dateStr);
      }

      function extractDatePart(dateStr) {
        if (!dateStr) return null;
        var match = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : null;
      }

      function renderPagination(totalPages, page) {
        var container = document.getElementById('pagination-container');
        if (!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) return;

        function createBtn(innerHTML, pageNum, disabled, active, isArrow) {
          var btn = document.createElement('button');
          btn.className = 'pagination-btn' + (active ? ' active' : '') + (isArrow ? ' pagination-arrow' : '');
          btn.innerHTML = innerHTML;
          if (disabled) btn.disabled = true;
          else {
            btn.addEventListener('click', function() {
              currentPage = pageNum;
              renderArticles();
              var grid = document.getElementById('articles-grid');
              if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
          return btn;
        }

        container.appendChild(createBtn('<i class="fas fa-chevron-left"></i>', page - 1, page <= 1, false, true));

        var startPage = Math.max(1, page - 2);
        var endPage = Math.min(totalPages, page + 2);
        if (endPage - startPage < 4) {
          if (startPage === 1) endPage = Math.min(totalPages, startPage + 4);
          else if (endPage === totalPages) startPage = Math.max(1, endPage - 4);
        }
        for (var i = startPage; i <= endPage; i++) {
          container.appendChild(createBtn(String(i), i, false, i === page, false));
        }

        container.appendChild(createBtn('<i class="fas fa-chevron-right"></i>', page + 1, page >= totalPages, false, true));

        var jumpDiv = document.createElement('div');
        jumpDiv.className = 'page-jump';
        var input = document.createElement('input');
        input.type = 'number';
        input.min = 1;
        input.max = totalPages;
        input.className = 'page-jump-input';
        input.placeholder = '页';
        input.setAttribute('aria-label', '跳转到指定页');
        var jumpBtn = document.createElement('button');
        jumpBtn.className = 'page-jump-btn';
        jumpBtn.textContent = '跳转';
        jumpBtn.addEventListener('click', function() {
          var p = parseInt(input.value);
          if (isNaN(p) || p < 1) p = 1;
          if (p > totalPages) p = totalPages;
          currentPage = p;
          renderArticles();
          var grid = document.getElementById('articles-grid');
          if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') jumpBtn.click();
        });
        jumpDiv.appendChild(input);
        jumpDiv.appendChild(jumpBtn);
        container.appendChild(jumpDiv);
      }

      function renderTagsHtml(tagsStr) {
        if (!tagsStr) return '';
        var parts = tagsStr.split(', ');
        var html = '';
        for (var i = 0; i < parts.length; i++) {
          var t = parts[i].trim();
          if (!t) continue;
          var active = (currentTag === t) ? ' tag-active' : '';
          html += '<a href="/?tag=' + encodeURIComponent(t) + '" class="article-tag' + active + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</a>';
        }
        return html;
      }

      function renderArticles(category, searchQuery) {
        if (!articlesData) return;
        if (category !== undefined) {
          currentCategory = category;
          currentPage = 1;
        }

        var grid = document.getElementById('articles-grid');
        grid.innerHTML = '';

        var filtered = articlesData.slice();
        filtered = filtered.filter(function(a) { return a.category !== 'friend_link'; });

        if (currentCategory !== 'all') {
          filtered = filtered.filter(function(a) { return a.category === currentCategory; });
        }

        var query = (searchQuery !== undefined ? searchQuery : searchFilters.query);
        if (query) {
          var localResults = searchLocally(query);
          if (localResults !== null && localResults !== undefined) {
            filtered = filtered.filter(function(a) {
              return localResults.indexOf(a.filename) !== -1;
            });
          } else {
            var fields = searchFilters.fields;
            var q = query.toLowerCase().trim();
            filtered = filtered.filter(function(a) {
              if (fields.title && (a.title || '').toLowerCase().indexOf(q) !== -1) return true;
              if (fields.tags && (a.tags || '').toLowerCase().indexOf(q) !== -1) return true;
              if (fields.excerpt && (a.excerpt || '').toLowerCase().indexOf(q) !== -1) return true;
              return false;
            });
          }
        }

        if (currentTag) {
          filtered = filtered.filter(function(a) {
            var tags = (a.tags || '').split(', ').map(function(t) { return t.trim(); });
            return tags.indexOf(currentTag) !== -1;
          });
        }

        if (searchFilters.dateFrom || searchFilters.dateTo) {
          filtered = filtered.filter(function(a) {
            var articleDate = extractDatePart(a.date);
            if (!articleDate) return true;
            if (searchFilters.dateFrom && articleDate < searchFilters.dateFrom) return false;
            if (searchFilters.dateTo && articleDate > searchFilters.dateTo) return false;
            return true;
          });
        }

        filtered.sort(function(a, b) {
          var keyA = getLatestSortKey(a);
          var keyB = getLatestSortKey(b);
          if (keyA && keyB) return keyB.localeCompare(keyA);
          return getArticleTimestamp(b) - getArticleTimestamp(a);
        });

        var totalPages = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
        if (currentPage > totalPages) currentPage = totalPages;
        var start = (currentPage - 1) * ARTICLES_PER_PAGE;
        var pageArticles = filtered.slice(start, start + ARTICLES_PER_PAGE);

        var searchInfo = document.getElementById('search-info');
        var hasQuery = !!searchFilters.query;
        var hasDate = !!(searchFilters.dateFrom || searchFilters.dateTo);
        if (hasQuery || currentTag || hasDate) {
          var msgParts = [];
          if (hasQuery) msgParts.push('搜索 "' + escapeHtml(searchFilters.query) + '"');
          if (currentTag) msgParts.push('标签 "' + escapeHtml(currentTag) + '"');
          if (hasDate) {
            var dateLabel = '';
            if (searchFilters.dateFrom && searchFilters.dateTo) {
              dateLabel = searchFilters.dateFrom + ' ~ ' + searchFilters.dateTo;
            } else if (searchFilters.dateFrom) {
              dateLabel = '从 ' + searchFilters.dateFrom + ' 开始';
            } else {
              dateLabel = '至 ' + searchFilters.dateTo;
            }
            msgParts.push('时间 ' + dateLabel);
          }
          searchInfo.textContent = msgParts.join(' · ') + ' 共 ' + filtered.length + ' 篇';
          searchInfo.classList.add('visible');
        } else {
          searchInfo.classList.remove('visible');
        }

        if (!pageArticles.length) {
          var emptyMsg = (hasQuery || currentTag || hasDate) ? '没有找到匹配的文章' : '该分类下还没有文章';
          grid.innerHTML = '<div class="glass" style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.8);"><i class="far fa-frown" style="font-size:3rem;margin-bottom:20px;"></i><h3>暂无结果</h3><p>' + emptyMsg + '</p></div>';
          renderPagination(totalPages, currentPage);
          updateCategoryButtons();
          return;
        }

        pageArticles.forEach(function(article) {
          var slug = getSlug(article.filename);
          var card = document.createElement('div');
          card.className = 'article-card glass' + (article.cover ? ' has-cover' : '');
          var cardLink = document.createElement('a');
          cardLink.className = 'card-link';
          cardLink.href = '/articles/' + slug;
          cardLink.setAttribute('aria-label', article.title + ' - 阅读全文');
          card.appendChild(cardLink);
          var tagsHtml = renderTagsHtml(article.tags);
          var displayDate = formatMonthDay(article.latest || article.date);
          card.insertAdjacentHTML('beforeend',
            '<div class="article-main">' +
              '<div class="article-head-row"><h3 class="article-title">' + escapeHtml(article.title) +
              '</h3><div class="article-meta"><span>' + escapeHtml(displayDate) + '</span><span>' + getCategoryName(article.category) +
              '</span></div></div>' +
              '<div class="article-content">' + escapeHtml(article.excerpt) + '</div>' +
              '<div class="article-foot-row">' + (tagsHtml ? '<div class="article-tags">' + tagsHtml + '</div>' : '') + '</div>' +
            '</div>' +
            '<span class="read-mask" aria-hidden="true"><span class="read-mask-label">阅读全文<i class="fas fa-arrow-right"></i></span></span>');
          // [cover] 有封面时在右侧插一张缩略图；加载失败就整块移除，卡片退回纯文字
          if (article.cover) {
            var coverEl = document.createElement('div');
            coverEl.className = 'article-cover';
            var coverImg = document.createElement('img');
            coverImg.src = article.cover;
            coverImg.alt = '';
            coverImg.loading = 'lazy';
            coverImg.decoding = 'async';
            coverImg.addEventListener('error', function () {
              if (coverEl.parentNode) coverEl.parentNode.removeChild(coverEl);
            });
            coverEl.appendChild(coverImg);
            card.insertBefore(coverEl, card.querySelector('.read-mask'));
          }
          grid.appendChild(card);
        });

        var tagLinks = grid.querySelectorAll('.article-tag');
        for (var j = 0; j < tagLinks.length; j++) {
          tagLinks[j].addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var tagName = this.dataset.tag;
            if (currentTag === tagName) {
              currentTag = '';
            } else {
              currentTag = tagName;
            }
            if (currentTag) {
              document.getElementById('search-input').value = '';
              searchFilters.query = '';
              currentSearchQuery = '';
              searchFilters.dateFrom = '';
              searchFilters.dateTo = '';
              updateDatePickerDisplay('from', '');
              updateDatePickerDisplay('to', '');
            }
            renderArticles('all');
          });
        }

        renderPagination(totalPages, currentPage);
        updateCategoryButtons();
      }

      function updateCategoryButtons() {
        var btns = document.querySelectorAll('.category-btn');
        for (var i = 0; i < btns.length; i++) {
          btns[i].classList.toggle('active', btns[i].dataset.category === currentCategory);
        }
      }

      function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
          if (m === '&') return '&amp;';
          if (m === '<') return '&lt;';
          if (m === '>') return '&gt;';
          return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) { return c; });
      }

      function getCategoryName(cat) {
        var map = { technology: '技术', diary: '日记', something: '杂碎', friend_link: '友链' };
        return map[cat] || cat;
      }

      function syncSearchFiltersToUI() {
        document.getElementById('search-input').value = searchFilters.query;
        updateDatePickerDisplay('from', searchFilters.dateFrom);
        updateDatePickerDisplay('to', searchFilters.dateTo);
        if (searchFilters.dateFrom) {
          var d = new Date(searchFilters.dateFrom + 'T00:00:00');
          if (!isNaN(d)) {
            datePickerState.from.year = d.getFullYear();
            datePickerState.from.month = d.getMonth();
            datePickerState.from.value = searchFilters.dateFrom;
          }
        } else {
          datePickerState.from.value = '';
        }
        if (searchFilters.dateTo) {
          var d2 = new Date(searchFilters.dateTo + 'T00:00:00');
          if (!isNaN(d2)) {
            datePickerState.to.year = d2.getFullYear();
            datePickerState.to.month = d2.getMonth();
            datePickerState.to.value = searchFilters.dateTo;
          }
        } else {
          datePickerState.to.value = '';
        }
        renderCalendar('from');
        renderCalendar('to');

        var checkboxes = document.querySelectorAll('.search-filters input[type="checkbox"][data-field]');
        for (var i = 0; i < checkboxes.length; i++) {
          var field = checkboxes[i].dataset.field;
          if (searchFilters.fields.hasOwnProperty(field)) {
            checkboxes[i].checked = searchFilters.fields[field];
          }
        }
        var clearBtn = document.getElementById('search-clear');
        if (clearBtn) {
          if (searchFilters.query || searchFilters.dateFrom || searchFilters.dateTo) {
            clearBtn.classList.add('visible');
          } else {
            clearBtn.classList.remove('visible');
          }
        }
      }

      function resetAllFilters() {
        searchFilters.query = '';
        searchFilters.dateFrom = '';
        searchFilters.dateTo = '';
        currentSearchQuery = '';
        datePickerState.from.value = '';
        datePickerState.to.value = '';
        updateDatePickerDisplay('from', '');
        updateDatePickerDisplay('to', '');
        syncSearchFiltersToUI();
        renderArticles('all');
      }

      function loadSearchIndex() {
        if (searchIndexData) return Promise.resolve(searchIndexData);
        if (searchIndexLoading) return searchIndexLoading;

        var infoEl = document.getElementById('search-info');
        if (infoEl) {
          infoEl.innerHTML = '<span class="search-loading"><i class="fas fa-spinner"></i> 正在加载搜索索引...</span><div class="search-progress-bar"><div class="search-progress-fill" id="search-progress-fill" style="width:10%"></div></div>';
          infoEl.classList.add('visible');
        }

        searchIndexLoading = new Promise(function(resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', '/search-index.json', true);

          xhr.onprogress = function(e) {
            if (e.lengthComputable) {
              var pct = Math.round(e.loaded / e.total * 100);
              var fill = document.getElementById('search-progress-fill');
              if (fill) fill.style.width = pct + '%';
              if (infoEl) {
                infoEl.innerHTML = '<span class="search-loading"><i class="fas fa-spinner"></i> 正在加载搜索索引... ' + pct + '%</span><div class="search-progress-bar"><div class="search-progress-fill" id="search-progress-fill" style="width:' + pct + '%"></div></div>';
              }
            }
          };

          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                searchIndexData = JSON.parse(xhr.responseText);
                var count = searchIndexData.length;
                if (infoEl) {
                  infoEl.innerHTML = '<span class="search-loaded"><i class="fas fa-check-circle"></i> 搜索索引已加载（' + count + ' 篇文章）</span>';
                  setTimeout(function() {
                    if (infoEl) infoEl.classList.remove('visible');
                  }, 2500);
                }
                resolve(searchIndexData);
              } catch(e) {
                if (infoEl) {
                  infoEl.innerHTML = '<span class="search-error"><i class="fas fa-exclamation-triangle"></i> 搜索索引解析失败</span>';
                }
                searchIndexData = [];
                reject(e);
              }
            } else {
              if (infoEl) {
                infoEl.innerHTML = '<span class="search-error"><i class="fas fa-exclamation-triangle"></i> 搜索索引加载失败（' + xhr.status + '）</span>';
              }
              searchIndexData = [];
              reject(new Error('HTTP ' + xhr.status));
            }
            searchIndexLoading = false;
          };

          xhr.onerror = function() {
            if (infoEl) {
              infoEl.innerHTML = '<span class="search-error"><i class="fas fa-exclamation-triangle"></i> 搜索索引加载失败（网络错误）</span>';
            }
            searchIndexData = [];
            searchIndexLoading = false;
            reject(new Error('Network error'));
          };

          xhr.send();
        });

        return searchIndexLoading;
      }

      function searchLocally(query) {
        if (!query || !searchIndexData || !searchIndexData.length) return null;
        var q = query.toLowerCase().trim();
        if (!q) return [];
        var fields = searchFilters.fields;
        var results = [];
        for (var i = 0; i < searchIndexData.length; i++) {
          var article = searchIndexData[i];
          var match = false;
          if (fields.title && (article.title || '').toLowerCase().indexOf(q) !== -1) match = true;
          if (!match && fields.body && (article.searchText || '').toLowerCase().indexOf(q) !== -1) match = true;
          if (!match && fields.tags && (article.tags || '').toLowerCase().indexOf(q) !== -1) match = true;
          if (!match && fields.excerpt && (article.excerpt || '').toLowerCase().indexOf(q) !== -1) match = true;
          if (match) results.push(article.filename);
        }
        return results;
      }

      function updateDatePickerDisplay(type, dateStr) {
        var input = document.getElementById(type === 'from' ? 'date-from-display' : 'date-to-display');
        if (!input) return;
        if (dateStr) {
          var d = new Date(dateStr + 'T00:00:00');
          if (!isNaN(d)) {
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            input.value = y + '-' + m + '-' + day;
            input.classList.add('has-value');
            return;
          }
        }
        input.value = '';
        input.classList.remove('has-value');
      }

      function renderCalendar(type) {
        var state = datePickerState[type];
        if (!state) return;
        var daysContainer = document.getElementById('cal-days-' + type);
        var titleEl = document.getElementById('cal-title-' + type);
        if (!daysContainer || !titleEl) return;

        var year = state.year;
        var month = state.month;
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();

        var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        titleEl.textContent = year + '年' + monthNames[month];

        var html = '';
        for (var i = 0; i < firstDay; i++) {
          html += '<div class="day-cell empty"></div>';
        }
        var today = new Date();
        var todayStr = today.getFullYear() + '-' +
          String(today.getMonth() + 1).padStart(2, '0') + '-' +
          String(today.getDate()).padStart(2, '0');

        var selectedStr = state.value || '';

        for (var d = 1; d <= daysInMonth; d++) {
          var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var isToday = (dateStr === todayStr);
          var isSelected = (dateStr === selectedStr);
          var classes = 'day-cell';
          if (isToday) classes += ' today';
          if (isSelected) classes += ' selected';
          html += '<div class="' + classes + '" data-date="' + dateStr + '">' + d + '</div>';
        }

        daysContainer.innerHTML = html;

        var cells = daysContainer.querySelectorAll('.day-cell:not(.empty)');
        for (var k = 0; k < cells.length; k++) {
          cells[k].addEventListener('click', function(e) {
            e.stopPropagation();
            var dateVal = this.dataset.date;
            if (!dateVal) return;
            selectDate(type, dateVal);
          });
        }
      }

      function selectDate(type, dateStr) {
        var state = datePickerState[type];
        if (!state) return;
        state.value = dateStr;
        updateDatePickerDisplay(type, dateStr);
        if (type === 'from') {
          searchFilters.dateFrom = dateStr;
        } else {
          searchFilters.dateTo = dateStr;
        }
        closeCalendar(type);
        var clearBtn = document.getElementById('search-clear');
        if (clearBtn) {
          if (searchFilters.query || searchFilters.dateFrom || searchFilters.dateTo) {
            clearBtn.classList.add('visible');
          } else {
            clearBtn.classList.remove('visible');
          }
        }
        renderArticles(currentCategory);
      }

      function closeCalendar(type) {
        var popup = document.getElementById('calendar-' + type);
        if (popup) popup.classList.remove('open');
      }

      function toggleCalendar(type) {
        var popup = document.getElementById('calendar-' + type);
        if (!popup) return;
        var otherType = (type === 'from' ? 'to' : 'from');
        var otherPopup = document.getElementById('calendar-' + otherType);
        if (otherPopup) otherPopup.classList.remove('open');
        popup.classList.toggle('open');
        if (popup.classList.contains('open')) {
          renderCalendar(type);
        }
      }

      function initDatePickers() {
        var fromInput = document.getElementById('date-from-display');
        var toInput = document.getElementById('date-to-display');
        if (fromInput) {
          fromInput.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleCalendar('from');
          });
        }
        if (toInput) {
          toInput.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleCalendar('to');
          });
        }
        var navBtns = document.querySelectorAll('.calendar-nav .nav-btn');
        for (var i = 0; i < navBtns.length; i++) {
          navBtns[i].addEventListener('click', function(e) {
            e.stopPropagation();
            var dir = parseInt(this.dataset.dir);
            var popup = this.closest('.calendar-popup');
            if (!popup) return;
            var type = popup.id.replace('calendar-', '');
            var state = datePickerState[type];
            if (!state) return;
            state.month += dir;
            if (state.month < 0) { state.month = 11; state.year--; }
            if (state.month > 11) { state.month = 0; state.year++; }
            renderCalendar(type);
          });
        }
        var todayBtns = document.querySelectorAll('.calendar-footer .today-btn');
        for (var j = 0; j < todayBtns.length; j++) {
          todayBtns[j].addEventListener('click', function(e) {
            e.stopPropagation();
            var popup = this.closest('.calendar-popup');
            if (!popup) return;
            var type = popup.id.replace('calendar-', '');
            var now = new Date();
            var y = now.getFullYear();
            var m = String(now.getMonth() + 1).padStart(2, '0');
            var d = String(now.getDate()).padStart(2, '0');
            var dateStr = y + '-' + m + '-' + d;
            var state = datePickerState[type];
            if (state) {
              state.year = now.getFullYear();
              state.month = now.getMonth();
            }
            selectDate(type, dateStr);
          });
        }
        var clearBtns = document.querySelectorAll('.calendar-footer .clear-date-btn');
        for (var k = 0; k < clearBtns.length; k++) {
          clearBtns[k].addEventListener('click', function(e) {
            e.stopPropagation();
            var popup = this.closest('.calendar-popup');
            if (!popup) return;
            var type = popup.id.replace('calendar-', '');
            var state = datePickerState[type];
            if (state) {
              state.value = '';
              updateDatePickerDisplay(type, '');
              if (type === 'from') {
                searchFilters.dateFrom = '';
              } else {
                searchFilters.dateTo = '';
              }
              renderCalendar(type);
              var clearBtn = document.getElementById('search-clear');
              if (clearBtn) {
                if (searchFilters.query || searchFilters.dateFrom || searchFilters.dateTo) {
                  clearBtn.classList.add('visible');
                } else {
                  clearBtn.classList.remove('visible');
                }
              }
              renderArticles(currentCategory);
              closeCalendar(type);
            }
          });
        }
        document.addEventListener('click', function(e) {
          var pickers = document.querySelectorAll('.custom-date-picker');
          for (var p = 0; p < pickers.length; p++) {
            if (!pickers[p].contains(e.target)) {
              var type = pickers[p].dataset.picker;
              var popup = document.getElementById('calendar-' + type);
              if (popup) popup.classList.remove('open');
            }
          }
        });
        renderCalendar('from');
        renderCalendar('to');
      }

      function bindEvents() {
        var catBtns = document.querySelectorAll('.category-btn');
        for (var i = 0; i < catBtns.length; i++) {
          catBtns[i].addEventListener('click', function() {
            resetAllFilters();
            currentTag = '';
            renderArticles(this.dataset.category);
          });
        }

        var searchToggle = document.getElementById('search-toggle');
        var searchPanel = document.getElementById('search-panel');
        var searchInput = document.getElementById('search-input');
        var searchClear = document.getElementById('search-clear');
        var searchTimer = null;

        function triggerSearchLoad() {
          if (!searchIndexData && !searchIndexLoading) {
            loadSearchIndex().then(function() {
              if (searchFilters.query) renderArticles(currentCategory);
            }).catch(function() {
              console.warn('search-index.json 加载失败，全文搜索不可用');
            });
          }
        }

        function openSearch() {
          searchPanel.classList.add('active');
          searchToggle.classList.add('active');
          setTimeout(function() { searchInput.focus(); }, 200);
          triggerSearchLoad();
        }

        function closeSearch() {
          searchPanel.classList.remove('active');
          searchToggle.classList.remove('active');
          searchInput.blur();
        }

        function resetSearch() {
          searchFilters.query = '';
          searchFilters.dateFrom = '';
          searchFilters.dateTo = '';
          currentSearchQuery = '';
          currentTag = '';
          datePickerState.from.value = '';
          datePickerState.to.value = '';
          updateDatePickerDisplay('from', '');
          updateDatePickerDisplay('to', '');
          syncSearchFiltersToUI();
          renderArticles('all');
        }

        searchToggle.addEventListener('click', function(e) {
          e.stopPropagation();
          if (searchPanel.classList.contains('active')) {
            closeSearch();
            resetSearch();
          } else {
            openSearch();
          }
        });

        searchInput.addEventListener('input', function() {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(function() {
            searchFilters.query = searchInput.value.trim();
            currentSearchQuery = searchFilters.query;
            if (searchFilters.query || searchFilters.dateFrom || searchFilters.dateTo) {
              searchClear.classList.add('visible');
            } else {
              searchClear.classList.remove('visible');
            }
            if (searchFilters.query && !searchIndexData && !searchIndexLoading) {
              triggerSearchLoad();
            }
            renderArticles(currentCategory);
          }, 250);
        });

        searchClear.addEventListener('click', function(e) {
          e.stopPropagation();
          resetAllFilters();
          currentTag = '';
          searchInput.focus();
        });

        searchInput.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            resetSearch();
            closeSearch();
          }
        });

        var fieldCheckboxes = document.querySelectorAll('.search-filters input[type="checkbox"][data-field]');
        for (var k = 0; k < fieldCheckboxes.length; k++) {
          fieldCheckboxes[k].addEventListener('change', function() {
            searchFilters.fields[this.dataset.field] = this.checked;
            renderArticles(currentCategory);
          });
        }

        initDatePickers();

        document.getElementById('about-btn').addEventListener('click', function() {
          var card = document.getElementById('about-card');
          card.style.display = card.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', function(e) {
          var about = document.getElementById('about-card');
          if (about.style.display === 'block' && !e.target.closest('#about-card') && !e.target.closest('#about-btn')) {
            about.style.display = 'none';
          }
          var func = document.getElementById('func-card');
          if (func.style.display === 'block' && !e.target.closest('#func-card') && !e.target.closest('#func-btn')) {
            func.style.display = 'none';
          }
          if (searchPanel.classList.contains('active') &&
            !e.target.closest('#search-panel') &&
            !e.target.closest('#search-toggle')) {
            closeSearch();
            resetSearch();
          }
        });

        var luckBtn = document.getElementById('luck-btn');
        if (luckBtn) luckBtn.addEventListener('click', getDailyLuck);

        var rssLink = document.getElementById('rss-link');
        if (rssLink) {
          rssLink.addEventListener('click', function(e) {
            e.preventDefault();
            var rssUrl = window.location.origin + '/rss.xml';
            copyToClipboard(rssUrl);
            showToast('RSS 链接已复制到剪贴板！', 'success');
          });
        }
      }

      function copyToClipboard(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      async function initializePage() {
        try {
          updateLoadingProgress(8, '正在初始化...');
          try {
            var resp = await fetch('/articles.json');
            articlesData = await resp.json();
          } catch(e) {
            console.warn('articles.json 加载失败:', e);
            articlesData = [];
          }
          updateLoadingProgress(20, articlesData.length ? '文章数据已就绪' : '无文章数据');

          updateLoadingProgress(30, '正在渲染文章...');
          var urlParams = new URLSearchParams(window.location.search);
          var urlTag = urlParams.get('tag');
          if (urlTag) {
            currentTag = urlTag.toLowerCase();
          }
          syncSearchFiltersToUI();
          renderArticles('all');
          updateLoadingProgress(55, '文章渲染完成');

          updateLoadingProgress(60, '正在加载美句...');
          try {
            await loadSentences();
          } catch (e) {
            addLoadingError('美句加载失败');
          }
          updateLoadingProgress(80, '美句加载完成');

          loadWallpaperBackground().then(function(ok) {
            if (!ok) {
              console.log('壁纸加载失败，保持极光背景显示');
            }
          }).catch(function(e) {
            console.warn('壁纸加载异常，保持极光背景:', e);
          });

          updateLoadingProgress(92, '即将完成...');
          bindEvents();
          initLuckResult();
          updateRuntime();
          setInterval(updateRuntime, 1000);
          loadContacts();

          document.getElementById('func-btn').addEventListener('click', function() {
            var card = document.getElementById('func-card');
            card.style.display = card.style.display === 'block' ? 'none' : 'block';
            if (card.style.display === 'block' && !window.historyLoaded) loadHistoryToday();
          });
          document.getElementById('close-func-card').addEventListener('click', function() {
            document.getElementById('func-card').style.display = 'none';
          });
          document.getElementById('close-about-btn').addEventListener('click', function() {
            document.getElementById('about-card').style.display = 'none';
          });

          updateLoadingProgress(100, '加载完成˶>ᗜ<˶');
          hideLoadingOverlay();
          flushLoadingErrors();
        } catch (e) {
          console.error(e);
          showToast('初始化失败: ' + e.message, 'error');
          hideLoadingOverlay();
          flushLoadingErrors();
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePage);
      } else {
        initializePage();
      }

      // [sidebar] 标签云入口：复用首页现有标签筛选逻辑
      window.xundeiFilterByTag = function (tagName) {
        if (!tagName) return;
        if (currentTag === tagName) { currentTag = ''; } else { currentTag = tagName; }
        resetAllFilters();
        renderArticles('all');
      };