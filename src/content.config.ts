import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 与旧版 build.js 的手写 front matter 解析保持一致：
 * - date/latest 均为 'yyyy-MM-ddTHH:mm:ss' 形式的字符串，不做 Date 转换，
 *   保证排序、JSON、RSS 输出与旧版逐字节相同。
 * - code-license 是带连字符的键，原样保留，不做驼峰转换。
 * - PagesCMS 保存日期时不加引号，YAML 会将其解析成 Date 对象（按 UTC 解释），
 *   这里在校验前统一转回字符串，带引号/不带引号两种写法都能通过。
 */
const dateString = z.preprocess((v) => {
  // PagesCMS 的 date 字段即使 default 为空，也可能保存成空字符串/空值，
  // 统一归一化为 undefined，交给 .optional() 处理
  if (v == null || v === '') return undefined;
  // 无时区的时间戳被 YAML 解析为 UTC，因此用 UTC 分量还原，
  // 保证本地（UTC+8）与 Cloudflare（UTC）构建结果一致
  if (v instanceof Date) return v.toISOString().slice(0, 19);
  return v;
}, z.string());

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: dateString,
    latest: dateString.optional(),
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
