// 一次性转换脚本：主题策略与目标博客（莫奈个人博客）对齐。
// 1) 去掉手动亮/暗切换按钮（按钮样式/HTML/控制器脚本），改为按时间段自动定主题：
//    18:00–6:00 夜间 → theme-dark（黄昏睡莲），其余 → theme-light（清晨睡莲）。
// 2) 暗色模式配色改为目标博客「黄昏睡莲」：
//    渐变 #F4C4A8→#C9A0B6→#5B6D8A，光球 #E8A87C/#6B4E71，文字 #F5EDE4 系，
//    玻璃卡 rgba(40,30,50,0.35) / 边框 rgba(255,255,255,0.1)。
// 3) 壁纸亮度遮罩恢复为与主题无关的原始逻辑（仅压暗偏亮壁纸，黑色遮罩），
//    并移除 window.xundeiOnThemeChange 挂钩。
// 脚本可重复执行（各步骤幂等）。
// 用法：node scripts/sync-theme-time.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libDir = path.join(root, 'src', 'lib');

function fail(msg) {
  throw new Error(msg);
}

// —— 生成 theme-dark 块：基于文件自身 :root 的 --w-* 集合，统一换成 #F5EDE4（245,237,228）系 ——
function buildDarkBlock(src) {
  const rootBlocks = src.match(/:root \{[^}]*\}/g) || [];
  const block = rootBlocks.find((b) => b.includes('--w-100')) || fail('未找到含 --w-100 的 :root 块');
  const names = [...block.matchAll(/--w-(\d+)/g)].map((m) => Number(m[1]));
  if (!names.length) fail(':root 中没有 --w-* 变量');
  const uniq = [...new Set(names)].sort((a, b) => b - a);
  const lines = uniq.map((n) =>
    n === 100 ? '      --w-100: #F5EDE4;' : `      --w-${n}: rgba(245, 237, 228, 0.${String(n).padStart(2, '0')});`
  );
  return [
    '    html.theme-dark {',
    ...lines,
    '      --text-color: #F5EDE4;',
    '      --aurora-gradient: linear-gradient(135deg, #F4C4A8 0%, #C9A0B6 50%, #5B6D8A 100%);',
    '      --aurora-primary: #E8A87C;',
    '      --aurora-secondary: #6B4E71;',
    '      --glass-bg: rgba(40, 30, 50, 0.35);',
    '      --glass-border: rgba(255, 255, 255, 0.1);',
    '    }',
  ].join('\n');
}

function processFrameText(frame, tail, label) {
  let out = frame;
  let outTail = tail || '';

  // 1) 首屏主题脚本：localStorage/系统偏好 → 按时间段（幂等：已替换则跳过）
  const headRe = /([ \t]*)<script( is:inline)?>\n[ \t]*\/\/ 首屏前定主题[^\n]*\n[\s\S]*?<\/script>/;
  const headMatch = out.match(headRe);
  if (headMatch) {
    const [, indent, inlineAttr] = headMatch;
    const lines = [
      `${indent}<script${inlineAttr || ''}>`,
      `${indent}  // 按时间段自动定主题：18:00–6:00 夜间（黄昏），其余为白天（清晨）`,
      `${indent}  (function () {`,
      `${indent}    var h = new Date().getHours();`,
      `${indent}    document.documentElement.classList.add(h >= 18 || h < 6 ? 'theme-dark' : 'theme-light');`,
      `${indent}  })();`,
      `${indent}</script>`,
    ].join('\n');
    out = out.replace(headRe, () => lines);
  } else if (!out.includes('按时间段自动定主题')) {
    fail(`${label}: 首屏主题脚本未找到`);
  }

  // 2) 移除切换按钮 CSS（幂等）
  const toggleCssRe = /\n?[ \t]*\/\* ===== 主题切换按钮[^\n]*\*\/[ \t]*\n[ \t]*\.theme-toggle \{[^}]*\}[ \t]*\n[ \t]*\.theme-toggle:hover \{[^}]*\}/;
  out = out.replace(toggleCssRe, '');

  // 3) 移除切换按钮 HTML（幂等）
  const toggleHtmlRe = /\n?[ \t]*<div class="theme-toggle" id="theme-toggle"[\s\S]*?<\/div>/;
  out = out.replace(toggleHtmlRe, '');

  // 4) 移除控制器脚本（可能在 frame 内，也可能在 tail 中；幂等）
  const ctrlRe = /[ \t]*<script( is:inline)?>\n[ \t]*\/\/ 主题切换控制器[\s\S]*?<\/script>\n?/;
  if (ctrlRe.test(out)) out = out.replace(ctrlRe, '');
  else outTail = outTail.replace(ctrlRe, '');

  // 5) 替换 theme-dark 块为「黄昏睡莲」配色
  const darkRe = /html\.theme-dark \{[\s\S]*?\n[ \t]*\}/;
  if (!darkRe.test(out)) fail(`${label}: html.theme-dark 块未找到`);
  out = out.replace(darkRe, () => buildDarkBlock(out));

  return { frame: out, tail: outTail };
}

// —— JSON 模板 ——
for (const file of ['index.frame.json', 'article.frame.json', 'notfound.frame.json']) {
  const p = path.join(libDir, file);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  if (typeof raw === 'string') {
    writeFileSync(p, JSON.stringify(processFrameText(raw, '', file).frame));
  } else {
    const next = processFrameText(raw.frame, raw.tail || '', file);
    raw.frame = next.frame;
    if (raw.tail != null) raw.tail = next.tail;
    writeFileSync(p, JSON.stringify(raw));
  }
  console.log(`[ok] ${file}`);
}

