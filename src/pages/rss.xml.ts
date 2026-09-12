// rss.xml：复刻 build.js generateRSS()（跳过友链，CDATA 注入完整正文 HTML，pubDate 转 UTC）。
//
// [v3.1] 只输出最近 RSS_ITEM_LIMIT 篇：
//   正文以 content:encoded 全文内嵌，若把全部文章都写进 feed，rss.xml 会随文章总量
//   线性膨胀（实测每篇约 7KB），订阅器每次轮询都要整份重下。RSS 的用途是"最近更新"，
//   因此按排序（latest 优先）截断，其余文章由站内归档 / sitemap 覆盖。
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getPublishedPosts } from '../lib/posts';
import PostBody from '../components/PostBody.astro';
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  sortByArticlesOrder,
  escapeXmlTitle,
  escapeXmlDescription,
  fixRelativePaths,
  markedizeAstroHtml,
  removeHeadingIdAttrs
} from '../lib/site';

/** RSS 最多输出的文章数（含全文正文，数值越大 feed 越大） */
const RSS_ITEM_LIMIT = 20;

export async function GET() {
  const now = new Date().toUTCString();

  const posts = await getPublishedPosts();
  const container = await AstroContainer.create();
  const postById = new Map(posts.map((p) => [p.id, p]));

  // 与 build.js 相同的排序（latest 优先，其次 date），再逐篇生成
  let items = '';
  let emitted = 0;
  for (const data of sortByArticlesOrder(
    posts.map((p) => ({ id: p.id, body: p.body ?? '', ...p.data }))
  )) {
    // 跳过友链文章，不加入 RSS
    if (data.category === 'friend_link') continue;
    if (!data.title) continue;
    // 只取最新的 N 篇（在跳过友链之后再计数）
    if (emitted >= RSS_ITEM_LIMIT) break;
    emitted++;

    const post = postById.get(data.id)!;
    const url = `${SITE_URL}/articles/${data.id}`;
    const pubDate = data.date
      ? new Date(data.date.includes('T') ? data.date : data.date + 'T00:00:00').toUTCString()
      : now;

    const desc = escapeXmlDescription(data.excerpt || '');

    // 生成完整文章 HTML（Astro 内置 Markdown 渲染；图片相对路径修正逻辑同旧版）
    const contentMarkdown = fixRelativePaths(data.body);
    let htmlContent = await container.renderToString(PostBody, { props: { post } });
    htmlContent = removeHeadingIdAttrs(markedizeAstroHtml(htmlContent));
    htmlContent = htmlContent.replace(/^\s+/, '');
    if (htmlContent && !htmlContent.endsWith('\n')) htmlContent += '\n';

    // CDATA 段安全转义（避免出现 ]]> 截断）
    const safeHtml = htmlContent.replace(/]]>/g, ']]]]><![CDATA[>');

    items += `
    <item>
      <title>${escapeXmlTitle(data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${desc}</description>
      <content:encoded><![CDATA[${safeHtml}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <author>xundei</author>
    </item>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}/</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>zh-CN</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${now}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
