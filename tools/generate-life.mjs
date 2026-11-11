/**
 * ============================================================================
 *  generate-life.mjs —— 从 content/life.md 生成首页「这几年」的全部内容
 * ============================================================================
 *  解决的问题：以前改一条生活记录要手动动三处（data.js 的 life 段、
 *  index.html 的 SEO 快照、index.html 里 data.js 的缓存版本号），漏一处就会
 *  出现「页面变了但百度抓到旧内容」「改了却看不到，因为浏览器读缓存」。
 *
 *  现在只编辑 content/life.md，运行 `npm run life` 即可。
 *
 *  用法：
 *    node tools/generate-life.mjs                # 写回 data.js + index.html
 *    node tools/generate-life.mjs --check        # 只校验是否一致（供 verify 调用）
 *    node tools/generate-life.mjs --out DIR      # 把结果写到 DIR，不动原文件
 *    node tools/generate-life.mjs --config F     # 指定别的 md
 *
 *  设计：靠结构锚点定位，不用自定义标记 —— 这样 prerender 重渲染快照后
 *  锚点依然成立。产物幂等，版本号取 md 内容的 hash，内容不变则字节不变。
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const CHECK = argv.includes('--check');
const OUT = argOf('--out');
const MD = argOf('--config') ? path.resolve(argOf('--config')) : path.join(root, 'content/life.md');
const DATA = path.join(root, 'assets/js/data.js');
const INDEX = path.join(root, 'index.html');

/* ---------------------------------------------------------------- 1. 解析 md */
const md = fs.readFileSync(MD, 'utf8');
const meta = {};
const entries = [];
let section = '';
let cur = null;

function flush() {
  if (!cur) return;
  cur.desc = cur._desc.join(' ').trim();
  delete cur._desc;
  entries.push(cur);
  cur = null;
}

for (const raw of md.split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith('## ')) {
    flush();
    section = line.slice(3).trim();
    continue;
  }
  if (line.startsWith('### ')) {
    flush();
    const head = line.slice(4).trim();
    const sep = head.indexOf('|');
    if (sep < 0) throw new Error(`年表条目标题缺少 "|" 分隔符：${head}`);
    cur = {
      year: head.slice(0, sep).trim(),
      title: head.slice(sep + 1).trim(),
      _desc: []
    };
    continue;
  }
  // 「- 键：值」：章节文案里是页面文案，年表里是条目元数据
  if (line.startsWith('- ') && line.includes('：')) {
    const sep = line.indexOf('：');
    const key = line.slice(2, sep).trim();
    const val = line.slice(sep + 1).trim();
    if (section === '章节文案') {
      meta[key] = val;
    } else if (section === '年表' && cur) {
      if (key === '标签') cur.tag = val;
      if (key === '占位' && (val === '是' || val.toLowerCase() === 'true')) cur.placeholder = true;
    }
    continue;
  }
  // 标题、说明、空行、代码标记都不是正文
  if (!line || line.startsWith('#') || line.startsWith('>') || line.startsWith('`')) continue;
  if (section === '年表' && cur) cur._desc.push(line);
}
flush();

for (const key of ['章节标签', '金句', '导语', '便签', '备注']) {
  if (!meta[key]) throw new Error(`章节文案缺少「${key}」`);
}
if (!entries.length) throw new Error('年表没有任何条目');
for (const e of entries) {
  if (!e.year || !e.title || !e.desc) throw new Error(`条目不完整：${e.year} | ${e.title}`);
}

/* ------------------------------------------------------------ 2. 生成 life 段 */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ') + "'";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entrySrc = (e) => {
  const extra = [];
  if (e.tag) extra.push(`tag: ${q(e.tag)}`);
  if (e.placeholder) extra.push('placeholder: true');
  const body = [
    `      { year: ${q(e.year)}, title: ${q(e.title)},`,
    `        desc: ${q(e.desc)}${extra.length ? ',\n        ' + extra.join(', ') : ''} },`
  ].join('\n');
  return body;
};
const entryBlocks = entries.map(entrySrc);
entryBlocks[entryBlocks.length - 1] = entryBlocks[entryBlocks.length - 1].replace(/,$/, '');

