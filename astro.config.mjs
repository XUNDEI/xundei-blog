// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

/**
 * 移除 Markdown 渲染时自动生成的标题 id。
 * 旧版 marked 不生成标题 id，文章页 TOC 脚本按 heading-N 顺序编号，
 * 保持一致才能做到目录行为 1:1。
 * （作为 unified 处理器的 rehype 插件传入 —— Astro 7 新写法）
 */
function removeHeadingIds() {
  return (tree) => {
    const visit = (node) => {
      if (
        node.type === 'element' &&
        typeof node.tagName === 'string' &&
        /^h[1-6]$/.test(node.tagName)
      ) {
        if (node.properties && Object.prototype.hasOwnProperty.call(node.properties, 'id')) {
          delete node.properties.id;
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(tree);
  };
}

// giscus 自定义评论主题（public/giscus-glass.css）由 giscus.app 的 iframe
// 以 <link crossorigin="anonymous"> 加载：
//  1. Astro dev server 会按 Sec-Fetch-Site 拦截跨站子资源请求，
//     需在 security.allowedDomains 放行 giscus.app（见下方 security 配置）；
//  2. crossorigin=anonymous 要求响应带 Access-Control-Allow-Origin，
//     dev 由下方中间件补头，生产由 public/_headers 提供同样的响应头；
//  3. dev 下 giscus.app（公网）请求 127.0.0.1（本机）还可能触发 Chrome 的
//     Private Network Access 预检（OPTIONS），中间件一并应答；
//     生产（公站对公站）无此问题。
const giscusThemeCors = {
  name: 'giscus-theme-cors',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/giscus-glass.css')) {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Private-Network', 'true');
          res.statusCode = 204;
          res.end();
          return;
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      next();
    });
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://xundei.qzz.io',
  output: 'static',
  security: {
    // 允许 giscus.app 在 dev server 上跨站加载评论主题 CSS
    allowedDomains: [{ hostname: 'giscus.app', protocol: 'https' }],
  },
  vite: {
    plugins: [giscusThemeCors],
    // 关闭 Vite 内置 CORS（默认仅允许 localhost 来源，会抢先应答 giscus.app 的
    // 预检并拒绝之）。仅影响本地 dev 服务器。
    server: {
      cors: false,
    },
  },
  build: {
    // 与旧版输出一致：dist/articles/<slug>.html（而不是 directory 格式的 index.html）
    format: 'file',
  },
  markdown: {
    // Astro 7 新写法：remark/rehype 管线与 smartypants 通过 unified() 处理器配置
    processor: unified({
      // 关闭 smartypants：旧版 marked 不做弯引号/破折号替换，保持直引号原样输出
      smartypants: false,
      rehypePlugins: [removeHeadingIds],
    }),
    // [v2] 构建期 Shiki 预渲染高亮（one-dark-pro 主题）：代码块 HTML 内联主题配色，
    // 不依赖运行时 JS；客户端旧 highlight.js 染色调用已同步移除（见 migrate-from-old.mjs）
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'one-dark-pro',
    },
  },
});
