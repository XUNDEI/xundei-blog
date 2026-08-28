import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 与旧版 build.js 的手写 front matter 解析保持一致：
 * - date/latest 均为带引号的原始字符串（如 '2026-05-03T00:00:00'），不做 Date 转换，
 *   保证排序、JSON、RSS 输出与旧版逐字节相同。
 * - code-license 是带连字符的键，原样保留，不做驼峰转换。
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    latest: z.string().optional(),
    category: z.enum(['technology', 'diary', 'something', 'friend_link']),
    // 可选字段不设默认值：undefined 表示源文件中未书写该字段，
    // 序列化时与旧版一样跳过该键
    excerpt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    license: z.string().optional(),
    'code-license': z.string().optional(),
  }),
});

export const collections = { posts };
