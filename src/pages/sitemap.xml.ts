// sitemap.xml：复刻 build.js generateSitemap()（跳过友链，lastmod = latest || date || 今天）。
import { getCollection } from 'astro:content';
import { SITE_URL, sortByArticlesOrder } from '../lib/site';

export async function GET() {
  const now = new Date().toISOString().split('T')[0];

  const posts = await getCollection('posts');
  const articles = sortByArticlesOrder(
    posts.map((p) => ({ id: p.id, ...p.data }))
  );

  let urls = `
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/friends</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;

  for (const article of articles) {
    // 跳过友链文章，不加入 sitemap
    if (article.category === 'friend_link') continue;
    const lastmod = article.latest || article.date || now;
    urls += `
  <url>
    <loc>${SITE_URL}/articles/${article.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
