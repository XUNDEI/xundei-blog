// 一次性修复：article.script.json 径向遮罩段替换时残留的旧 else-if 链尾。
// 用法：node scripts/fix-article-radial.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'src', 'lib', 'article.script.json');
let s = JSON.parse(readFileSync(p, 'utf8'));

const broken = `                }
                } else if (cornersDiff > threshold) {
                    // 四角偏亮：深色模式加暗角；亮色模式加白色暗角提亮
                    const cornerAlpha = Math.min(isDark ? 0.5 : 0.55, cornersDiff / 80 * (isDark ? 0.5 : 0.55));
                    radialGradient = \`radial-gradient(ellipse at 50% 50%, rgba(\${veilColor},0) 30%, rgba(\${veilColor},\${cornerAlpha}) 100%)\`;
                } else if (!isDark && centerDiff < -threshold) {
                    // 亮色模式中心偏暗：中心提亮
                    const centerAlpha = Math.min(0.55, -centerDiff / 80 * 0.55);
                    radialGradient = \`radial-gradient(ellipse at 50% 50%, rgba(\${veilColor},\${centerAlpha}) 0%, rgba(\${veilColor},0) 70%)\`;
                }`;

if (!s.includes(broken)) {
  console.error('BROKEN SEGMENT NOT FOUND（可能已修复过）');
  process.exit(1);
}
s = s.replace(broken, '                }');
if (s.includes('veilColor') || s.includes('isDark')) {
  console.error('STILL HAS THEME REFS');
  process.exit(1);
}
writeFileSync(p, JSON.stringify(s));
console.log('[ok] article.script.json 径向遮罩段已修复');
