// robots.txt：最宽松形式 —— 不拦截任何爬虫，只声明允许抓取与 sitemap 位置。
//
// 背景：本站曾依赖 Cloudflare 托管 robots.txt；Cloudflare 于 2026-09-15 弃用旧版
// 托管块（改为 Bot Preference Sync，只同步"你实际配置过的偏好"，未配置的站点不再
// 注入任何内容），线上 robots.txt 一度只剩 Sitemap 一行。现由站点自持，不再依赖
// Cloudflare 侧的任何注入。
//
// 若日后想限制 AI 训练爬虫，改这里即可。注意 robots.txt 只是"偏好声明"，不具备
// 强制力；真要拦截需在 Cloudflare 侧用 AI Crawl Control / WAF 规则实现。
import { SITE_URL } from '../lib/site';

const RULES = `User-Agent: *
Allow: /
`;

export async function GET() {
  // 末尾保留 Sitemap 行（与旧版 appendSitemapToRobots() 的输出位置一致）
  const content = `${RULES}\nSitemap: ${SITE_URL}/sitemap.xml\n`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
