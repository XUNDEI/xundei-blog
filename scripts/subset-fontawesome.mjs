// Font Awesome 子集化：从 @fortawesome/fontawesome-free 提取站点实际用到的图标，
// 生成 public/fontawesome/ 下的 woff2 字体与精简 CSS。
// 增删图标后重新生成：node scripts/subset-fontawesome.mjs（需要 Python fontTools + brotli）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const FA_DIR = path.resolve('node_modules/@fortawesome/fontawesome-free');
const OUT_DIR = path.resolve('public/fontawesome');
const WEBFONT_DIR = path.join(OUT_DIR, 'webfonts');

// 站点实际使用的图标（含 v5 旧名，运行时 class 引用哪个名字就保留哪个）
const ICONS = {
  solid: [
    'arrow-left', 'arrow-right', 'arrow-up',
    'calendar-alt', 'check', 'check-circle',
    'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up',
    'clock', 'comments', 'copy', 'dice', 'envelope',
    'exclamation-triangle', 'history', 'home', 'link', 'list',
    'redo', 'undo', 'rss', 'search', 'spinner', 'star',
    'sync-alt', 'tags', 'times', 'user',
  ],
  brands: ['bilibili', 'github', 'qq', 'weixin'],
  regular: ['frown'],
};

// family/style → 源字体文件
const FONT_SOURCES = {
  solid: { ttf: 'webfonts/fa-solid-900.ttf', family: 'Font Awesome 6 Free', weight: 900, class: ['fas'] },
  regular: { ttf: 'webfonts/fa-regular-400.ttf', family: 'Font Awesome 6 Free', weight: 400, class: ['far'] },
  brands: { ttf: 'webfonts/fa-brands-400.ttf', family: 'Font Awesome 6 Brands', weight: 400, class: ['fab'] },
};

const families = JSON.parse(readFileSync(path.join(FA_DIR, 'metadata/icon-families.json'), 'utf8'));

// 建立「canonical 名 + 全部别名」→ { unicode, styles } 查找表
const lookup = new Map();
for (const [name, icon] of Object.entries(families)) {
  const styles = (icon.familyStylesByLicense?.free ?? []).map((fs) => fs.style);
  const entry = { unicode: icon.unicode, styles };
  lookup.set(name, entry);
  for (const alias of icon.aliases?.names ?? []) {
    if (!lookup.has(alias)) lookup.set(alias, entry);
  }
}

const cssParts = [];
const resolvedByStyle = {};
const summary = [];

for (const [style, names] of Object.entries(ICONS)) {
  const src = FONT_SOURCES[style];
  const unicodes = [];
  const resolved = [];
  for (const name of names) {
    const entry = lookup.get(name);
    if (!entry || !entry.styles.includes(style)) {
      throw new Error(`图标 ${name} 不存在于 free 的 ${style} 样式中`);
    }
    unicodes.push(entry.unicode);
    resolved.push({ name, unicode: entry.unicode });
  }

  mkdirSync(WEBFONT_DIR, { recursive: true });
  const outWoff2 = path.join(WEBFONT_DIR, path.basename(src.ttf).replace('.ttf', '.woff2'));
  execFileSync('python', [
    '-m', 'fontTools.subset',
    path.join(FA_DIR, src.ttf),
    '--unicodes=' + unicodes.join(','),
    '--flavor=woff2',
    '--no-hinting',
    '--output-file=' + outWoff2,
  ], { stdio: 'inherit' });

  cssParts.push(
    `@font-face {\n` +
    `  font-family: '${src.family}';\n` +
    `  font-style: normal;\n` +
    `  font-weight: ${src.weight};\n` +
    `  font-display: block;\n` +
    `  src: url('../webfonts/${path.basename(outWoff2)}') format('woff2');\n` +
    `}`
  );
  summary.push(`${style}: ${resolved.length} 个图标`);
  resolvedByStyle[style] = resolved;
}

// 生成精简 CSS
const lines = [
  '/* Font Awesome 6.4.0 子集（仅含站点实际使用的图标），由 scripts/subset-fontawesome.mjs 生成，勿手改 */',
  ...cssParts,
  '',
  '.fa, .fas, .far, .fab {',
  '  -moz-osx-font-smoothing: grayscale;',
  '  -webkit-font-smoothing: antialiased;',
  '  display: inline-block;',
  '  font-style: normal;',
  '  font-variant: normal;',
  '  line-height: 1;',
  '  text-rendering: auto;',
  '}',
  '',
  '.fas { font-family: \'Font Awesome 6 Free\'; font-weight: 900; }',
  '.far { font-family: \'Font Awesome 6 Free\'; font-weight: 400; }',
  '.fab { font-family: \'Font Awesome 6 Brands\'; font-weight: 400; }',
  '',
];

for (const [style, resolved] of Object.entries(resolvedByStyle)) {
  lines.push(`/* ${style} */`);
  for (const { name, unicode } of resolved) {
    lines.push(`.fa-${name}::before { content: '\\${unicode}'; }`);
  }
  lines.push('');
}

// fa-spin 动画（FA 官方实现）
lines.push(
  '.fa-spin { animation: fa-spin 2s linear infinite; }',
  '',
  '@keyframes fa-spin {',
  '  0% { transform: rotate(0deg); }',
  '  100% { transform: rotate(360deg); }',
  '}',
  ''
);

mkdirSync(path.join(OUT_DIR, 'css'), { recursive: true });
writeFileSync(path.join(OUT_DIR, 'css/fontawesome-subset.css'), lines.join('\n'));
console.log('完成: ' + summary.join(', ') + ' → public/fontawesome/');
