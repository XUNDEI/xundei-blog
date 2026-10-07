// ===== Cloudflare 图床拦截检测（首页 / 文章页共用，由 BaseLayout 内的 ImageGuard 组件内联） =====
// 目的：当 <img> 加载失败时，区分「图片不存在 / 网络环境差」与「被 Cloudflare 盾拦截」，
// 只在最后一种情况下弹提示窗，前两种保持原样不打扰用户。
//
// 判据来自对本图床（xundei.dpdns.org，Sanyue ImgHub + Cloudflare CDN）的实测：
//   1) 文件不存在（/file/**）→ 返回一张固定的 418744 字节占位 JPEG，浏览器能正常解码，
//      根本不会触发 img.onerror；即便触发了，下面的「二次图片探测」也会直接加载成功。
//   2) 路径不是文件 API（返回图床自己的 SPA HTML，带 Access-Control-Allow-Origin: *）
//      → 图片解码失败触发 onerror，但 CORS fetch 能读到 text/html。
//   3) 被 Cloudflare 拦截（质询页 / 1020 / 429 / 503 错误页）→ 返回的是无 ACAO 的 HTML，
//      图片解码失败、CORS fetch 被拦（TypeError），而 no-cors fetch 仍能拿到响应。
//   4) 断网 / DNS 失败 / 连不上 → no-cors fetch 直接 reject。
//
// 因此三级判定：图片二次探测（排除占位图）→ no-cors 是否有响应（排除网络问题）
// → CORS 是否可读（区分图床自身页面与 CF 拦截页）。
(function () {
  'use strict';

  // 需要守护的图床域名（改图床时同步这里）
  var IMAGE_HOSTS = ['xundei.dpdns.org'];
  // 单次探测超时（毫秒）
  var PROBE_TIMEOUT = 9000;
  // 一次访问内最多探测几次。正常情况第一张失败图就能定性（被拦截即弹窗并清空队列），
  // 留出余量只是为了扛住少数图片的偶发加载失败，不至于因此漏判。
  var MAX_PROBES = 6;

  var dialogShown = false;
  var probeCount = 0;
  var probeQueue = [];
  var probing = false;
  // 已经探测过（无论结论如何）的 URL：首页切换分类/翻页会重建卡片 DOM，
  // 同一批图片会再次触发 error，靠这张表避免重复打图床，也避免反复弹窗。
  var probedUrls = Object.create(null);

  // 把 URL 归一成稳定的键：去掉探测用的随机参数，只留 pathname + 业务查询串
  function urlKey(url) {
    try {
      var u = new URL(url, location.href);
      u.searchParams.delete('cf_guard_probe');
      return u.origin + u.pathname + (u.search || '');
    } catch (e) {
      return String(url).replace(/[?&]cf_guard_probe=[^&]*/g, '');
    }
  }

  function isGuardedImage(img) {
    if (!img || img.tagName !== 'IMG') return false;
    // 探测用临时图片不参与，否则会自我递归
    if (img.getAttribute('data-cf-guard-probe') === '1') return false;
    // 已提示过就不再重复
    if (img.getAttribute('data-cf-guard-done') === '1') return false;
    // 灯箱有自己的交互，单独处理，避免叠加两个弹层
    if (img.id === 'lightbox-img') return false;

    var src = img.currentSrc || img.getAttribute('src');
    if (!src || !/^https?:\/\//i.test(src)) return false; // 站内图片不算

    var host = '';
    try {
      host = new URL(src, location.href).hostname;
    } catch (e) {
      return false;
    }
    return IMAGE_HOSTS.indexOf(host) !== -1;
  }

  function withCacheBuster(url) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'cf_guard_probe=' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function fetchWithTimeout(url, options) {
    if (typeof AbortController === 'undefined') return fetch(url, options);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, PROBE_TIMEOUT);
    var opts = {};
    for (var k in options) {
      if (Object.prototype.hasOwnProperty.call(options, k)) opts[k] = options[k];
    }
    opts.signal = controller.signal;
    return fetch(url, opts).then(
      function (res) { clearTimeout(timer); return res; },
      function (err) { clearTimeout(timer); throw err; }
    );
  }

  // 第一级：用一张全新的普通 <img> 再拉一次（带 cache-buster，绕开失败缓存）。
  // 能加载出来 → 说明这张图本身没问题（例如图床的 404 占位图），不是拦截。
  function probeImageDecodes(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.setAttribute('data-cf-guard-probe', '1');
      var done = false;
      var timer = setTimeout(function () { finish(false); }, PROBE_TIMEOUT);
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        resolve(ok);
      }
      img.onload = function () { finish(img.naturalWidth > 0); };
      img.onerror = function () { finish(false); };
      img.src = url;
    });
  }

  // 第三级：CORS 读到的内容定性。
  // 能读到且是图片 → 其实没问题；能读到但是 HTML → 图床自己的页面（图片不存在）。
  function probeCors(url) {
    return fetchWithTimeout(url, { method: 'GET', mode: 'cors', cache: 'no-store' }).then(
      function (res) {
        var type = '';
        try { type = (res.headers.get('content-type') || '').toLowerCase(); } catch (e) { type = ''; }
        return res.text().then(
          function (body) { return { readable: true, status: res.status, type: type, body: body }; },
          function () { return { readable: true, status: res.status, type: type, body: '' }; }
        );
      },
      function () { return { readable: false }; }
    );
  }

  // 第二级：no-cors 请求。只有「服务器完全没回应」才会 reject。
  function probeAnyResponse(url) {
    return fetchWithTimeout(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).then(
      function () { return true; },
      function () { return false; }
    );
  }

  // Cloudflare 拦截页的典型特征（在能读到正文时做二次确认）
  var CF_MARKERS = [
    'cf-chl', 'cf_chl_opt', 'challenge-platform', '__cf_chl',
    'just a moment', 'attention required', 'you have been blocked',
    'cf-error-details', 'cloudflare ray id', 'error 1020'
  ];

  function looksLikeCloudflarePage(info) {
    if (!info || !info.readable) return true; // 读不到正文：典型 CF 质询页
    var body = (info.body || '').toLowerCase();
    for (var i = 0; i < CF_MARKERS.length; i++) {
      if (body.indexOf(CF_MARKERS[i]) !== -1) return true;
    }
    return false;
  }

  // 结论：'blocked' | 'missing' | 'network' | 'ok'
  function classify(url) {
    return probeImageDecodes(withCacheBuster(url)).then(function (decodes) {
      if (decodes) return 'ok';
      return probeAnyResponse(withCacheBuster(url)).then(function (responded) {
        if (!responded) return 'network';
        return probeCors(withCacheBuster(url)).then(function (info) {
          if (info.readable) {
            if (/^image\//.test(info.type)) return 'ok';
            if (/text\/html/.test(info.type) && !looksLikeCloudflarePage(info)) return 'missing';
            return looksLikeCloudflarePage(info) ? 'blocked' : 'missing';
          }
          // 有响应但被 CORS 挡住：不是图床自己的页面（那会带 ACAO），即 CF 拦截页
          return 'blocked';
        });
      });
    });
  }

  function el(id) { return document.getElementById(id); }

  function showDialog(url) {
    var overlay = el('cf-guard');
    if (!overlay) return;
    var jump = el('cf-guard-jump');
    if (jump) jump.setAttribute('href', url);
    overlay.classList.add('is-open');
    overlay.removeAttribute('aria-hidden');
    dialogShown = true;
    var focusTarget = jump || el('cf-guard-close');
    if (focusTarget && focusTarget.focus) {
      try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); }
    }
  }

  function hideDialog() {
    var overlay = el('cf-guard');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function processQueue() {
    if (probing || dialogShown || probeQueue.length === 0) return;
    if (probeCount >= MAX_PROBES) return;
    var url = probeQueue.shift();
    probing = true;
    probeCount++;
    classify(url).then(function (verdict) {
      probing = false;
      probedUrls[urlKey(url)] = verdict;
      if (verdict === 'blocked' && !dialogShown) {
        showDialog(url);
        probeQueue.length = 0;
        return;
      }
      processQueue();
    }, function () {
      probing = false;
      processQueue();
    });
  }

  function onResourceError(event) {
    var img = event.target;
    if (!isGuardedImage(img)) return;
    img.setAttribute('data-cf-guard-done', '1');
    if (dialogShown) return;
    // 明确断网时不要误报，交给网络恢复逻辑
    if (navigator.onLine === false) return;
    var url = img.currentSrc || img.getAttribute('src');
    if (!url) return;
    var key = urlKey(url);
    // 这张图已经探测过了：已知被拦截就直接弹窗（首页重新渲染时立即提示，不再重打图床）
    if (probedUrls[key] === 'blocked') {
      showDialog(url);
      return;
    }
    if (probedUrls[key]) return; // missing / network / ok：保持原样
    if (probeQueue.indexOf(url) === -1) probeQueue.push(url);
    processQueue();
  }

  function bindDialog() {
    var overlay = el('cf-guard');
    if (!overlay) return;
    ['cf-guard-close', 'cf-guard-later'].forEach(function (id) {
      var btn = el(id);
      if (btn) btn.addEventListener('click', hideDialog);
    });
    var refresh = el('cf-guard-refresh');
    if (refresh) refresh.addEventListener('click', function () { location.reload(); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hideDialog();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) hideDialog();
    });
  }

  // 资源错误不冒泡，必须在捕获阶段监听 window 才能拿到全部图片（含首页动态插入的卡片）
  window.addEventListener('error', onResourceError, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDialog);
  } else {
    bindDialog();
  }
})();
