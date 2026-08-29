// 一次性转换脚本：玻璃与文字样式随壁纸状态切换（收敛到 wallpaper-active 一套机制）。
// - 壁纸加载成功、替换背景的那一刻：脚本给 <html> 加 wallpaper-active 类
//   （加载成功路径 hideAuroraBackground / loadImage 中），
//   经 CSS 变量覆盖恢复博客最初样式（与明暗主题无关）：
//   玻璃 bg rgba(255,255,255,0.25) / 边框 rgba(255,255,255,0.35) / 阴影 0 8px 32px rgba(0,0,0,0.08)；
//   文字恢复最初白色系（--w-* 全量、--text-color、--link-color）。
// - 壁纸未加载完成或加载失败：不加类，保持按时间段定制的明暗主题玻璃与文字样式。
// 同时清理早前引入的 wallpaper-loaded 冗余机制（CSS 块与加类语句）。
// 脚本可重复执行（各步骤幂等）。
// 用法：node scripts/sync-glass-wallpaper.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libDir = path.join(root, 'src', 'lib');

function fail(msg) {
  throw new Error(msg);
}

// 按文件自身的 --w-* 集合，生成「壁纸加载完成后」的覆盖块：最初磨砂玻璃 + 最初白色文字
function buildActiveCss(src) {
  const rootBlocks = src.match(/:root \{[^}]*\}/g) || [];
  const block = rootBlocks.find((b) => b.includes('--w-100')) || fail('未找到含 --w-100 的 :root 块');
  const names = [...new Set([...block.matchAll(/--w-(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => b - a);
  if (!names.length) fail(':root 中没有 --w-* 变量');
  const lines = names.map((n) =>
    n === 100 ? '      --w-100: #fff;' : `      --w-${n}: rgba(255, 255, 255, 0.${String(n).padStart(2, '0')});`
  );
  const hasLink = src.includes('--link-color');
  if (hasLink) lines.push('      --link-color: #a1c4fd;');
  return [
    '/* 壁纸加载完成后：玻璃与文字恢复博客最初样式（与明暗主题无关） */',
    '    html.wallpaper-active {',
    '      --glass-bg: rgba(255, 255, 255, 0.25);',
    '      --glass-border: rgba(255, 255, 255, 0.35);',
    '      --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);',
    ...lines,
    '      --text-color: #fff;',
    '    }',
  ].join('\n');
}

function cleanLoaded(src, label) {
  // 1) 移除 wallpaper-loaded CSS 块（含注释）
  const loadedCssRe = /\n?[ \t]*\/\* 壁纸加载完成后：玻璃恢复最初的磨砂样式（与明暗主题无关） \*\/\n?[ \t]*html\.wallpaper-loaded \{[^}]*\}\n?/g;
  src = src.replace(loadedCssRe, '\n');
  // 2) 移除 wallpaper-loaded 加类语句
  const loadedAddRe = /[ \t]*document\.documentElement\.classList\.add\('wallpaper-loaded'\);\n/g;
  src = src.replace(loadedAddRe, '');
  if (src.includes('wallpaper-loaded')) fail(`${label}: wallpaper-loaded 残留`);
  return src;
}

function ensureActiveCss(src, label) {
  const blockRe = /\/\* [^\n]*?恢复博客最初样式[^\n]*? \*\/\s*html\.wallpaper-active \{[^}]*\}/;
  if (blockRe.test(src)) {
    // 已有块（含旧注释/旧值）：按本文件的 --w-* 集合整体重建
    return src.replace(blockRe, buildActiveCss(src));
  }
  const legacyRe = /html\.wallpaper-active \{[^}]*\}/;
  if (legacyRe.test(src)) {
    // 已有块但注释不符：整体替换
    return src.replace(legacyRe, buildActiveCss(src));
  }
  // 没有：插到 theme-dark 块之后
  const darkRe = /html\.theme-dark \{[\s\S]*?\n[ \t]*\}/;
  if (!darkRe.test(src)) fail(`${label}: html.theme-dark 块未找到`);
  return src.replace(darkRe, (m) => m + '\n    ' + buildActiveCss(src));
}

function ensureActiveAdd(src, label) {
  if (src.includes("add('wallpaper-active')")) return src;
  const fadeRe = /([ \t]*)auroraBg\.classList\.add\('fade-out'\);/;
  if (!fadeRe.test(src)) fail(`${label}: auroraBg fade-out 未找到`);
  return src.replace(fadeRe, (m, ind) => `document.documentElement.classList.add('wallpaper-active');\n${ind}${m}`);
}

// —— 帧模板：CSS（淡出逻辑在独立 script 文件中） ——
for (const file of ['index.frame.json', 'article.frame.json']) {
  const p = path.join(libDir, file);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  let src = cleanLoaded(raw.frame, file);
  src = ensureActiveCss(src, file);
  raw.frame = src;
  writeFileSync(p, JSON.stringify(raw));
  console.log(`[ok] ${file}（CSS）`);
}

// —— 内联脚本模板：CSS + 加类 ——
for (const file of ['notfound.frame.json']) {
  const p = path.join(libDir, file);
  let src = cleanLoaded(JSON.parse(readFileSync(p, 'utf8')), file);
  src = ensureActiveCss(src, file);
  src = ensureActiveAdd(src, file);
  writeFileSync(p, JSON.stringify(src));
  console.log(`[ok] ${file}`);
}

// —— 页面脚本文件：加类 ——
for (const file of ['index.script.json', 'article.script.json']) {
  const p = path.join(libDir, file);
  let src = cleanLoaded(JSON.parse(readFileSync(p, 'utf8')), file);
  src = ensureActiveAdd(src, file);
  writeFileSync(p, JSON.stringify(src));
  console.log(`[ok] ${file}（加类）`);
}

// —— friends.astro ——
const friendsPath = path.join(root, 'src', 'pages', 'friends.astro');
let fr = cleanLoaded(readFileSync(friendsPath, 'utf8'), 'friends.astro');
fr = ensureActiveCss(fr, 'friends.astro');
fr = ensureActiveAdd(fr, 'friends.astro');
writeFileSync(friendsPath, fr);
console.log('[ok] friends.astro');
