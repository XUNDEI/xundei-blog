// robots.txt：复刻 build.js appendSitemapToRobots() 的结果。
// 源目录的 robots.txt 为空文件，构建时在其后追加 Sitemap 行（保留原有换行行为）。
import { SITE_URL } from '../lib/site';

export async function GET() {
  let content = '';
  const sitemapLine = `Sitemap: ${SITE_URL}/sitemap.xml`;

  if (!content.includes(sitemapLine)) {
    if (!content.endsWith('\n')) content += '\n';
    content += sitemapLine + '\n';
  }

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
