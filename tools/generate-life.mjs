/**
 * ============================================================================
 *  generate-life.mjs —— 从 content/life.md 生成首页「这几年」与归档页「更早的日常」
 * ============================================================================
 *  解决的问题：以前改一条生活记录要手动动三处（data.js 的 life 段、
 *  index.html 的 SEO 快照、index.html 里 data.js 的缓存版本号），漏一处就会
 *  出现「页面变了但百度抓到旧内容」「改了却看不到，因为浏览器读缓存」。
 *
 *  现在只编辑 content/life.md，运行 `npm run life` 即可。
 *
 *  用法：
 *    node tools/generate-life.mjs                # 写回 data.js / index.html / archive.html
 *    node tools/generate-life.mjs --check        # 只校验三份产物是否一致（供 verify 调用）
 *    node tools/generate-life.mjs --out DIR      # 把结果写到 DIR，不动原文件
 *    node tools/generate-life.mjs --config F     # 指定别的 md
 *
 *  滚动窗口规则（按 md 书写顺序，第一条最新）：
 *    · 非占位记录前 3 条 + 3 个占位槽 = 首页固定 6 条
 *    · 第 4 条起的非占位记录全部进归档页，永不丢弃
 *    · 占位条目不进归档；不足 3 条时由生成器补空槽，保证首页版面不变
 *  产物幂等，版本号取 md 与 data.js 非 life/archive 段内容的 hash。
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
const ARCHIVE = path.join(root, 'archive.html');

const HOME_REAL = 3;
const HOME_SLOTS = 3;
const ARCHIVE_META = {
  kicker: 'ARCHIVE · 旧记录',
  title: '更早的日常',
  empty: '还没有更早的记录。首页只保留最新 3 条分享，等第 4 条出现时，最早的一条会自动移到这里。',
  intro: '生活年表里更早的日常分享。首页只保留最新 3 条，更早的记录会自动收进这一页。'
};
const EMPTY_SLOT = {
  year: '待补充',
  title: '留一个位置给还没写下的事',
  desc: '想好了再补上，不用示意内容冒充生活。',
  placeholder: true
};

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

/* ------------------------------------------------------- 2. 滚动窗口切分 */
const real = entries.filter((e) => !e.placeholder);
const pending = entries.filter((e) => e.placeholder);
const homeReal = real.slice(0, HOME_REAL);
const archived = real.slice(HOME_REAL);
const slots = pending.slice(0, HOME_SLOTS).map((e) => ({ ...e }));
while (slots.length < HOME_SLOTS) slots.push({ ...EMPTY_SLOT });
const homeEntries = homeReal.concat(slots);

/* -------------------------------------------------- 3. 生成 data.js 的两段 */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ') + "'";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entrySrc = (e) => {
  const extra = [];
  if (e.tag) extra.push(`tag: ${q(e.tag)}`);
  if (e.placeholder) extra.push('placeholder: true');
  return [
    `      { year: ${q(e.year)}, title: ${q(e.title)},`,
    `        desc: ${q(e.desc)}${extra.length ? ',\n        ' + extra.join(', ') : ''} },`
  ].join('\n');
};
const toBlocks = (list) => {
  const blocks = list.map(entrySrc);
  if (blocks.length) blocks[blocks.length - 1] = blocks[blocks.length - 1].replace(/,$/, '');
  return blocks;
};

const lifeBlock = [
  '  life: {',
  `    kicker: ${q(meta['章节标签'])},`,
  `    tagline: ${q(meta['金句'])},`,
  `    lead: ${q(meta['导语'])},`,
  `    quote: ${q(meta['便签'])},`,
  '    entries: [',
  ...toBlocks(homeEntries),
  '    ],',
  `    note: ${q(meta['备注'])}`,
  '  },'
].join('\n');

const archiveBlock = [
  '  archive: {',
  `    kicker: ${q(ARCHIVE_META.kicker)},`,
  `    title: ${q(ARCHIVE_META.title)},`,
  `    empty: ${q(ARCHIVE_META.empty)},`,
  '    entries: [',
  ...toBlocks(archived),
  '    ]',
  '  },'
].join('\n');

const data = fs.readFileSync(DATA, 'utf8');
const LIFE_RE = /^  life: \{[\s\S]*?^  \},$/m;
const ARCHIVE_RE = /^  archive: \{[\s\S]*?^  \},$/m;
if (!LIFE_RE.test(data)) throw new Error('assets/js/data.js 找不到 life 段的结构锚点');
let nextData = data.replace(LIFE_RE, lifeBlock);
if (ARCHIVE_RE.test(nextData)) {
  nextData = nextData.replace(ARCHIVE_RE, archiveBlock);
} else {
  // 首次运行：把 archive 段插在 life 段之后
  nextData = nextData.replace(/(^  life: \{[\s\S]*?^  \},$)/m, (m) => m + '\n' + archiveBlock);
}

