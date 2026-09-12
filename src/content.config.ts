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

/**
 * 草稿开关（Pages CMS 的「草稿」布尔字段）。
 * 注意：schema 里必须显式声明，否则 z.object 会把未声明的 draft 键直接剥掉，
 * 导致过滤逻辑永远拿不到草稿标记 —— 这正是此前草稿功能失效的原因。
 * 兼容 YAML 的 true/false 与字符串 "true"/"false"；空值视为未设置。
 */
const draftFlag = z.preprocess((v) => {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === '') return undefined;
  }
  return v;
}, z.boolean().optional());

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: dateString,
    // [draft] 草稿标记：true 时生产构建完全跳过该文章（见 src/lib/posts.ts）
    draft: draftFlag,
    latest: dateString.optional(),
    category: z.enum(['technology', 'diary', 'something', 'friend_link']),
    // 可选字段不设默认值：undefined 表示源文件中未书写该字段，
    // 序列化时与旧版一样跳过该键
    excerpt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    license: z.string().optional(),
    'code-license': z.string().optional(),
    // [cover] 可选封面图：完整 URL 或以 / 开头的站内路径；缺省时文章页不渲染封面
    cover: z.string().optional(),
  }),
});

export const collections = { posts };
