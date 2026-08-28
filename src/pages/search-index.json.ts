// search-index.json：全文搜索索引（不含友链文章），字段与缩进复刻 build.js 产物。
import { getCollection } from 'astro:content';
import path from 'node:path';
import { sortByArticlesOrder, buildLegacyIndexItem, stripMarkdown } from '../lib/site';

type Item = Record<string, unknown> & { category?: string };

export async function GET() {
  const posts = await getCollection('posts');
  const postsSrcDir = path.resolve(process.cwd(), 'src/content/posts');
  const bodyById = new Map(posts.map((p) => [p.id, p.body ?? '']));

  const searchIndex = sortByArticlesOrder(
    posts.map((p) => buildLegacyIndexItem(p, postsSrcDir)) as Item[]
  )
    .filter((item) => item.category !== 'friend_link')
    .map((item) => {
      const id = String(item.filename).replace(/^blog\//, '').replace(/\.md$/, '');
      return { ...item, searchText: stripMarkdown(bodyById.get(id) ?? '') };
    });

  return new Response(JSON.stringify(searchIndex, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
