/**
 * 文章合集（collections 内容集合）的统一读取入口。
 *
 * 归属关系写在文章侧：posts 的 front matter 加 `collection: <合集 slug>`，
 * slug 即 src/content/collections/<slug>.md 的文件名，合集侧不需要维护成员名单，
 * 这样在 PagesCMS 里编辑单篇文章即可调整归属。
 *
 * 两条约束：
 *  1) 成员文章只来自 getPublishedPosts()，因此草稿既不会出现在主页，也不会计入合集篇数；
 *  2) 文章的 collection 指向不存在的合集（写错 slug、合集被删）时只告警并按无归属处理，
 *     不能让一次笔误把整个构建打断。
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getPublishedPosts } from './posts';
import { articleFilename, articleUrl, normalizeTags } from './site';

export type CollectionPost = Record<string, unknown> & {
  filename: string;
  url: string;
  /** 归属的合集 slug；无归属时不产生该键 */
  collection?: string;
};

export interface CollectionEntryItem {
  slug: string;
  title: string;
  intro: string;
  cover: string;
  /** 合集内公开文章数 */
  count: number;
  /** 合集内最新一篇的时间（latest || date），供首页与文章混排排序；空合集为 '' */
  latest: string;
  /** 合集自身的标签，供首页标签筛选命中合集卡片 */
  tags: string[];
  /** 成员文章：与 articles.json 同源同序（latest || date 倒序） */
  posts: CollectionPost[];
}

const postsSourceDir = 'src/content/posts';
const entriesDir = 'src/content/collections';

/**
 * 目录里一个 .md 都没有时跳过 getCollection('collections')：
 * Astro 对「空的 glob 集合」会打一条危言耸听的
 * `The collection "collections" does not exist or is empty. Please check your content config file for errors.`
 * 而「还没建过任何合集」是完全正常的状态（本站上线初期就是这个状态），不该刷这条警告。
 */
function hasCollectionSources(): boolean {
  try {
    return fs.readdirSync(path.resolve(process.cwd(), entriesDir))
      .some((name) => name.endsWith('.md'));
  } catch {
    // 目录本身读不到（不存在 / 路径异常）时不做判断，交给 getCollection 自己报错，
    // 免得一次路径失误把所有合集静默吞掉
    return true;
  }
}

/** 与 articles.json 一致：filename 为 blog/<slug>.md，url 为文章页绝对地址 */
function toCollectionPost(post: CollectionEntry<'posts'>): CollectionPost {
  const d = post.data;
  return {
    title: d.title,
    date: d.date,
    ...(d.latest !== undefined ? { latest: d.latest } : {}),
    category: d.category,
    ...(d.excerpt !== undefined ? { excerpt: d.excerpt } : {}),
    ...(d.cover !== undefined ? { cover: d.cover } : {}),
    ...(d.license !== undefined ? { license: d.license } : {}),
    ...(d['code-license'] !== undefined ? { 'code-license': d['code-license'] } : {}),
    ...(d.tags !== undefined ? { tags: normalizeTags(d.tags) } : {}),
    collection: String(d.collection),
    filename: articleFilename(post.id),
    url: articleUrl(post.id),
  };
}

function sortKeyOf(item: { latest?: unknown; date?: unknown }): string {
  const latest = item.latest;
  if (typeof latest === 'string' && latest) return latest;
  return typeof item.date === 'string' ? item.date : '';
}

export async function getCollectionsWithPosts(): Promise<CollectionEntryItem[]> {
  const [entries, posts] = await Promise.all([
    hasCollectionSources() ? getCollection('collections') : Promise.resolve([] as CollectionEntry<'collections'>[]),
    getPublishedPosts(),
  ]);

  const grouped = new Map<string, CollectionEntryItem>();
  const items: CollectionEntryItem[] = [];

  for (const entry of entries) {
    const item: CollectionEntryItem = {
      slug: entry.id,
      title: entry.data.title,
      intro: entry.data.intro ?? '',
      cover: entry.data.cover ?? '',
      count: 0,
      latest: sortKeyOf(entry.data),
      tags: entry.data.tags ?? [],
      posts: [],
    };
    grouped.set(item.slug, item);
    items.push(item);
  }

  let warned = false;
  for (const post of posts) {
    const slug = post.data.collection ? String(post.data.collection).trim() : '';
    if (!slug) continue;
    const target = grouped.get(slug);
    if (!target) {
      if (!warned) {
        console.warn(
          '[collections] 以下文章引用了不存在的合集 slug，已按无归属处理（合集文件应位于 src/content/collections/<slug>.md）：'
        );
        warned = true;
      }
      console.warn(`  - ${postsSourceDir}/${post.id}.md → collection: ${slug}`);
      continue;
    }
    target.posts.push(toCollectionPost(post));
  }

  for (const item of items) {
    item.posts.sort((a, b) => sortKeyOf(b).localeCompare(sortKeyOf(a)));
    item.count = item.posts.length;
    // 合集时间线取成员文章的最新时间，空合集退回合集自身的 date
    if (item.posts.length) item.latest = sortKeyOf(item.posts[0]);
  }

  return items;
}
