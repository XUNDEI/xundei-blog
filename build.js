const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// ========== 配置区 ==========
const SITE_URL = 'https://xundei.qzz.io';
const SITE_NAME = "xundei's blog";
const SITE_DESCRIPTION = 'xundei的个人博客——仰望星空，脚踏实地';
// ===========================

const categoryNames = {
  technology: '技术',
  diary: '日记',
  something: '杂碎',
  friend_link: '友链'
};

function getCategoryName(cat) {
  return categoryNames[cat] || cat;
}

// ========== Front Matter 解析 ==========
function parseFrontMatter(content) {
  // 移除可能的 UTF-8 BOM
  content = content.replace(/^\uFEFF/, '');

  // 匹配 YAML front matter（容忍 --- 前后有空白字符）
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
  if (!match) return null;

  const yamlBlock = match[1];
  const body = match[2] || '';

  const meta = {};
  for (const line of yamlBlock.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) {
      let val = kv[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      meta[kv[1]] = val;
    }
  }

  // 将包含连字符的键映射为驼峰形式（如 code-license -> codeLicense）
  for (const key of Object.keys(meta)) {
    if (key.includes('-')) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      meta[camelKey] = meta[key];
      delete meta[key];
    }
  }

  return { meta, body };
}

// ========== 扫描 blog 目录 ==========
function scanArticles() {
  const blogDir = path.join(__dirname, 'blog');
  const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontMatter(content);

    if (!parsed) {
      console.warn(`⚠ 警告: ${file} 缺少 front matter，跳过`);
      continue;
    }

    if (!parsed.meta.title) {
      console.warn(`⚠ 警告: ${file} 的 front matter 缺少 title，跳过`);
      continue;
    }

    articles.push({
      ...parsed.meta,
      filename: `blog/${file}`,
      body: parsed.body,
      latest: parsed.meta.latest !== undefined ? parsed.meta.latest : false
    });
  }

  articles.sort((a, b) => {
    const aLatest = a.latest ? a.latest : a.datetime || a.date;
    const bLatest = b.latest ? b.latest : b.datetime || b.date;
    if (aLatest && bLatest) return bLatest.localeCompare(aLatest);
    if (a.datetime && b.datetime) return b.datetime.localeCompare(a.datetime);
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return 0;
  });

  return articles;
}

function calcReadingTime(text) {
  return Math.ceil(text.replace(/\s+/g, '').length / 300);
}

function fixRelativePaths(markdown, mdFilePath, htmlOutputPath) {
  const mdDir = path.dirname(mdFilePath);
  const htmlDir = path.dirname(htmlOutputPath);
  const relativePrefix = path.relative(htmlDir, mdDir).replace(/\\/g, '/') + '/';
  const prefix = relativePrefix === './' ? '' : relativePrefix;

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (/^(https?:|\/\/|data:|\/)/i.test(src)) return match;
    return `![${alt}](${prefix}${src})`;
  });
}

