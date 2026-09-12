/**
 * 文章集合（posts）的统一读取入口。
 *
 * 为什么要统一入口：草稿（front matter 中 draft: true）必须在**所有**输出里消失，
 * 而文章数据有 6 个出口：首页、文章页 getStaticPaths、articles.json、
 * search-index.json、rss.xml、sitemap.xml。任何一个漏掉，草稿就会被公开或被抓取。
 * 所有出口都从这里取数据，就不会再有漏网之鱼。
 *
 * 过滤策略：
 *   - 生产构建（astro build）：过滤掉 draft: true，草稿不进产物，线上不可见；
 *   - 本地开发（astro dev）：不过滤，草稿照常出现在列表和文章页，方便边写边预览。
 *   - 想在本地用「构建产物」预览草稿（astro build + astro preview）时，
 *     设置环境变量 SHOW_DRAFTS=1 再构建即可：SHOW_DRAFTS=1 npm run build。
 *
 * 另：Pages CMS 把草稿标记为 draft，正式发布时把开关关掉（draft 变 false 或删掉该行），
 * 下一次构建就会正常输出。
 */
import { getCollection, type CollectionEntry } from 'astro:content';

const includeDrafts = import.meta.env.DEV || process.env.SHOW_DRAFTS === '1';

export async function getPublishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts');
  if (includeDrafts) return posts;
  return posts.filter((post) => post.data.draft !== true);
}
