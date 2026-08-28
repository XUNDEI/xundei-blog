/**
 * 一次性迁移脚本：把旧版 index.html / templates/article.html 程序化转换成
 * Astro 项目所需的框架与脚本文本资源。
 *
 * 输出（src/lib/*.json）：
 *   - index.frame.json    { frame, pre, tail }——首页骨架；
 *                         pre 是 "<script>" 到主 IIFE 花括号止的原文，
 *                         tail 是 IIFE 结束到 </html> 止的原文，
 *                         三段与内部代码按原样拼接即为逐字节一致的完整页面。
 *   - index.script.json   首页主脚本 IIFE 内部代码（已改为从内联数据读取文章）
 *   - article.frame.json  文章页骨架 { frame, pre, tail }（占位符都在 frame 中）
 *   - article.script.json 文章页主脚本（相对路径改为根路径）
 *   - notfound.frame.json 404 页整页原文（其脚本本就使用根路径）
 *
 * 用法：node scripts/migrate-from-old.mjs <旧博客目录>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const oldDir = process.argv[2];
if (!oldDir) {
  console.error('用法: node scripts/migrate-from-old.mjs <旧博客目录>');
  process.exit(1);
}

const outDir = path.join(projectRoot, 'src', 'lib');
fs.mkdirSync(outDir, { recursive: true });

function readOld(rel) {
  return fs.readFileSync(path.join(oldDir, rel), 'utf8').replace(/\r\n/g, '\n');
}

/** 把一个含单个内联主脚本的 HTML 页面拆为 frame/pre/tail + 内部代码 */
function extractMainScript(htmlText, openMarker, fnOpen, fnClose) {
  const scriptIdx = htmlText.indexOf(openMarker);
  if (scriptIdx < 0) throw new Error(`未找到主脚本标记: ${JSON.stringify(openMarker)}`);
  const frame = htmlText.slice(0, scriptIdx);
  const rest = htmlText.slice(scriptIdx);
  const a = rest.indexOf(fnOpen);
  if (a < 0) throw new Error(`未找到函数开头: ${fnOpen}`);
  const b = rest.lastIndexOf(fnClose);
  if (b <= a) throw new Error('未找到函数结尾或顺序异常');
  const pre = rest.slice(0, a + fnOpen.length); // 含 <script> 标签与 IIFE 开头
  const inner = rest.slice(a + fnOpen.length, b); // IIFE 函数体
  const tail = rest.slice(b); // 含 "})();" 到文件结尾
  if (/<\/script>/i.test(inner)) throw new Error('脚本内含 </script>，需另行处理');
  return { frame, pre, inner, tail };
}

// ===================== 首页 =====================
{
  const html = readOld('index.html');
  const { frame, pre, inner, tail } = extractMainScript(
    html,
    '\n  <script>\n',
    '    (function() {',
    '    })();'
  );

  // 首页脚本原样保留：运行时仍从 /articles.json 获取文章数据（与旧版行为一致）。
  // [v2] 末尾追加侧栏标签云桥接入口：仍在 IIFE 内部，复用现有
  // currentTag / resetAllFilters / renderArticles，与卡片标签、弹窗标签同一套筛选状态。
  const script = inner + '\n' + [
    '      // [sidebar] 标签云入口：复用首页现有标签筛选逻辑',
    '      window.xundeiFilterByTag = function (tagName) {',
    "        if (!tagName) return;",
    "        if (currentTag === tagName) { currentTag = ''; } else { currentTag = tagName; }",
    '        resetAllFilters();',
    "        renderArticles('all');",
    '      };'
  ].join('\n');

  // 首页根路径下的资源保持不变；这里仅确认引用存在，防止误改
  for (const needle of ["'./sentences.txt'", "'./wallpaper.json'", "'/articles.json'"]) {
    if (!script.includes(needle)) throw new Error(`未找到预期引用 ${needle}`);
  }

  // 首页 <style> 保持原样输出，不做 Astro 样式处理
  const frameOut = frame;

  fs.writeFileSync(path.join(outDir, 'index.frame.json'), JSON.stringify({ frame: frameOut, pre, tail }));
  fs.writeFileSync(path.join(outDir, 'index.script.json'), JSON.stringify(script));
  console.log('✓ index.frame.json / index.script.json');
}

// ===================== 文章页 =====================
{
  const tpl = readOld(path.join('templates', 'article.html'));
  const { frame, pre, inner, tail } = extractMainScript(
    tpl,
    '\n    <script>\n',
    '        (function() {',
    '        })();'
  );

  // 占位符应当只出现在 frame 中（build.js 对整个模板做 replace，占位符均不在脚本里）
  const ph = /\{\{[A-Z_]+\}\}/;
  if (ph.test(inner)) throw new Error('脚本内出现模板占位符，需要重新设计拆分点');
  if (!ph.test(frame)) throw new Error('frame 中未发现占位符');

  const script = inner
    // [shiki] 移除旧版客户端 highlight.js 染色调用（构建期已由 Shiki 高亮，避免双重染色）。
    // 代码复制/折叠按钮、语言标签等其余功能全部保留。
    .replace(
      /[ \t]*const codeElements = document\.querySelectorAll\('pre code'\);\r?\n[\s\S]*?if \(codeElements\.length > 0\) \{\r?\n[ \t]*requestAnimationFrame\(highlightNextBatch\);\r?\n[ \t]*\}\r?\n/,
      ''
    )
    // [shiki] 语言标签兼容：Shiki 把语言放在 pre 的 data-language 上（旧版在 code 的 language- 类名）
    .replace(
      "                    const language = (code.className || '').replace('language-', '') || 'code';",
      [
        "                    var language = (code.className || '').replace('language-', '');",
        "                    if (!language || language === 'code') {",
        "                        var shikiPre = code.closest ? code.closest('pre') : null;",
        "                        var dataLang = shikiPre ? (shikiPre.getAttribute('data-language') || '') : '';",
        '                        if (dataLang) { language = dataLang; }',
        '                    }',
        "                    if (!language) { language = 'code'; }"
      ].join('\n')
    );

  const frameOut = frame;

  fs.writeFileSync(path.join(outDir, 'article.frame.json'), JSON.stringify({ frame: frameOut, pre, tail }));
  fs.writeFileSync(path.join(outDir, 'article.script.json'), JSON.stringify(script));
  console.log('✓ article.frame.json / article.script.json');
}

console.log('迁移资源已写入 src/lib/');

// ===================== 404 页面 =====================
// 整页原样迁移（其内部脚本已使用根路径 /wallpaper.json，无需改写）
{
  const notFound = readOld('404.html');
  fs.writeFileSync(path.join(outDir, 'notfound.frame.json'), JSON.stringify(notFound));
  console.log('✓ notfound.frame.json');
}
