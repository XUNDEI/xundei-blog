/**
 * 从旧版 build.js 原样移植的站点常量与工具函数。
 * 所有排序、转义、格式化逻辑均与 build.js 保持一致，保证产物逐字节相同。
 */

export const SITE_URL = 'https://xundei.eu.cc';
export const SITE_NAME = "xundei's blog";
export const SITE_DESCRIPTION = 'xundei的个人博客——仰望星空，脚踏实地';

const categoryNames: Record<string, string> = {
  technology: '技术',
  diary: '日记',
  something: '杂碎',
  friend_link: '友链'
};

export function getCategoryName(cat: string): string {
  return categoryNames[cat] || cat;
}

export function normalizeTags(tags?: string[] | string | null | undefined): string {
  if (!tags) return '';
  if (Array.isArray(tags)) return tags.map(t => t.toLowerCase().trim()).filter(Boolean).join(', ');
  return String(tags).split(',').map(s => s.toLowerCase().trim()).filter(Boolean).join(', ');
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    .replace(/[#*`>|~_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calcReadingTime(text: string): number {
  return Math.ceil(text.replace(/\s+/g, '').length / 300);
}

export function articleFilename(id: string): string {
  // 与旧版 articles.json 中 filename 字段值完全一致
  return `blog/${id}.md`;
}

export function articleUrl(id: string): string {
  return `${SITE_URL}/articles/${id}`;
}

/** 复刻 build.js 的排序：latest（无则 date）倒序 localeCompare */
export function sortByArticlesOrder<T extends { latest?: string | boolean | undefined; date: string }>(
  articles: T[]
): T[] {
  return [...articles].sort((a, b) => {
    const aLatest = a.latest ? a.latest : a.date;
    const bLatest = b.latest ? b.latest : b.date;
    if (aLatest && bLatest) return String(bLatest).localeCompare(String(aLatest));
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return 0;
  });
}

// ========== XML/RSS 转义（与 build.js 相同的替换顺序） ==========
export function escapeXmlTitle(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeXmlDescription(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== SEO 标签生成 ==========
export interface SEOTagsResult {
  metaDescription: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  jsonLD: string;
}

interface ArticleMetaLike {
  title: string;
  date: string;
  category: string;
  excerpt?: string;
  tags?: string[];
}

export function generateSEOTags(article: ArticleMetaLike, slug: string): SEOTagsResult {
  const url = `${SITE_URL}/articles/${slug}`;
  const title = `${article.title} - ${SITE_NAME}`;
  const description = article.excerpt || SITE_DESCRIPTION;

  const tagsStr = normalizeTags(article.tags);
  const keywords = tagsStr || description;

  const jsonLD = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: description,
    keywords: keywords,
    datePublished: article.date,
    url: url,
    author: {
      '@type': 'Person',
      name: 'xundei'
    }
  };

  return {
    metaDescription: description,
    canonicalUrl: url,
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    jsonLD: JSON.stringify(jsonLD)
  };
}

// ========== 协议硬编码 HTML（与 build.js 相同） ==========
interface LicenseArticle {
  category: string;
  license?: string;
  'code-license'?: string;
}

export interface LicenseResult {
  /** 旧版模板占位符原值：'' 或 style="display: none;" */
  display: string;
  html: string;
}

export function getLicenseDisplayAndHtml(article: LicenseArticle): LicenseResult {
  // 友链文章不显示协议信息
  if (article.category === 'friend_link') {
    return { display: 'style="display: none;"', html: '' };
  }

  const license = article.license;
  const codeLicense = article['code-license'];

  // 正文 License 映射
  const licenseUrls: Record<string, string> = {
    'CC BY': 'https://creativecommons.org/licenses/by/4.0/',
    'CC BY-SA': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC BY-NC': 'https://creativecommons.org/licenses/by-nc/4.0/',
    'CC BY-ND': 'https://creativecommons.org/licenses/by-nd/4.0/',
    'CC BY-NC-SA': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    'CC BY-NC-ND': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
    CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
    保留所有权利: ''
  };

  // 代码 License 映射
  const codeLicenseUrls: Record<string, string> = {
    MIT: 'https://opensource.org/licenses/MIT',
    'Apache 2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
    GPL: 'https://www.gnu.org/licenses/gpl-3.0.html',
    LGPL: 'https://www.gnu.org/licenses/lgpl-3.0.html',
    BSD: 'https://opensource.org/licenses/BSD-3-Clause'
  };

  // 正文 License 显示
  let licenseHtml: string;
  if (license === '保留所有权利') {
    licenseHtml = '本文保留所有权利';
  } else if (license === 'CC0') {
    licenseHtml = `本文采用 <a href="${licenseUrls['CC0']}" target="_blank" rel="noopener noreferrer">CC0 1.0 通用 (CC0 1.0) 公共领域贡献</a>`;
  } else {
    const url = licenseUrls[license as string] || '';
    licenseHtml = `本文遵循 <a href="${url}" target="_blank" rel="noopener noreferrer">${license} 4.0 国际许可协议</a>`;
  }

  // 代码 License 显示（可选，没有 code-license 则不显示）
  let resultHtml = licenseHtml;
  if (codeLicense) {
    const codeUrl = codeLicenseUrls[codeLicense] || '';
    const codeHtml = `代码片段遵循 <a href="${codeUrl}" target="_blank" rel="noopener noreferrer">${codeLicense} 许可协议</a>`;
    resultHtml = `${licenseHtml} · ${codeHtml}`;
  }

  return { display: '', html: resultHtml };
}

// ========== 图片相对路径修正（RSS 用，逻辑同 build.js） ==========
// 旧版中文章输出于 dist/articles/<slug>.html，markdown 位于 blog/ 下，
// path.relative('dist/articles', 'blog') => '../../blog'
export function fixRelativePaths(markdown: string): string {
  const prefix = '../../blog/';
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match: string, alt: string, src: string) => {
    if (/^(https?:|\/\/|data:|\/)/i.test(src)) return match;
    return `![${alt}](${prefix}${src})`;
  });
}

/**
 * 去除 Astro 渲染产物中标题元素的 id 属性。
 * 旧版 marked 不生成标题 id，TOC 脚本按 heading-N 顺序编号；
 * Astro 内置 slugger 在用户 rehype 插件之后运行，只能在字符串层面移除。
 * 仅在构建期调用。
 */
export function removeHeadingIdAttrs(html: string): string {
  return html.replace(/<h([1-6])(\s[^>]*)?>/g, (open, level, attrs) => {
    if (!attrs) return open;
    const cleaned = attrs.replace(/\s+id=(?:"[^"]*"|'[^']*'|[^\s>]+)/g, '');
    return `<h${level}${cleaned}>`;
  });
}

/**
 * Astro 与 marked 的文本转义差异修正（渲染后处理，仅作用于文本区）：
 * - marked 把所有文本中的 & < > " ' 转义为实体；Astro 只转义 & 和 <（且 < 用 &#x3C;）。
 * - 处理方式：先还原 Astro 已产生的 &#x26; / &#x3C;，再按 marked 的五字符规则统一转义；
 *   对 & 保留 marked 规则：形如实体的引用（如 &copy;、&#39;）不重复转义。
 * 标签区（含属性值）、注释与 script/style 原文内容保持不动。
 * 仅在构建期调用。
 */
export function markedizeAstroHtml(html: string): string {
  const entityRe = /^&(?:#x?[0-9a-f]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/i;
  let out = '';
  let i = 0;
  const n = html.length;
  const rawTextTags = new Set(['script', 'style']);

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      out += escapeText(html.slice(i));
      break;
    }
    out += escapeText(html.slice(i, lt));

    // ---- 从 < 开始解析一个标签或注释/doctype，原样保留 ----
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      const stop = end < 0 ? n : end + 3;
      out += html.slice(lt, stop);
      i = stop;
      continue;
    }
    if (/[!?]/.test(html[lt + 1] ?? '')) {
      // <!DOCTYPE 或 <?...?> 原样保留
      const end = html.indexOf('>', lt);
      const stop = end < 0 ? n : end + 1;
      out += html.slice(lt, stop);
      i = stop;
      continue;
    }

    // 普通标签：解析出标签名并跳过引号内的属性
    let j = lt + 1;
    while (j < n && /[a-zA-Z0-9-]/.test(html[j])) j++;
    const tagName = html.slice(lt + 1, j).toLowerCase();
    const isClosing = html[lt + 1] === '/';
    const nameStart = isClosing ? lt + 2 : lt + 1;
    let k = nameStart;
    while (k < n && /[a-zA-Z0-9-]/.test(html[k])) k++;
    const realTagName = html.slice(nameStart, k).toLowerCase();

    let quote: string | null = null;
    while (j < n) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j++;
    }
    const stop = j < n ? j + 1 : n;
    out += html.slice(lt, stop);

    // script/style 为原文内容区，整块保留（marked 对内联 HTML 也是透传）
    if (!isClosing && rawTextTags.has(realTagName)) {
      const closeIdx = html.toLowerCase().indexOf('</' + realTagName, stop);
      const blockEnd = closeIdx < 0 ? n : closeIdx;
      out += html.slice(stop, blockEnd);
      i = blockEnd;
    } else {
      i = stop;
    }
  }

  function escapeText(text: string): string {
    if (!text) return '';
    // 先还原 Astro 特有的两种编码，避免二次转义
    const decoded = text.replaceAll('&#x26;', '&').replaceAll('&#x3C;', '<');
    let result = '';
    let p = 0;
    while (p < decoded.length) {
      const ch = decoded[p];
      if (ch === '&') {
        if (entityRe.test(decoded.slice(p))) {
          // 已是完整实体引用，按 marked 规则保持原样
          result += '&';
        } else {
          result += '&amp;';
        }
      } else if (ch === '<') result += '&lt;';
      else if (ch === '>') result += '&gt;';
      else if (ch === '"') result += '&quot;';
      else if (ch === "'") result += '&#39;';
      else result += ch;
      p++;
    }
    return result;
  }


  // 表格布局对齐：
  // 1) 收敛 Astro 在 <table> 前产生的多余换行，marked 为块间单换行；
  out = out.replace(/\n+<table>/g, '\n<table>');
  // 2) marked 的表格为逐单元格换行布局，Astro 为紧凑单行，此处重排为完全一致的形态。
  out = out.replace(/<table>([\s\S]*?)<\/table>/g, (_m, inner: string) => {
    const cellRe = /<(td|th)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/g;
    let result = '<table>';
    const headMatch = inner.match(/<thead>([\s\S]*?)<\/thead>/);
    if (headMatch) {
      result += '\n<thead>\n<tr>';
      let m: RegExpExecArray | null;
      while ((m = cellRe.exec(headMatch[1]))) {
        result += `\n<${m[1]}${m[2]}>${m[3]}</${m[1]}>`;
      }
      result += '\n</tr>\n</thead>';
      cellRe.lastIndex = 0;
    }
    result += '\n<tbody>';
    const bodyMatch = inner.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (bodyMatch) {
      const rows = bodyMatch[1].match(/<tr>[\s\S]*?<\/tr>/g) || [];
      for (const row of rows) {
        result += '<tr>';
        let m: RegExpExecArray | null;
        while ((m = cellRe.exec(row))) {
          result += `\n<${m[1]}${m[2]}>${m[3]}</${m[1]}>`;
        }
        result += '\n</tr>\n';
        cellRe.lastIndex = 0;
      }
    }
    result += '</tbody></table>';
    return result;
  });

  // 宽松列表输出对齐：marked 对由块级 HTML 引发的宽松项输出 `<li><p>`（无换行），
  // 而 Astro 输出 li 标签与首个 p 之间带换行。当前语料中差异仅出现在紧随 <li> 的首个 <p>。
  return out.replaceAll('<li>\n<p>', '<li><p>');
}

