// 一次性转换脚本：为全站引入亮/深色主题（亮色 = 莫奈极光 + 深色文字，深色 = 暗极光/壁纸 + 浅色文字）。
// 处理 index.frame.json / article.frame.json / notfound.frame.json（friends.astro 手工同步同款逻辑）。
// 用法：node scripts/apply-theme.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libDir = path.join(root, 'src', 'lib');

// —— 白字保持不变的例外选择器（实底蓝按钮/深色面板/代码块上的文字） ——
const EXCEPTION_SELECTORS = [
  'modal-read-full',
  'read-more:hover',
  'tag-active',
  'pagination-btn.active',
  'about-btn',
  'back-btn',
  '.toast',
  'func-btn',
  'copy-btn',
  'fold-btn',
  'day-cell.selected',
  'contact-tooltip',
  'calendar-popup',
  'loading-card',
  'friend-card:hover .friend-icon',
  'home-btn',
  'error-code',
];

// 遍历顶层 CSS 规则，回调收到 { headStart, head, end }
function forEachRule(css, fn) {
  let i = 0;
  const n = css.length;
  let unitStart = 0;
  let depth = 0;
  let headEnd = -1;
  while (i < n) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) headEnd = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        fn({ headStart: unitStart, head: css.slice(unitStart, headEnd), end: i + 1 });
        unitStart = i + 1;
      }
    }
    i++;
  }
}

function collectAlphas(css) {
  const set = new Set();
  const re = /color:\s*rgba\(255,\s*255,\s*255,\s*(0?\.\d+)\)/g;
  let m;
  while ((m = re.exec(css))) set.add(Math.round(parseFloat(m[1]) * 100));
  return [...set].sort((a, b) => b - a);
}

function lightColor(n) {
  return n === 100 ? '#2d3a4b' : `rgba(45, 58, 75, 0.${String(n).padStart(2, '0')})`;
}
function darkColor(n) {
  return n === 100 ? '#fff' : `rgba(255, 255, 255, 0.${String(n).padStart(2, '0')})`;
}

function buildThemeCss(alphas) {
  const darkVars = alphas.map((n) => `      --w-${n}: ${darkColor(n)};`).join('\n');
  const lightVars = alphas.map((n) => `      --w-${n}: ${lightColor(n)};`).join('\n');
  return `
    /* ===== 亮/深色主题文字变量（默认深色值，html.theme-light 覆盖为深字浅底） ===== */
    :root {
${darkVars}
    }
    html.theme-light {
${lightVars}
      --text-color: #2d3a4b;
      --glass-bg: rgba(255, 255, 255, 0.42);
      --glass-border: rgba(255, 255, 255, 0.55);
      --glass-shadow: 0 8px 32px rgba(70, 90, 120, 0.14);
    }
    html.theme-dark {
      --aurora-gradient: linear-gradient(135deg, #2e3d55 0%, #3b3153 50%, #4d3d55 100%);
      --aurora-primary: #5d7fa8;
      --aurora-secondary: #8d6ba1;
    }
`;
}

const TOGGLE_CSS = `
    /* ===== 主题切换按钮（与 .search-toggle 同款玻璃圆钮） ===== */
    .theme-toggle {
      position: fixed;
      top: 20px;
      right: 76px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: var(--w-85, rgba(255, 255, 255, 0.85));
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1000;
      transition: all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1.2);
      font-size: 1.1rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
    }
    .theme-toggle:hover {
      background: rgba(66, 133, 244, 0.35);
      color: var(--w-100, #fff);
      transform: scale(1.08);
    }
`;

const TOGGLE_HTML = `  <div class="theme-toggle" id="theme-toggle" role="button" aria-label="切换亮色/深色模式" title="切换亮色/深色模式">
    <i class="fas fa-moon"></i>
  </div>
`;

const HEAD_SCRIPT = `  <script>
    // 首屏前定主题：localStorage > 系统偏好 > 亮色
    (function () {
      var t;
      try { t = localStorage.getItem('xundei-theme'); } catch (e) {}
      if (t !== 'dark' && t !== 'light') {
        t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.classList.add('theme-' + t);
    })();
  </script>
`;

const CONTROLLER_SCRIPT = `
  <script>
    // 主题切换控制器：切类名 + 换图标 + 持久化；壁纸等页面行为经 window.xundeiOnThemeChange 挂钩
    (function () {
      var KEY = 'xundei-theme';
      function currentTheme() {
        return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
      }
      function syncIcon() {
        var icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = currentTheme() === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      }
      function applyTheme(theme) {
        var root = document.documentElement;
        root.classList.remove('theme-light', 'theme-dark');
        root.classList.add('theme-' + theme);
        syncIcon();
        if (typeof window.xundeiOnThemeChange === 'function') window.xundeiOnThemeChange(theme);
      }
      function bindToggle() {
        var btn = document.getElementById('theme-toggle');
        if (!btn || btn.dataset.themeBound) return;
        btn.dataset.themeBound = '1';
        btn.addEventListener('click', function () {
          var next = currentTheme() === 'dark' ? 'light' : 'dark';
          try { localStorage.setItem(KEY, next); } catch (e) {}
          applyTheme(next);
        });
        syncIcon();
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggle);
      } else {
        bindToggle();
      }
    })();
  </script>
`;

