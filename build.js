const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// ---------- 加载文章列表 ----------
function loadArticles() {
  const filePath = path.join(__dirname, 'articles.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ---------- 工具函数 ----------
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

// ---------- 图片路径修正 ----------
function fixRelativePaths(markdown, mdFilePath, htmlOutputPath) {
  const mdDir = path.dirname(mdFilePath);
  const htmlDir = path.dirname(htmlOutputPath);
  const relativePrefix = path.relative(htmlDir, mdDir).replace(/\\/g, '/') + '/';
  // 避免空路径产生 "./" 导致图片查找出现问题（当md和html在同一目录时）
  const prefix = relativePrefix === './' ? '' : relativePrefix;

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    // 只处理相对路径，不处理 http://、//、data: 开头
    if (/^(https?:|\/\/|data:|\/)/i.test(src)) return match;
    return `![${alt}](${prefix}${src})`;
  });
}

// ---------- 构建主流程 ----------
function build() {
  const articles = loadArticles();
  const articleTemplate = fs.readFileSync(
    path.join(__dirname, 'templates', 'article.html'),
    'utf-8'
  );

  const distDir = path.join(__dirname, 'dist');
  const articlesDir = path.join(distDir, 'articles');

  // 清空输出目录
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(articlesDir, { recursive: true });

  // 复制静态资源目录（保留原结构）
  const staticDirs = ['Music', 'wallpaper', 'blog'];
  for (const dir of staticDirs) {
    const src = path.join(__dirname, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(distDir, dir), { recursive: true });
    }
  }

  // 复制根目录必要文件（含articles.json、wallpaper.json等）
  const rootFiles = [
    'index.html',
    'axios.min.js',
    'wallpaper.json',
    'articles.json',       // 主页读取文章列表用
    'sentences.txt',       // 美句
    'portrait.png',        // 头像
    'favicon.ico'          // 网站图标
    // 如果有其他文件（如 robots.txt）也一并列出
  ];
  for (const file of rootFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, file));
    } else {
      console.warn(`警告: 未找到 ${file}，已跳过复制`);
    }
  }

  // 生成每篇文章的 HTML
  for (const article of articles) {
    const mdPath = path.join(__dirname, article.filename);
    if (!fs.existsSync(mdPath)) {
      console.warn(`跳过不存在的文件: ${mdPath}`);
      continue;
    }

    let markdown = fs.readFileSync(mdPath, 'utf-8');

    // slug = 文件名（不含 .md）
    const slug = path.basename(article.filename, '.md');
    const htmlOutputPath = path.join(articlesDir, slug + '.html');

    // 修正图片相对路径
    markdown = fixRelativePaths(markdown, mdPath, htmlOutputPath);

    // 解析 Markdown
    const htmlContent = marked.parse(markdown);

    // 计算阅读时间
    const readingTime = calcReadingTime(markdown);

    // 替换模板占位符
    let page = articleTemplate
      .replace(/{{ARTICLE_TITLE}}/g, article.title)
      .replace(/{{ARTICLE_DATE}}/g, article.date)
      .replace(/{{ARTICLE_CATEGORY}}/g, getCategoryName(article.category))
      .replace(/{{READING_TIME}}/g, readingTime + ' 分钟')
      .replace('{{ARTICLE_CONTENT}}', htmlContent);

    // 写入文件
    fs.writeFileSync(htmlOutputPath, page);
    console.log(`生成: articles/${slug}.html`);
  }

  console.log(`构建完成！共 ${articles.length} 篇文章，输出目录: dist/`);
}

build();