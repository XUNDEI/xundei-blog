# xundei's blog — Astro 版

由手写 Node 构建脚本 1:1 迁移到 Astro（无 UI 框架，纯 .astro + 原生 JS/CSS）。

## 命令

```bash
npm install
npm run dev      # 本地开发
npm run build    # 产出 dist/
npm run preview  # 本地预览 dist/
```

## 部署

Cloudflare Pages：`wrangler.jsonc` 指向 `./dist`，404 走 `404-page` 模式。

## 结构

- `src/content/posts/` — 全部文章（Content Collections，schema 见 `src/content.config.ts`）
- `src/pages/index.astro` — 首页（旧 index.html 原样迁移；v2 新增桌面端侧栏：日历/标签云/归档，≥1280px 两栏，<1280px 隐藏）
- `src/pages/articles/[id].astro` — 文章页 `/articles/<slug>`（旧 templates/article.html 迁移）
- `src/pages/*.ts` — articles.json / search-index.json / rss.xml / sitemap.xml / robots.txt 端点
- `src/lib/` — 旧版构建逻辑的移植函数 + 旧页面框架资源（scripts/migrate-from-old.mjs 生成）
- `scripts/` — 迁移与产物比对脚本（一次性工具）
