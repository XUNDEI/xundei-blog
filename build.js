const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

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

function build() {
  const articles = loadArticles();
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

  // 复制静态资源目录（包含 wallpaper，若存在）
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
    'favicon.ico'
  ];
  for (const file of rootFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, file));
    } else {
      console.warn(`文件 ${file} 不存在，跳过复制`);
    }
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

  console.log(`构建完成！共 ${articles.length} 篇文章，输出目录: dist/`);
}

build();