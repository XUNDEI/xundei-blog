# xundei's blog

一个Astro博客，由AI生成

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
- `src/content/collections/` — 文章合集（每篇合集一个 `<slug>.md`；文章侧用 `collection: <slug>` 声明归属，首页只显示一张合集卡片，详见 `docs/文章合集-使用教程.md`）
- `src/layouts/BaseLayout.astro` — 全站基础布局：公共 head/SEO meta、主题初始化脚本、极光背景、亮度调节层
- `src/components/` — 页面组件：`home/`（首页 header/搜索面板/双侧栏/footer/关于卡等）、`article/`（文章页悬浮层）、共用 `LoadingOverlay`
- `src/pages/index.astro` — 首页（三栏杂志式布局：日历+标签云侧栏、文章信息流、归档时间线侧栏，≥1280px 生效）
- `src/pages/articles/[id].astro` — 文章页 `/articles/<slug>`（Astro 内置 Markdown 渲染 + Shiki 代码高亮，可选封面）
- `src/pages/friends.astro` — 友链页；`src/pages/404.astro` — 404 页
- `src/pages/*.ts` — articles.json / collections.json / search-index.json / rss.xml / sitemap.xml / robots.txt 端点
- `src/lib/` — 旧版构建逻辑的移植函数（SEO 标签、协议、文章排序、marked 输出对齐等）
- `src/styles/` + `src/scripts/` — 各页面样式与行为脚本（自旧版页面 1:1 迁移，CSS 未压缩保真）
- `scripts/` — 产物比对等一次性工具
