/**
 * 对比旧版构建产物与新 Astro 构建产物。
 * 用法: node scripts/compare-dist.mjs <oldDist> <newDist>
 * sitemap.xml / rss.xml 中含构建时间戳（lastmod/lastBuildDate），比对时单独归一化。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [oldDir, newDir] = process.argv.slice(2);
if (!oldDir || !newDir) {
  console.error('用法: node scripts/compare-dist.mjs <oldDist> <newDist>');
  process.exit(1);
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

const normalize = (rel, content) => {
  // 行尾符差异不算内容差异：旧版产物为 Windows CRLF，新版统一 LF
  let c = content.replace(/\r\n/g, '\n');
  if (rel === 'sitemap.xml') return c.replace(/<lastmod>[^<]+<\/lastmod>/g, '<lastmod>#</lastmod>');
  if (rel === 'rss.xml') {
    return c
      .replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/g, '<lastBuildDate>#</lastBuildDate>')
      .replace(/<pubDate>[^<]+<\/pubDate>/g, '<pubDate>#</pubDate>');
  }
  return c;
};

const oldFiles = listFiles(oldDir);
const newFiles = listFiles(newDir);
const all = [...new Set([...oldFiles, ...newFiles])].sort();

let same = 0;
const diffs = [];
const onlyOld = [];
const onlyNew = [];

for (const rel of all) {
  const o = path.join(oldDir, rel);
  const n = path.join(newDir, rel);
  const oExists = fs.existsSync(o);
  const nExists = fs.existsSync(n);
  if (!oExists) { onlyNew.push(rel); continue; }
  if (!nExists) { onlyOld.push(rel); continue; }
  const oc = normalize(rel, fs.readFileSync(o, 'utf8'));
  const nc = normalize(rel, fs.readFileSync(n, 'utf8'));
  const oh = crypto.createHash('sha256').update(oc).digest('hex');
  const nh = crypto.createHash('sha256').update(nc).digest('hex');
  if (oh === nh) same++;
  else diffs.push(rel);
}

console.log(`相同: ${same} 个文件`);
if (diffs.length) {
  console.log(`\n内容不同 (${diffs.length}):`);
  for (const d of diffs) console.log('  ~ ' + d);
}
if (onlyOld.length) {
  console.log(`\n仅旧版存在 (${onlyOld.length}):`);
  for (const d of onlyOld) console.log('  - ' + d);
}
if (onlyNew.length) {
  console.log(`\n仅新版存在 (${onlyNew.length}):`);
  for (const d of onlyNew) console.log('  + ' + d);
}

// 输出第一个差异的细节，便于修复
if (diffs.length) {
  const rel = diffs[0];
  const oc = normalize(rel, fs.readFileSync(path.join(oldDir, rel), 'utf8'));
  const nc = normalize(rel, fs.readFileSync(path.join(newDir, rel), 'utf8'));
  let i = 0;
  while (i < Math.min(oc.length, nc.length) && oc[i] === nc[i]) i++;
  console.log(`\n=== 第一个差异文件: ${rel}（位置 ${i}）===`);
  console.log('--- 旧版 ---');
  console.log(JSON.stringify(oc.slice(Math.max(0, i - 120), i + 160)));
  console.log('--- 新版 ---');
  console.log(JSON.stringify(nc.slice(Math.max(0, i - 120), i + 160)));
}
