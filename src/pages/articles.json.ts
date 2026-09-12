// articles.json：首页文章列表数据源。字段内容、顺序与缩进复刻 build.js 的产物。
import path from 'node:path';
import { sortByArticlesOrder, buildLegacyIndexItem } from '../lib/site';
import { getPublishedPosts } from '../lib/posts';

export async function GET() {
  const posts = await getPublishedPosts();
  const postsSrcDir = path.resolve(process.cwd(), 'src/content/posts');
  const index = sortByArticlesOrder(posts.map((p) => buildLegacyIndexItem(p, postsSrcDir)) as any);

  return new Response(JSON.stringify(index, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
