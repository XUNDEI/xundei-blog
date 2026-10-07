// robots.txt：由站点自持，不再依赖 Cloudflare 的「托管 robots.txt / Bot Preference Sync」。
//
// 背景：Cloudflare 于 2026-09-15 弃用旧版托管 robots.txt（固定托管块），改为
// Bot Preference Sync —— 只前置「你实际配置过的偏好」，未配置偏好的站点默认不注入
// 任何内容。于是本站 robots.txt 一度只剩下方 Sitemap 一行，AI 训练爬虫的
// Disallow 与 Content Signals 全部丢失。
//
// 此处把原先 Cloudflare 托管的那套内容（Content Signals 政策说明 + 8 个 AI 训练
// 爬虫 Disallow）固化进构建产物，避免再次被上游改动影响。
//
// 注意：robots.txt 只是「表达偏好」，不具备强制力；真正拦截需要在 Cloudflare 侧
// 用 AI Crawl Control / WAF 规则（Block AI bots）实现。
//
// 维护：Cloudflare 面板中的托管 robots.txt 开关应保持关闭，否则可能重复注入。
import { SITE_URL } from '../lib/site';

/**
 * Content Signals 政策说明 + 指令 + AI 训练爬虫黑名单。
 * 文本与 Cloudflare 旧版托管块一致（contentsignals.org 标准文本），
 * 仅去掉 "# BEGIN/END Cloudflare Managed content" 标记。
 */
const RULES = `# As a condition of accessing this website, you agree to abide by the
# following content signals:

# (a)  If a content-signal = yes, you may collect content for the
#      corresponding use.
# (b)  If a content-signal = no, you may not collect content for the
#      corresponding use.
# (c)  If the website operator does not include a content signal for a
#      corresponding use, the website operator neither grants nor restricts
#      permission via content signal with respect to the corresponding use.

# The content signals and their meanings are:

# search: building a search index and providing search results (e.g., returning
#         hyperlinks and short excerpts from your website's contents). Search
#         does not include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval
#           augmented generation, grounding, or other real-time taking of
#           content for generative AI search answers).
# ai-train: training or fine-tuning AI models.

# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT
# AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.

User-Agent: *
Content-Signal: search=yes, ai-train=no, use=reference
Allow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /
`;

export async function GET() {
  // 末尾保留 Sitemap 行（与旧版 appendSitemapToRobots() 的输出位置一致）
  const content = `${RULES}\nSitemap: ${SITE_URL}/sitemap.xml\n`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
