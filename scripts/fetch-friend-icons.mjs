/**
 * 友链图标抓取脚本：把每个友链站点的真实图标下载到 public/friends/，并把本地路径
 * 回写到 src/data/friends.json 的 icon 字段。
 *
 * 为什么需要它：友链页原先只请求 `<对方域名>/favicon.ico`，但很多站点（例如
 * neolguo.top）并不在根目录放 favicon.ico，而是在 <link rel="icon"> 里声明
 * /icons/favicon.svg。根目录那个 .ico 要么不存在、要么是长期没更新的旧图标，
 * 于是页面上显示的是错的图标。
 *
 * 本脚本按以下优先级取值：
 *   1. <link rel="icon"> / <link rel="shortcut icon"> —— 站点自己声明的图标（含 SVG）
 *   2. <link rel="apple-touch-icon"> —— 通常是更高分辨率的 PNG
 *   3. <origin>/favicon.ico —— 传统的兜底
 *   4. https://favicon.im/<host>?larger=true —— 第三方代理兜底
 * 下载后会校验字节确实是图片（magic bytes / SVG 文本），失败则顺延下一个来源。
 *
 * 用法：
 *   node scripts/fetch-friend-icons.mjs           # 只处理 icon 为空或非本地的友链
 *   node scripts/fetch-friend-icons.mjs --force   # 全部重新抓取
 *
 * 注意：这是手动运行的维护脚本，不参与 astro build，构建过程始终离线可用；
 * 页面侧仍保留远端回退链（见 src/pages/friends.astro），本地文件缺失也不会白板。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const friendsJsonPath = path.join(projectRoot, 'src', 'data', 'friends.json');
const outDir = path.join(projectRoot, 'public', 'friends');

const force = process.argv.includes('--force');
const TIMEOUT_MS = 15000;
// 常见浏览器 UA：部分站点会对非浏览器 UA 返回 403 或跳验证页
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const data = JSON.parse(fs.readFileSync(friendsJsonPath, 'utf8'));

/** 带超时的 fetch（跟随重定向） */
async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,image/*,*/*;q=0.8' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 从 HTML 中按优先级提取候选图标地址 */
function extractIconUrls(html, baseUrl) {
  const found = [];
  const tagRe = /<(?:link)\b[^>]*>/gi;
  for (const tag of html.match(tagRe) || []) {
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']*)["']/i) || tag.match(/\brel\s*=\s*([^\s>]+)/i);
    if (!relMatch) continue;
    const rel = relMatch[1].toLowerCase();
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i) || tag.match(/\bhref\s*=\s*([^\s>]+)/i);
    if (!hrefMatch) continue;
    let href = hrefMatch[1].trim();
    if (!href || href.startsWith('data:')) continue;
    const isIcon = /\b(shortcut\s+)?icon\b/.test(rel);
    const isApple = /apple-touch-icon/.test(rel);
    if (!isIcon && !isApple) continue;
    try {
      href = new URL(href, baseUrl).href;
    } catch {
      continue;
    }
    // icon 优先于 apple-touch-icon；rel 里明确写了 svg 的再优先
    const priority = (isIcon ? 0 : 10) + (/svg/i.test(tag) ? 0 : 1);
    found.push({ href, priority });
  }
  found.sort((a, b) => a.priority - b.priority);
  return [...new Set(found.map((f) => f.href))];
}

/** 用 magic bytes 判断下载到的字节是不是图片，并给出扩展名 */
function sniffImage(buf, contentType = '') {
  const b = buf;
  if (b.length < 12) return null;
  const ct = contentType.toLowerCase();
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return 'ico';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  // SVG 是文本，允许有 BOM / 前导空白 / XML 声明
  const head = b.toString('utf8', 0, Math.min(400, b.length)).replace(/^\uFEFF/, '').trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && /<svg[\s>]/i.test(head))) return 'svg';
  if (ct.includes('svg')) return 'svg';
  return null;
}

/** 下载并校验一个候选地址，返回 { buf, ext } 或 null */
async function downloadImage(url) {
  try {
    const res = await get(url);
    if (!res.ok) {
      console.log(`      跳过 ${url} → HTTP ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 1024 * 1024) {
      console.log(`      跳过 ${url} → 体积异常 ${buf.length}B`);
      return null;
    }
    const ext = sniffImage(buf, res.headers.get('content-type') || '');
    if (!ext) {
      console.log(`      跳过 ${url} → 不是图片（content-type=${res.headers.get('content-type')}）`);
      return null;
    }
    return { buf, ext };
  } catch (err) {
    console.log(`      跳过 ${url} → ${err.name === 'AbortError' ? '超时' : err.message}`);
    return null;
  }
}

function slugFor(friend) {
  try {
    return new URL(friend.url).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return friend.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}

/** 为一个友链解析并落地图标；成功返回本地路径 */
async function resolveIcon(friend) {
  const label = friend.name || friend.url;
  console.log(`\n→ ${label} (${friend.url})`);

  const candidates = [];
  // 已手动指定远端图标时，把它放在最前面（但仍保留后续兜底）
  if (friend.icon && /^https?:\/\//i.test(friend.icon)) candidates.push(friend.icon);

  let origin = null;
  try {
    origin = new URL(friend.url).origin;
  } catch {
    console.log('    URL 非法，跳过');
    return null;
  }

  // 站点自己声明的图标（读 HTML）
  try {
    const res = await get(friend.url);
    if (res.ok) {
      const html = await res.text();
      const declared = extractIconUrls(html, friend.url);
      if (declared.length) console.log(`    声明图标: ${declared.join(', ')}`);
      candidates.push(...declared);
    } else {
      console.log(`    首页 HTTP ${res.status}，退回根目录 favicon`);
    }
  } catch (err) {
    console.log(`    首页抓取失败（${err.name === 'AbortError' ? '超时' : err.message}），退回根目录 favicon`);
  }

  candidates.push(`${origin}/favicon.ico`);
  candidates.push(`https://favicon.im/${new URL(friend.url).hostname}?larger=true`);

  for (const url of [...new Set(candidates)]) {
    const got = await downloadImage(url);
    if (!got) continue;
    fs.mkdirSync(outDir, { recursive: true });
    const file = `${slugFor(friend)}.${got.ext}`;
    fs.writeFileSync(path.join(outDir, file), got.buf);
    const local = `/friends/${file}`;
    console.log(`    ✓ ${url}\n      → public${local} (${got.buf.length}B, ${got.ext})`);
    return local;
  }

  console.log('    ✗ 所有来源都失败，保留原值（页面会显示回退链接图标）');
  return null;
}

const friends = data.friends || [];
let changed = 0;

for (const friend of friends) {
  // 已是本地路径且文件存在时，除非 --force 否则跳过
  const isLocal = typeof friend.icon === 'string' && friend.icon.startsWith('/friends/');
  if (isLocal && !force) {
    const abs = path.join(projectRoot, 'public', friend.icon.replace(/^\//, ''));
    if (fs.existsSync(abs)) {
      console.log(`\n= ${friend.name || friend.url} 已有本地图标 ${friend.icon}，跳过（--force 可重抓）`);
      continue;
    }
  }
  const local = await resolveIcon(friend);
  if (local) {
    friend.icon = local;
    changed++;
  }
}

if (changed > 0) {
  fs.writeFileSync(friendsJsonPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n已更新 ${changed} 个 icon 字段 → src/data/friends.json`);
} else {
  console.log('\n没有变更。');
}
