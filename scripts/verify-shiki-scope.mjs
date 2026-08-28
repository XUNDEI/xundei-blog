/**
 * Shiki 差异范围验证：
 * 对比两个 dist，将「文章页主内联脚本区」与「<pre> 代码块」归一化后，
 * 其余内容必须逐字节一致 —— 即差异只允许出现在 1) 代码块部分（Shiki 预期）
 * 和 2) 客户端脚本（3c 要求的染色移除/语言标签兼容）。
 * 用法: node scripts/verify-shiki-scope.mjs <oldDist> <newDist>
 */
import fs from 'node:fs';
import path from 'node:path';

const [oldDir, newDir] = process.argv.slice(2);
if (!oldDir || !newDir) {
  console.error('用法: node scripts/verify-shiki-scope.mjs <oldDist> <newDist>');
  process.exit(1);
}

const normalize = (rel, content) => {
  let c = content.replace(/\r\n/g, '\n');
  if (rel === 'sitemap.xml') return c.replace(/<lastmod>[^<]+<\/lastmod>/g, '<lastmod>#</lastmod>');
  if (rel === 'rss.xml') {
    return c
      .replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/g, '<lastBuildDate>#</lastBuildDate>')
      .replace(/<pubDate>[^<]+<\/pubDate>/g, '<pubDate>#</pubDate>');
  }
  return c;
};

// 归一化：主内联脚本区 → 占位符；<pre>…</pre> → 占位符
function maskScriptAndPre(html) {
  let out = html.replace(
    /<script>\n\s*\(function\(\) \{[\s\S]*?\}\)\(\);\n\s*<\/script>/g,
    '<script>#MAIN-SCRIPT#</script>'
  );
  out = out.replace(/<pre[\s\S]*?<\/pre>/g, '<pre>#CODE#</pre>');
  return out;
}

function listFiles(dir, base = '') {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel.replaceAll('\\', '/'));
  }
  return out;
}

const all = [...new Set([...listFiles(oldDir), ...listFiles(newDir)])].sort();
let ok = 0;
const bad = [];
for (const rel of all) {
  const o = path.join(oldDir, rel);
  const n = path.join(newDir, rel);
  if (!fs.existsSync(o) || !fs.existsSync(n)) { bad.push(rel + ' (文件缺失)'); continue; }
  const a = maskScriptAndPre(normalize(rel, fs.readFileSync(o, 'utf8')));
  const b = maskScriptAndPre(normalize(rel, fs.readFileSync(n, 'utf8')));
  if (a === b) ok++;
  else bad.push(rel);
}

console.log(`归一化后一致: ${ok} 个文件`);
if (bad.length) {
  console.log(`归一化后仍有差异 (${bad.length}) —— 差异超出代码块/客户端脚本范围:`);
  for (const b of bad) console.log('  ✗ ' + b);
  const rel = bad[0].replace(' (文件缺失)', '');
  const o = path.join(oldDir, rel);
  const n = path.join(newDir, rel);
  if (fs.existsSync(o) && fs.existsSync(n)) {
    const a = maskScriptAndPre(normalize(rel, fs.readFileSync(o, 'utf8')));
    const b = maskScriptAndPre(normalize(rel, fs.readFileSync(n, 'utf8')));
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    console.log(`\n=== ${rel} 残留差异位置 ${i} ===`);
    console.log('OLD:', JSON.stringify(a.slice(Math.max(0, i - 120), i + 200)));
    console.log('NEW:', JSON.stringify(b.slice(Math.max(0, i - 120), i + 200)));
  }
  process.exit(1);
} else {
  console.log('✅ 所有差异都被限制在：<pre> 代码块 + 文章页客户端脚本（含 rss.xml 正文 CDATA 内的代码块）');
}