// ========== 旧版序列化行为复刻 ==========
/**
 * 旧版 build.js 按各 md 文件 front matter 的书写顺序序列化 JSON 字段，
 * 并固定追加 filename、latest、url。此函数按源文件中的键顺序组装对象。
 * 仅在构建期（Node 环境）调用。
 */
import fs from 'node:fs';
import path from 'node:path';

export interface PostLike {
  id: string;
  /** glob loader 提供的源文件绝对路径；id 来自 frontmatter slug 时与文件名不一致 */
  filePath?: string;
  body?: string;
  data: {
    title: string;
    date: string;
    latest?: string | boolean;
    category: string;
    excerpt?: string;
    tags?: string[];
    license?: string;
    'code-license'?: string;
  };
}

function getFrontMatterKeyOrder(post: PostLike, srcDir: string): string[] {
  // 优先用 loader 给出的真实路径；兜底按 id 拼路径（兼容旧数字文件名）
  const filePath = post.filePath ?? path.join(srcDir, `${post.id}.md`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
    if (!match) return [];
    const keys: string[] = [];
    for (const line of match[1].split(/\r?\n/)) {
      const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
      if (kv && !keys.includes(kv[1])) keys.push(kv[1]);
    }
    return keys;
  } catch {
    return [];
  }
}

