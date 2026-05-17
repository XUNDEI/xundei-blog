const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// ========== 配置区 ==========
const SITE_URL = 'https://xundei.qzz.io';   // 你的网站域名，记得修改
// ===========================

function loadArticles() {
  const filePath = path.join(__dirname, 'articles.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

const categoryNames = {
  technology: '技术',
  diary: '日记',
  something: '杂碎'
};

function getCategoryName(cat) {
  return categoryNames[cat] || cat;
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

// ========== 生成 sitemap.xml ==========
function generateSitemap(articles, siteUrl) {
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 首页
  let urls = `
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  // 文章页
  for (const article of articles) {
    const slug = path.basename(article.filename, '.md');
    const lastmod = article.date || now;  // 使用文章的日期，若没有则用当天
    urls += `
  <url>
    <loc>${siteUrl}/articles/${slug}.html</loc>
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

// ========== 确保 robots.txt 包含 Sitemap 引用 ==========
function ensureRobotsTxtHasSitemap(distDir, siteUrl) {
  const robotsPath = path.join(distDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    console.warn('⚠️ robots.txt 不存在，请手动创建并添加 Sitemap 指令');
    return;
  }

  let content = fs.readFileSync(robotsPath, 'utf-8');
  const sitemapLine = `Sitemap: ${siteUrl}/sitemap.xml`;

  if (!content.includes(sitemapLine)) {
    // 如果末尾没有换行，先加上
    if (!content.endsWith('\n')) content += '\n';
    content += sitemapLine + '\n';
    fs.writeFileSync(robotsPath, content);
    console.log('✅ 已自动添加 Sitemap 引用到 robots.txt');
  } else {
    console.log('✅ robots.txt 已包含 Sitemap 引用');
  }
}

// ========== 主构建函数 ==========
function build() {
  const articles = loadArticles();
  const articleTemplate = fs.readFileSync(
    path.join(__dirname, 'templates', 'article.html'),
    'utf-8'
  );

  const distDir = path.join(__dirname, 'dist');
  const articlesDir = path.join(distDir, 'articles');

  // 清空旧目录
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(articlesDir, { recursive: true });

  // 复制静态资源目录
  const staticDirs = ['Music', 'blog', 'wallpaper'];
  for (const dir of staticDirs) {
    const src = path.join(__dirname, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(distDir, dir), { recursive: true });
    } else {
      console.warn(`目录 ${dir} 不存在，跳过复制`);
    }
  }

  // 复制根目录必要文件
  const rootFiles = [
    'index.html',
    'axios.min.js',
    'wallpaper.json',
    'articles.json',
    'sentences.txt',
    'portrait.png',
    'favicon.ico',
    'robots.txt'
  ];
  for (const file of rootFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, file));
    } else {
      console.warn(`文件 ${file} 不存在，跳过复制`);
    }
  }

  // 检测并复制 BingSiteAuth.xml（若存在，静默忽略不存在的情况）
  const bingAuthSrc = path.join(__dirname, 'BingSiteAuth.xml');
  if (fs.existsSync(bingAuthSrc)) {
    fs.copyFileSync(bingAuthSrc, path.join(distDir, 'BingSiteAuth.xml'));
  }

  // 生成文章 HTML
  for (const article of articles) {
    const mdPath = path.join(__dirname, article.filename);
    if (!fs.existsSync(mdPath)) {
      console.warn(`跳过不存在的文件: ${mdPath}`);
      continue;
    }

    let markdown = fs.readFileSync(mdPath, 'utf-8');
    const slug = path.basename(article.filename, '.md');
    const htmlOutputPath = path.join(articlesDir, slug + '.html');

    markdown = fixRelativePaths(markdown, mdPath, htmlOutputPath);
    const htmlContent = marked.parse(markdown);
    const readingTime = calcReadingTime(markdown);

    let page = articleTemplate
      .replace(/{{ARTICLE_TITLE}}/g, article.title)
      .replace(/{{ARTICLE_DATE}}/g, article.date)
      .replace(/{{ARTICLE_CATEGORY}}/g, getCategoryName(article.category))
      .replace(/{{READING_TIME}}/g, readingTime + ' 分钟')
      .replace('{{ARTICLE_CONTENT}}', htmlContent);

    fs.writeFileSync(htmlOutputPath, page);
    console.log(`生成: articles/${slug}.html`);
  }

  // 生成 sitemap.xml
  const sitemap = generateSitemap(articles, SITE_URL);
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
  console.log('✅ 生成 sitemap.xml');

  // 确保 robots.txt 包含 Sitemap 引用
  ensureRobotsTxtHasSitemap(distDir, SITE_URL);

  console.log(`构建完成！共 ${articles.length} 篇文章，输出目录: dist/`);
}

build();