/* ---------------------------------------------------- 4. 生成两份 SEO 快照 */
const snapLines = [
  `<p>${esc(meta['金句'])}。${esc(meta['导语'])}</p>`,
  '<h2>这几年</h2>'
];
for (const e of homeReal) {
  snapLines.push(`<p>${esc(e.year)} · ${esc(e.title)}：${esc(e.desc)}</p>`);
}
if (slots.length) {
  const years = pending.length ? pending.map((e) => esc(e.year)).join('、') : '部分年份';
  snapLines.push(
    `<p>${years} 的条目目前是占位，等待补上真实事件与照片，不用示意内容冒充生活。</p>`
  );
}
if (archived.length) {
  snapLines.push(`<p>更早的 ${archived.length} 条日常分享收录在归档页「更早的日常」（archive.html）。</p>`);
}
const snapBlock = snapLines.join('\n') + '\n';

const arcSnapLines = [
  `<h1>${esc(ARCHIVE_META.title)} | 李文涛</h1>`,
  `<p>${esc(ARCHIVE_META.intro)}</p>`,
  `<h2>${esc(ARCHIVE_META.title)}</h2>`
];
if (archived.length) {
  for (const e of archived) {
    arcSnapLines.push(`<p>${esc(e.year)} · ${esc(e.title)}：${esc(e.desc)}</p>`);
  }
} else {
  arcSnapLines.push(`<p>${esc(ARCHIVE_META.empty)}</p>`);
}
const arcSnapBlock = arcSnapLines.join('\n') + '\n';

/* --------------------------------------------------------- 5. 版本号与落盘 */
// 只让「md 内容 + data.js 里非 life/archive 的配置」影响版本号。
// 过滤空行是为了首次插入 archive 段前后结构等价，避免 --check 因版本号漂移而误报。
const stableTail = data.replace(LIFE_RE, '').replace(ARCHIVE_RE, '')
  .split('\n').filter((l) => l.trim() !== '').join('\n');
const version = 'life-' + crypto.createHash('sha1')
  .update(md + '\n' + stableTail)
  .digest('hex').slice(0, 8);

const idx = fs.readFileSync(INDEX, 'utf8');
const parts = idx.split('<!-- seo-snapshot:start -->');
if (parts.length !== 2) throw new Error('index.html 找不到 seo-snapshot:start 锚点');
const SNAP_RE = /(<h1>你好，我是李文涛<\/h1>\n)([\s\S]*?)(<!-- life-snapshot:end -->)/;
if (!SNAP_RE.test(parts[1])) throw new Error('SEO 快照找不到 life-snapshot:end 锚点');
const tail = parts[1].replace(SNAP_RE, (m, a, b, c) => a + snapBlock + c);
let nextIdx = parts[0] + '<!-- seo-snapshot:start -->' + tail;
if (!/data\.js\?v=[^"']+/.test(nextIdx)) throw new Error('index.html 找不到 data.js 缓存版本号');
nextIdx = nextIdx.replace(/data\.js\?v=[^"']+/, `data.js?v=${version}`);

const arc = fs.readFileSync(ARCHIVE, 'utf8');
const arcParts = arc.split('<!-- seo-snapshot:start -->');
if (arcParts.length !== 2) throw new Error('archive.html 找不到 seo-snapshot:start 锚点');
const ARC_SNAP_RE = /([\s\S]*?)(<!-- seo-snapshot:end -->)/;
if (!ARC_SNAP_RE.test(arcParts[1])) throw new Error('archive.html 找不到 seo-snapshot:end 锚点');
const arcTail = arcParts[1].replace(ARC_SNAP_RE, (m, a, c) => '\n' + arcSnapBlock + c);
let nextArc = arcParts[0] + '<!-- seo-snapshot:start -->' + arcTail;
if (!/data\.js\?v=[^"']+/.test(nextArc)) throw new Error('archive.html 找不到 data.js 缓存版本号');
nextArc = nextArc.replace(/data\.js\?v=[^"']+/, `data.js?v=${version}`);

const summary = `首页 ${homeEntries.length} 条（${homeReal.length} 真实 / ${slots.length} 占位），归档 ${archived.length} 条，版本 ${version}`;
if (CHECK) {
  const bad = [];
  if (fs.readFileSync(DATA, 'utf8') !== nextData) bad.push('assets/js/data.js 的 life / archive 段');
  if (fs.readFileSync(INDEX, 'utf8') !== nextIdx) bad.push('index.html 的 SEO 快照 / data.js 版本号');
  if (fs.readFileSync(ARCHIVE, 'utf8') !== nextArc) bad.push('archive.html 的 SEO 快照 / data.js 版本号');
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
  fs.writeFileSync(path.join(OUT, 'archive.html'), nextArc);
  console.log(`[life] 已生成到 ${OUT} · ${summary}`);
} else {
  fs.writeFileSync(DATA, nextData);
  fs.writeFileSync(INDEX, nextIdx);
  fs.writeFileSync(ARCHIVE, nextArc);
  console.log(`[life] 已同步 data.js / index.html / archive.html · ${summary}`);
}