// ========== SEO 标签生成 ==========
function generateSEOTags(article, slug) {
  const url = `${SITE_URL}/articles/${slug}`;
  const title = `${article.title} - ${SITE_NAME}`;
  const description = article.excerpt || SITE_DESCRIPTION;

  const jsonLD = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': article.title,
    'description': description,
    'datePublished': article.datetime || article.date,
    'url': url,
    'author': {
      '@type': 'Person',
      'name': 'xundei'
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

// ========== 生成协议硬编码 HTML ==========
function getLicenseDisplayAndHtml(article) {
  // 友链文章不显示协议信息
  if (article.category === 'friend_link') {
    return { display: 'style="display: none;"', html: '' };
  }

  const license = article.license;
  const codeLicense = article.codeLicense;

  // 正文 License 映射
  const licenseUrls = {
    'CC BY': 'https://creativecommons.org/licenses/by/4.0/',
    'CC BY-SA': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC BY-NC': 'https://creativecommons.org/licenses/by-nc/4.0/',
    'CC BY-ND': 'https://creativecommons.org/licenses/by-nd/4.0/',
    'CC BY-NC-SA': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    'CC BY-NC-ND': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    '保留所有权利': ''
  };

  // 代码 License 映射
  const codeLicenseUrls = {
    'MIT': 'https://opensource.org/licenses/MIT',
    'Apache 2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
    'GPL': 'https://www.gnu.org/licenses/gpl-3.0.html',
    'LGPL': 'https://www.gnu.org/licenses/lgpl-3.0.html',
    'BSD': 'https://opensource.org/licenses/BSD-3-Clause'
  };

  // 正文 License 显示
  let licenseHtml;
  if (license === '保留所有权利') {
    licenseHtml = '本文保留所有权利';
  } else if (license === 'CC0') {
    licenseHtml = `本文采用 <a href="${licenseUrls['CC0']}" target="_blank" rel="noopener noreferrer">CC0 1.0 通用 (CC0 1.0) 公共领域贡献</a>`;
  } else {
    const url = licenseUrls[license] || '';
    licenseHtml = `本文遵循 <a href="${url}" target="_blank" rel="noopener noreferrer">${license} 4.0 国际许可协议</a>`;
  }

  // 代码 License 显示
  const codeUrl = codeLicenseUrls[codeLicense] || '';
  const codeHtml = `代码片段（如有）遵循 <a href="${codeUrl}" target="_blank" rel="noopener noreferrer">${codeLicense} 许可协议</a>`;

  return {
    display: '',
    html: `${licenseHtml} · ${codeHtml}`
  };
}

// ========== 生成 sitemap.xml ==========
function generateSitemap(articles, siteUrl) {
  const now = new Date().toISOString().split('T')[0];

  let urls = `
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  for (const article of articles) {
    const slug = path.basename(article.filename, '.md');
    const lastmod = article.latest || article.date || now;
    urls += `
  <url>
    <loc>${siteUrl}/articles/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ========== 生成 RSS（已注入完整文章内容） ==========
function generateRSS(articles, siteUrl, siteName, siteDescription, distDir) {
  const now = new Date().toUTCString();

  let items = '';
  for (const article of articles) {
    // 跳过友链文章，不加入 RSS
    if (article.category === 'friend_link') continue;

    const slug = path.basename(article.filename, '.md');
    const url = `${siteUrl}/articles/${slug}`;
    const pubDate = article.datetime
      ? new Date(article.datetime).toUTCString()
      : now;

    if (!article.title) {
      console.warn(`⚠ 警告: ${article.filename} 缺少 title，跳过 RSS 条目`);
      continue;
    }

    const desc = (article.excerpt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // 生成完整文章 HTML（修正图片相对路径）
    const mdPath = path.join(__dirname, article.filename);
    const htmlOutputPath = path.join(distDir, 'articles', slug + '.html');
    let contentMarkdown = article.body;
    contentMarkdown = fixRelativePaths(contentMarkdown, mdPath, htmlOutputPath);
    const htmlContent = marked.parse(contentMarkdown);

    // CDATA 段安全转义（避免出现 ]]> 截断）
    const safeHtml = htmlContent.replace(/]]>/g, ']]]]><![CDATA[>');

    items += `
    <item>
      <title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${desc}</description>
      <content:encoded><![CDATA[${safeHtml}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <author>xundei</author>
    </item>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${siteName}</title>
    <link>${siteUrl}/</link>
    <description>${siteDescription}</description>
    <language>zh-CN</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${now}</lastBuildDate>${items}
  </channel>
</rss>`;
}

// ========== 追加 sitemap 到 robots.txt（仅追加，不创建） ==========
function appendSitemapToRobots(distDir, siteUrl) {
  const robotsPath = path.join(distDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    return; // robots.txt 由 Cloudflare 托管，不存在则跳过
  }

  let content = fs.readFileSync(robotsPath, 'utf-8');
  const sitemapLine = `Sitemap: ${siteUrl}/sitemap.xml`;

  if (!content.includes(sitemapLine)) {
    if (!content.endsWith('\n')) content += '\n';
    content += sitemapLine + '\n';
    fs.writeFileSync(robotsPath, content);
    console.log('✅ 已追加 Sitemap 引用到 robots.txt');
  }
}

// ========== 注入文章数据到 index.html（爬虫友好） ==========
function injectArticlesIntoIndex(articlesIndex, distDir) {
  const indexPath = path.join(distDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf-8');

  const scriptTag = `<script>window.__ARTICLES__ = ${JSON.stringify(articlesIndex)};</script>`;

  html = html.replace('</head>', `  ${scriptTag}\n</head>`);

  fs.writeFileSync(indexPath, html);
  console.log('✅ 已注入文章数据到 index.html');
}

// ========== 主构建函数 ==========
function build() {
  console.log('🔍 扫描 blog 目录...');
  const articles = scanArticles();
  console.log(`📄 发现 ${articles.length} 篇文章`);

  const articleTemplate = fs.readFileSync(
    path.join(__dirname, 'templates', 'article.html'),
    'utf-8'
  );

  const distDir = path.join(__dirname, 'dist');
  const articlesDir = path.join(distDir, 'articles');

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(articlesDir, { recursive: true });

  // 复制静态资源目录（已移除 'blog'，不再复制整个 blog 文件夹）
  const staticDirs = ['wallpaper'];  // 原先为 ['blog', 'wallpaper']
  for (const dir of staticDirs) {
    const src = path.join(__dirname, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(distDir, dir), { recursive: true });
    } else {
      console.warn(`目录 ${dir} 不存在，跳过复制`);
    }
  }

  // 复制根目录文件（index.html 单独处理以注入文章数据）
  const rootFiles = [
    'axios.min.js', 'wallpaper.json',
    'sentences.txt', 'portrait.png', 'favicon.ico',
    '404.html', '_redirects'
  ];
  for (const file of rootFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, file));
      console.log(`✅ 复制 ${file}`);
    } else {
      console.warn(`文件 ${file} 不存在，跳过复制`);
    }
  }

  // 复制 index.html（后续会注入内联数据）
  const indexSrc = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, path.join(distDir, 'index.html'));
    console.log('✅ 复制 index.html');
  }

  // BingSiteAuth.xml
  const bingAuthSrc = path.join(__dirname, 'BingSiteAuth.xml');
  if (fs.existsSync(bingAuthSrc)) {
    fs.copyFileSync(bingAuthSrc, path.join(distDir, 'BingSiteAuth.xml'));
    console.log('✅ 复制 BingSiteAuth.xml');
  }

  // 生成文章 HTML（含 SEO 标签、硬编码协议信息）
  for (const article of articles) {
    const mdPath = path.join(__dirname, article.filename);
    const slug = path.basename(article.filename, '.md');
    const htmlOutputPath = path.join(articlesDir, slug + '.html');

    if (!article.title || !article.body) {
      console.warn(`⚠ 警告: ${article.filename} 缺少必要字段，跳过生成`);
      continue;
    }

    let markdown = article.body;
    markdown = fixRelativePaths(markdown, mdPath, htmlOutputPath);
    const htmlContent = marked.parse(markdown);
    const readingTime = calcReadingTime(markdown);
    const seo = generateSEOTags(article, slug);
    const license = getLicenseDisplayAndHtml(article);

    let page = articleTemplate
      .replace(/{{ARTICLE_TITLE}}/g, article.title)
      .replace(/{{ARTICLE_DATE}}/g, article.date)
      .replace(/{{ARTICLE_LATEST}}/g, article.latest ? article.latest : '')
      .replace(/{{ARTICLE_CATEGORY}}/g, getCategoryName(article.category))
      .replace(/{{READING_TIME}}/g, readingTime + ' 分钟')
      .replace(/{{META_DESCRIPTION}}/g, seo.metaDescription)
      .replace(/{{CANONICAL_URL}}/g, seo.canonicalUrl)
      .replace(/{{OG_TITLE}}/g, seo.ogTitle)
      .replace(/{{OG_DESCRIPTION}}/g, seo.ogDescription)
      .replace(/{{OG_URL}}/g, seo.ogUrl)
      .replace(/{{JSON_LD}}/g, seo.jsonLD)
      .replace('{{ARTICLE_CONTENT}}', htmlContent)
      .replace('{{LICENSE_DISPLAY}}', license.display)
      .replace('{{LICENSE_HTML}}', license.html);

    fs.writeFileSync(htmlOutputPath, page);
    console.log(`✅ 生成: articles/${slug}.html`);
  }

  // 构建文章索引（不含 body）
  const articlesIndex = articles.map(({ body, ...rest }) => rest);

  // 生成 articles.json（供文章页面读取 license 等信息）
  fs.writeFileSync(
    path.join(distDir, 'articles.json'),
    JSON.stringify(articlesIndex, null, 2)
  );
  console.log('✅ 生成 articles.json');

  // 同时写入源目录（方便 git 追踪文章元数据变化）
  fs.writeFileSync(
    path.join(__dirname, 'articles.json'),
    JSON.stringify(articlesIndex, null, 2)
  );
  console.log('✅ 更新源目录 articles.json');

  // 注入文章数据到 index.html（硬编码，爬虫可直接抓取）
  injectArticlesIntoIndex(articlesIndex, distDir);

  // 生成 sitemap.xml
  const sitemap = generateSitemap(articles, SITE_URL);
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
  console.log('✅ 生成 sitemap.xml');

  // 生成 RSS（现在已包含完整文章内容）
  const rss = generateRSS(articles, SITE_URL, SITE_NAME, SITE_DESCRIPTION, distDir);
  fs.writeFileSync(path.join(distDir, 'rss.xml'), rss);
  console.log('✅ 生成 rss.xml（已注入完整文章内容）');

  // 追加 sitemap 到 robots.txt（如果存在）
  appendSitemapToRobots(distDir, SITE_URL);

  console.log(`\n🎉 构建完成！共 ${articles.length} 篇文章，输出目录: dist/`);
}

build();