const lifeBlock = [
  '  life: {',
  `    kicker: ${q(meta['章节标签'])},`,
  `    tagline: ${q(meta['金句'])},`,
  `    lead: ${q(meta['导语'])},`,
  `    quote: ${q(meta['便签'])},`,
  '    entries: [',
  ...entryBlocks,
  '    ],',
  `    note: ${q(meta['备注'])}`,
  '  },'
].join('\n');

const data = fs.readFileSync(DATA, 'utf8');
const LIFE_RE = /^  life: \{[\s\S]*?^  \},$/m;
if (!LIFE_RE.test(data)) throw new Error('assets/js/data.js 找不到 life 段的结构锚点');
const nextData = data.replace(LIFE_RE, lifeBlock);

/* ------------------------------------------------------ 3. 生成 SEO 快照片段 */
const real = entries.filter((e) => !e.placeholder);
const pending = entries.filter((e) => e.placeholder);
const snapLines = [
  `<p>${esc(meta['金句'])}。${esc(meta['导语'])}</p>`,
  '<h2>这几年</h2>'
];
for (const e of real) {
  snapLines.push(`<p>${esc(e.year)} · ${esc(e.title)}：${esc(e.desc)}</p>`);
}
if (pending.length) {
  snapLines.push(
    `<p>${pending.map((e) => esc(e.year)).join('、')} 的条目目前是占位，等待补上真实事件与照片，不用示意内容冒充生活。</p>`
  );
}
const snapBlock = snapLines.join('\n') + '\n';

const idx = fs.readFileSync(INDEX, 'utf8');
const parts = idx.split('<!-- seo-snapshot:start -->');
if (parts.length !== 2) throw new Error('index.html 找不到 seo-snapshot:start 锚点');
const SNAP_RE = /(<h1>你好，我是李文涛<\/h1>\n)([\s\S]*?)(<h2>站点更新热力图<\/h2>)/;
if (!SNAP_RE.test(parts[1])) throw new Error('SEO 快照找不到「这几年 → 站点更新热力图」区间');
const tail = parts[1].replace(SNAP_RE, (m, a, b, c) => a + snapBlock + c);
const version = 'life-' + crypto.createHash('sha1').update(md).digest('hex').slice(0, 8);
let nextIdx = parts[0] + '<!-- seo-snapshot:start -->' + tail;
// 脚本引用在 seo-snapshot 之前，版本号要对整份 index.html 替换
if (!/data\.js\?v=[^"']+/.test(nextIdx)) throw new Error('index.html 找不到 data.js 缓存版本号');
nextIdx = nextIdx.replace(/data\.js\?v=[^"']+/, `data.js?v=${version}`);

/* -------------------------------------------------------- 4. 校验 / 落盘 */
const summary = `${entries.length} 条（${real.length} 条真实 / ${pending.length} 条占位），版本 ${version}`;
if (CHECK) {
  const bad = [];
  if (fs.readFileSync(DATA, 'utf8') !== nextData) bad.push('assets/js/data.js 的 life 段');
  if (fs.readFileSync(INDEX, 'utf8') !== nextIdx) bad.push('index.html 的 SEO 快照 / data.js 版本号');
  if (bad.length) {
    console.error(`[life] 与 content/life.md 不一致：${bad.join('、')}；请运行 npm run life`);
    process.exit(1);
  }
  console.log(`[life] 一致 · ${summary}`);
  process.exit(0);
}

if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'data.js'), nextData);
  fs.writeFileSync(path.join(OUT, 'index.html'), nextIdx);
  console.log(`[life] 已生成到 ${OUT} · ${summary}`);
} else {
  fs.writeFileSync(DATA, nextData);
  fs.writeFileSync(INDEX, nextIdx);
  console.log(`[life] 已同步 data.js / index.html · ${summary}`);
}