function rewriteWhiteText(css) {
  // 例外规则先用占位符保护，再做全文替换
  const skipRanges = [];
  forEachRule(css, (u) => {
    const selector = u.head.trim();
    if (EXCEPTION_SELECTORS.some((ex) => selector.includes(ex)) || selector.startsWith('@keyframes')) {
      skipRanges.push([u.headStart, u.end]);
    }
  });
  const stash = [];
  for (let i = skipRanges.length - 1; i >= 0; i--) {
    const [s, e] = skipRanges[i];
    stash.unshift(css.slice(s, e));
    css = css.slice(0, s) + `\u0000STASH${i}\u0000` + css.slice(e);
  }
  let out = css
    .replace(/color:\s*var\(--light-text\)(\s*!important)?/g, (s, imp) => `color: var(--w-100)${imp || ''}`)
    .replace(/color:\s*#ffffff\b(\s*!important)?/gi, (s, imp) => `color: var(--w-100)${imp || ''}`)
    .replace(/color:\s*#fff\b(\s*!important)?/gi, (s, imp) => `color: var(--w-100)${imp || ''}`)
    .replace(/color:\s*white\b(\s*!important)?/gi, (s, imp) => `color: var(--w-100)${imp || ''}`)
    .replace(/color:\s*rgba\(255,\s*255,\s*255,\s*(0?\.\d+)\)(\s*!important)?/g, (s, a, imp) => {
      const n = Math.round(parseFloat(a) * 100);
      return `color: var(--w-${n})${imp || ''}`;
    });
  stash.forEach((seg, i) => {
    out = out.replace(`\u0000STASH${i}\u0000`, () => seg);
  });
  return out;
}

function processFrame(file, { toggleAfter = 'id="search-toggle"', toggleRightOverride = null } = {}) {
  const raw = JSON.parse(readFileSync(path.join(libDir, file), 'utf8'));
  let frame = raw.frame;
  const styleStart = frame.indexOf('<style');
  const styleEnd = frame.indexOf('</style>');
  let css = frame.slice(styleStart, styleEnd);

  // 1) 白字 → 主题变量
  const alphas = collectAlphas(css);
  css = rewriteWhiteText(css);

  // 2) 极光背景去掉黑色叠加层（与原站一致）
  css = css.replace(
    /linear-gradient\(rgba\(0,\s*0,\s*0,\s*0\.1\),\s*rgba\(0,\s*0,\s*0,\s*0\.1\)\),\s*\n?\s*var\(--aurora-gradient\)/,
    'var(--aurora-gradient)'
  );

  // 3) 移除按小时切换的 theme-evening 块（由亮/深色主题替代）
  css = css.replace(/\n\s*body\.theme-evening\s*\{[^{}]*\}/g, '');

  // 4) 注入主题变量 + 切换按钮样式
  css = css + buildThemeCss(alphas) + TOGGLE_CSS;
  if (toggleRightOverride) {
    css = css.replace(/(\.theme-toggle \{[^}]*?right:) 76px;/, `$1 ${toggleRightOverride};`);
  }

  frame = frame.slice(0, styleStart) + css + frame.slice(styleEnd);

  // 5) 首屏主题预置脚本（<head> 内，避免闪烁）
  frame = frame.replace('</head>', HEAD_SCRIPT + '</head>');

  // 6) 切换按钮 HTML
  const anchor = frame.indexOf(toggleAfter);
  if (anchor >= 0) {
    const divStart = frame.lastIndexOf('<div', anchor);
    const indent = (/(\n\s*)$/.exec(frame.slice(0, divStart)) || [null, '\n  '])[1];
    frame = frame.slice(0, divStart) + TOGGLE_HTML + frame.slice(divStart);
    console.log(`[ok] ${file} toggle inserted before <div @${divStart}> (indent=${JSON.stringify(indent)})`);
  } else {
    throw new Error(`${file}: toggle anchor not found: ${toggleAfter}`);
  }

  // 7) 控制器脚本追加到 </body> 前
  frame = frame.replace('</body>', CONTROLLER_SCRIPT + '</body>');

  raw.frame = frame;
  writeFileSync(path.join(libDir, file), JSON.stringify(raw));
  console.log(`[ok] ${file} alphas: ${collectAlphas(frame).join(',')} len=${frame.length}`);
}

processFrame('index.frame.json');
processFrame('article.frame.json', { toggleAfter: 'id="brightness-overlay"', toggleRightOverride: '20px' });

// notfound.frame.json 是 JSON 字符串
{
  let nf = JSON.parse(readFileSync(path.join(libDir, 'notfound.frame.json'), 'utf8'));
  const styleStart = nf.indexOf('<style');
  const styleEnd = nf.indexOf('</style>');
  let css = nf.slice(styleStart, styleEnd);
  const alphas = collectAlphas(css);
  css = rewriteWhiteText(css);
  css = css.replace(/\n\s*body\.theme-evening\s*\{[^{}]*\}/g, '');
  css = css + buildThemeCss(alphas) + TOGGLE_CSS;
  css = css.replace(/(\.theme-toggle \{[^}]*?right:) 76px;/, '$1 20px;');
  nf = nf.slice(0, styleStart) + css + nf.slice(styleEnd);
  nf = nf.replace('</head>', HEAD_SCRIPT + '</head>');
  nf = nf.replace(/(\s*<div class="error-container">)/, '\n' + TOGGLE_HTML + '$1');
  nf = nf.replace('</body>', CONTROLLER_SCRIPT + '</body>');
  writeFileSync(path.join(libDir, 'notfound.frame.json'), JSON.stringify(nf));
  console.log(`[ok] notfound.frame.json alphas: ${alphas.join(',')}`);
}