export function buildLegacyIndexItem(post: PostLike, srcDir: string): Record<string, unknown> {
  // 与旧版 parseFrontMatter 一致：连字符键映射为驼峰后输出
  const camel = (k: string) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const d = post.data;
  const values: Record<string, unknown> = {
    title: d.title,
    date: d.date,
    ...(d.latest !== undefined ? { latest: d.latest } : {}),
    category: d.category,
    ...(d.excerpt !== undefined ? { excerpt: d.excerpt } : {}),
    ...(d.license !== undefined ? { license: d.license } : {}),
    ...(d['code-license'] !== undefined ? { 'code-license': d['code-license'] } : {}),
    ...(d.tags !== undefined ? { tags: normalizeTags(d.tags) } : {})
  };
  /**
   * 复刻 build.js 的两段序列化行为：
   * 1) 键按 front matter 书写顺序输出；
   * 2) 驼峰化循环（新增键 + delete 旧键）把带连字符的键移动到对象键序末尾，
   *    因此 code-license 恒定输出在最后（codeLicense）。
   */
  const item: Record<string, unknown> = {};
  const emitted = new Set<string>();
  const emittedCamel = new Set<string>();
  const deferred: Array<[string, unknown]> = [];

  for (const key of getFrontMatterKeyOrder(post, srcDir)) {
    let value: unknown;
    if (key === 'code-license') value = values['code-license'];
    else if (Object.prototype.hasOwnProperty.call(values, key)) value = values[key];
    else continue;
    if (value === undefined) continue;

    if (key.includes('-')) {
      // 连字符键延后（对象键序被移到末尾）
      deferred.push([camel(key), value]);
    } else {
      const k = camel(key);
      if (!emitted.has(k)) { item[k] = value; emitted.add(k); emittedCamel.add(k); }
    }
  }

  // 极端兜底：front matter 解析失败时补齐必需字段
  for (const k of ['title', 'date', 'category']) {
    if (!emitted.has(k) && values[k] !== undefined) { item[k] = values[k]; emitted.add(k); }
  }

  for (const [k, v] of deferred) {
    if (!emitted.has(k)) { item[k] = v; emitted.add(k); }
  }

  item.filename = articleFilename(post.id);
  item.latest = d.latest ? d.latest : false;
  item.url = articleUrl(post.id);
  return item;
}
