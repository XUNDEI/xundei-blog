// 一次性脚本：把极光光球漂移动画同步为参考站（莫奈个人博客）framer-motion 的原始关键帧。
// 参考站实现：motion.div animate={{x:[..],y:[..],scale:[..]}} transition={{duration,repeat:Infinity,ease:'easeInOut'}}
//   orb1 22s: x[-5,15,5,-8]  y[0,12,20,3]   scale[1,1.15,.9,1.08]
//   orb2 26s: x[8,-10,5,12]  y[-5,10,-8,5]  scale[.9,1.12,1,1.08]
//   orb3 30s: x[-10,20,-5,10] y[-8,5,15,-3] scale[1.05,.88,1.1,.95]
//   orb4 18s: x[15,-8,10,-12] y[10,-5,8,15] scale[.85,1.1,.95,1.05]
// CSS 四档停驻点 0/33.3/66.7/100 与 framer 默认 times [0,1/3,2/3,1] 一致，
// 末帧与首帧不同、循环时瞬间回卷，同样复刻 framer repeat:loop 的行为。
// 用法：node scripts/sync-orb-keyframes.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ORBS = {
  1: {
    duration: 22,
    stops: [
      [0, '-5%', '0%', 1],
      [33.3, '15%', '12%', 1.15],
      [66.7, '5%', '20%', 0.9],
      [100, '-8%', '3%', 1.08],
    ],
  },
  2: {
    duration: 26,
    stops: [
      [0, '8%', '-5%', 0.9],
      [33.3, '-10%', '10%', 1.12],
      [66.7, '5%', '-8%', 1],
      [100, '12%', '5%', 1.08],
    ],
  },
  3: {
    duration: 30,
    stops: [
      [0, '-10%', '-8%', 1.05],
      [33.3, '20%', '5%', 0.88],
      [66.7, '-5%', '15%', 1.1],
      [100, '10%', '-3%', 0.95],
    ],
  },
  4: {
    duration: 18,
    stops: [
      [0, '15%', '10%', 0.85],
      [33.3, '-8%', '-5%', 1.1],
      [66.7, '10%', '8%', 0.95],
      [100, '-12%', '15%', 1.05],
    ],
  },
};

function buildBlock(indent) {
  return Object.entries(ORBS)
    .map(([n, orb]) => {
      const lines = orb.stops
        .map(
          ([t, x, y, s]) =>
            `${indent}  ${t}% { transform: translate(${x}, ${y}) scale(${s}); }`
        )
        .join('\n');
      return `${indent}@keyframes orb${n}-drift {\n${lines}\n${indent}}`;
    })
    .join('\n\n');
}

function syncOrbKeyframes(content) {
  let replaced = 0;
  for (const n of [1, 2, 3, 4]) {
    const re = new RegExp(`([ \\t]*)@keyframes orb${n}-drift \\{[\\s\\S]*?\\n\\1\\}`);
    const m = content.match(re);
    if (!m) continue;
    const indent = m[1];
    const block = buildBlock(indent).split('\n\n')
      .find((b) => b.includes(`orb${n}-drift`));
    content = content.replace(re, block.replace(/^\n/, ''));
    replaced++;
  }
  return { content, replaced };
}

// —— JSON 模板（frame 字段）——
for (const file of ['index.frame.json', 'article.frame.json', 'notfound.frame.json']) {
  const p = path.join(root, 'src', 'lib', file);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const isPlainString = typeof raw === 'string';
  const { content, replaced } = syncOrbKeyframes(isPlainString ? raw : raw.frame);
  if (replaced === 0) throw new Error(`${file}: 未找到任何 orb keyframes`);
  if (isPlainString) writeFileSync(p, JSON.stringify(content));
  else {
    raw.frame = content;
    writeFileSync(p, JSON.stringify(raw));
  }
  console.log(`[ok] ${file}: 替换 ${replaced} 组 keyframes`);
}

// —— friends.astro：keyframes 同步 + 补齐 orb3/orb4 ——
{
  const p = path.join(root, 'src', 'pages', 'friends.astro');
  let src = readFileSync(p, 'utf8');
  let replaced = 0;
  for (const n of [1, 2]) {
    const re = new RegExp(`([ \\t]*)@keyframes orb${n}-drift \\{[\\s\\S]*?\\n\\1\\}`);
    const m = src.match(re);
    if (!m) throw new Error(`friends.astro: orb${n} keyframes 未找到`);
    const block = buildBlock(m[1]).split('\n\n').find((b) => b.includes(`orb${n}-drift`));
    src = src.replace(re, block);
    replaced++;
  }
  // 补齐 orb3/orb4：CSS 类（单行风格与 orb1/orb2 一致）
  const orb12css = src.match(/([ \t]*)\.aurora-orb-2 \{[^\n]*\}/);
  if (!orb12css) throw new Error('friends.astro: .aurora-orb-2 未找到');
  const indent = orb12css[1];
  const orb34css = [
    `${indent}.aurora-orb-3 { width: min(450px, 55vw); height: min(450px, 55vw); background: var(--aurora-primary); opacity: 0.15; filter: blur(130px); left: 40%; top: 40%; animation: orb3-drift 30s ease-in-out infinite; }`,
    `${indent}.aurora-orb-4 { width: min(300px, 40vw); height: min(300px, 40vw); background: var(--aurora-secondary); opacity: 0.18; filter: blur(80px); left: 55%; top: 15%; animation: orb4-drift 18s ease-in-out infinite; }`,
  ].join('\n');
  src = src.replace(orb12css[0], orb12css[0] + '\n' + orb34css);
  // HTML 节点
  const orb12html = src.match(/([ \t]*)<div class="aurora-orb aurora-orb-2"><\/div>/);
  if (!orb12html) throw new Error('friends.astro: orb-2 div 未找到');
  src = src.replace(
    orb12html[0],
    orb12html[0] +
      `\n${orb12html[1]}<div class="aurora-orb aurora-orb-3"></div>` +
      `\n${orb12html[1]}<div class="aurora-orb aurora-orb-4"></div>`
  );
  writeFileSync(p, src);
  console.log(`[ok] friends.astro: 替换 ${replaced} 组 keyframes + 补齐 orb3/orb4`);
}
