// collections.json：首页「文章合集」卡片的数据源。
// 与 articles.json 一样由构建期 Content Collections 生成；成员文章字段形状与 articles.json 一致，
// 便于页面脚本对两者做同一套排序与渲染。
import { getCollectionsWithPosts } from '../lib/collections';

export async function GET() {
  const collections = await getCollectionsWithPosts();
  const index = collections.map((c) => ({
    slug: c.slug,
    title: c.title,
    intro: c.intro,
    cover: c.cover,
    count: c.count,
    latest: c.latest,
    tags: c.tags,
    posts: c.posts,
  }));

  return new Response(JSON.stringify(index, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