// —— friends.astro ——
const friendsPath = path.join(root, 'src', 'pages', 'friends.astro');
writeFileSync(friendsPath, processFrameText(readFileSync(friendsPath, 'utf8'), '', 'friends.astro').frame);
console.log('[ok] friends.astro');

// —— 页面脚本：去掉主题挂钩，恢复原始亮度遮罩逻辑 ——
// index/article 两文件缩进不同，按注释边界定位、以标记所在行缩进对齐重写。
function lineIndent(script, pos) {
  const lineStart = script.lastIndexOf('\n', pos) + 1;
  return (/^[ \t]*/.exec(script.slice(lineStart)) || [''])[0];
}

// 从 startMarker 行起替换到 endFinder 给出的边界；已处理（含 doneMarker）则跳过
function splice(script, startMarker, endFinder, replacement, label, doneMarker) {
  if (doneMarker && script.includes(doneMarker)) return script;
  const start = script.indexOf(startMarker);
  if (start < 0) fail(`${label}: 起始标记未找到`);
  const end = endFinder(script, start);
  if (end < 0) fail(`${label}: 结束边界未找到`);
  return script.slice(0, start) + replacement + script.slice(end);
}

const ORIGINAL_RADIAL = [
  'let radialGradient = \'\';',
  'if (centerDiff > threshold) {',
  '  // 中心偏亮，添加中心暗化径向渐变',
  '  const centerAlpha = Math.min(0.55, centerDiff / 80 * 0.55);',
  '  radialGradient = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${centerAlpha}) 0%, rgba(0,0,0,0) 70%)`;',
  '} else if (cornersDiff > threshold) {',
  '  // 四角偏亮，添加暗角效果（中心透明，边缘暗）',
  '  const cornerAlpha = Math.min(0.5, cornersDiff / 80 * 0.5);',
  '  radialGradient = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,${cornerAlpha}) 100%)`;',
  '}',
];

for (const file of ['index.script.json', 'article.script.json']) {
  const p = path.join(libDir, file);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const script = typeof raw === 'string' ? raw : fail(`${file}: 意外的 JSON 结构`);

  // 1) 主题挂钩 → 仅保留注释（hook 体内第一个 `};` 即其自身结尾）
  const hookDone = '// 壁纸为主背景，极光仅作加载失败后备\n';
  let next = splice(
    script,
    '// 壁纸为主背景，极光仅作加载失败后备；主题切换时按新主题重算亮度遮罩',
    (s, start) => s.indexOf('};', start) + 2,
    '// 壁纸为主背景，极光仅作加载失败后备',
    `${file} 主题挂钩`,
    hookDone
  );

  // 2) 亮度整体段（到 overallAlpha 三元表达式结束的分号）
  const headMark = '// 深色模式（浅字）：偏亮壁纸压暗；亮色模式（深字）：偏暗壁纸提亮';
  const headDone = '// 整体亮度调节：平均亮度超过 150 时，叠加整体暗化';
  {
    const probe = next.includes(headMark) ? next.indexOf(headMark) : next.indexOf(headDone);
    const ind = lineIndent(next, probe);
    next = splice(
      next,
      headMark,
      (s, start) => s.indexOf(';', s.indexOf('const overallAlpha = isDark', start)) + 1,
      `${ind}${headDone}\n${ind}const overallAlpha = Math.max(0, Math.min(0.65, (avg - 150) / 105 * 0.65));`,
      `${file} 亮度整体段`,
      headDone
    );
  }

  // 3) 线性遮罩 veilColor → 0,0,0
  const linearOld = 'backgroundStyle += `linear-gradient(rgba(${veilColor},${overallAlpha}), rgba(${veilColor},${overallAlpha}))`;';
  const linearNew = 'backgroundStyle += `linear-gradient(rgba(0,0,0,${overallAlpha}), rgba(0,0,0,${overallAlpha}))`;';
  if (next.includes(linearOld)) next = next.replace(linearOld, linearNew);
  else if (!next.includes('`linear-gradient(rgba(0,0,0,${overallAlpha})')) fail(`${file} 亮度线性遮罩未找到`);

  // 4) 径向遮罩段（从 let radialGradient 到 if/else-if 链闭合；链尾 `}` 后不能跟 ` else`）
  if (!next.includes(ORIGINAL_RADIAL[6])) {
    const pos = next.indexOf('let radialGradient');
    if (pos < 0) fail(`${file} 径向遮罩未找到`);
    const ind = lineIndent(next, pos);
    let segEnd = -1;
    let from = pos;
    for (;;) {
      segEnd = next.indexOf(`\n${ind}}`, from);
      if (segEnd < 0) break;
      const after = next.slice(segEnd + 1 + ind.length + 1, segEnd + 1 + ind.length + 6);
      if (!/^ else/.test(after)) break;
      from = segEnd + 1;
    }
    if (segEnd < 0) fail(`${file} 径向遮罩结束边界未找到`);
    next = next.slice(0, pos) + ind + ORIGINAL_RADIAL.join('\n' + ind) + next.slice(segEnd);
  }

  writeFileSync(p, JSON.stringify(next));
  console.log(`[ok] ${file}（亮度遮罩恢复原始逻辑，主题挂钩已移除）`);
}
