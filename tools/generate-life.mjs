/**
 * ============================================================================
 *  generate-life.mjs —— 从 content/life.md 生成首页「这几年」、归档页「更早的日常」
 *                        以及带全文的日常分享独立文章页
 * ============================================================================
 *  解决的问题：以前改一条生活记录要手动动三处（data.js 的 life 段、
 *  index.html 的 SEO 快照、index.html 里 data.js 的缓存版本号），漏一处就会
 *  出现「页面变了但百度抓到旧内容」「改了却看不到，因为浏览器读缓存」。
 *
 *  现在只编辑 content/life.md（以及可选的 content/posts/*.md），运行 `npm run life`。
 *
 *  用法：
 *    node tools/generate-life.mjs                # 写回 data.js / index.html / archive.html / sitemap.xml / posts/*.html
 *    node tools/generate-life.mjs --check        # 只校验产物是否一致（供 verify 调用）
 *    node tools/generate-life.mjs --out DIR      # 把结果写到 DIR，不动原文件
 *    node tools/generate-life.mjs --config F     # 指定别的 md
 *
 *  滚动窗口规则（按 md 书写顺序，第一条最新）：
 *    · 非占位记录前 3 条 + 3 个占位槽 = 首页固定 6 条
 *    · 第 4 条起的非占位记录全部进归档页，永不丢弃
 *    · 占位条目不进归档；不足 3 条时由生成器补空槽，保证首页版面不变
 *
 *  文章规则：
 *    · 年表条目写「- 文章：<slug>」→ 读取 content/posts/<slug>.md 全文
 *    · 生成静态 posts/<slug>.html（含 SEO 全文快照、章节目录、封面占位、相邻文章）
 *    · data.js 条目注入 url，首页 / 归档页标题自动变成可点链接
 *    · sitemap.xml 里由 <!-- posts:start/end --> 锚点幂等登记
 *  产物幂等，版本号取 md + 文章正文 + data.js 非 life/archive 段内容的 hash。
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
const SITEMAP = path.join(root, 'sitemap.xml');
const POSTS_SRC = path.join(root, 'content/posts');
const POSTS_OUT = path.join(root, 'posts');
const SITE = 'https://jason19960330.github.io/website/';
const P_START = '<!-- posts:start -->';
const P_END = '<!-- posts:end -->';

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
      if (key === '照片' && val === '待补') cur.photoPending = true;
      if (key === '封面') cur.cover = val;
      if (key === '图注') cur.caption = val;
      if (key === '文章') cur.post = val.replace(/\.md$/i, '').trim();
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
  if (e.post && !/^[a-z0-9][a-z0-9-]*$/.test(e.post)) {
    throw new Error(`文章短名只能用小写字母 / 数字 / 连字符：${e.post}`);
  }
}

/* ------------------------------------------------------- 2. 滚动窗口切分 */
const real = entries.filter((e) => !e.placeholder);
const pending = entries.filter((e) => e.placeholder);
const homeReal = real.slice(0, HOME_REAL);
const archived = real.slice(HOME_REAL);
const slots = pending.slice(0, HOME_SLOTS).map((e) => ({ ...e }));
while (slots.length < HOME_SLOTS) slots.push({ ...EMPTY_SLOT });
const homeEntries = homeReal.concat(slots);

/* ---------------------------------------------------- 3. 读取文章正文 md */
function loadPost(slug) {
  const file = path.join(POSTS_SRC, slug + '.md');
  if (!fs.existsSync(file)) throw new Error(`找不到文章正文：content/posts/${slug}.md`);
  const raw = fs.readFileSync(file, 'utf8');
  let body = raw;
  let title = null;
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    body = raw.slice(fm[0].length);
    const t = fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (t) title = t[1];
  }
  const sections = [];
  let sec = null;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('<!--')) continue;
    if (line.startsWith('# ')) {
      sec = { heading: line.slice(2).trim(), paras: [] };
      sections.push(sec);
    } else {
      if (!sec) { sec = { heading: '', paras: [] }; sections.push(sec); }
      sec.paras.push(line);
    }
  }
  if (!sections.length || !sections.some((s) => s.paras.length)) {
    throw new Error(`文章正文为空：content/posts/${slug}.md`);
  }
  return { slug, title, sections, raw };
}

const postEntries = real.filter((e) => e.post);
const postMap = new Map();
for (const e of postEntries) {
  if (postMap.has(e.post)) throw new Error(`文章短名重复：${e.post}`);
  postMap.set(e.post, loadPost(e.post));
}
const postUrl = (slug) => 'posts/' + slug + '.html';
const neighborOf = (slug) => {
  const i = real.findIndex((e) => e.post === slug);
  const prev = real.slice(0, i).reverse().find((e) => e.post);
  const next = real.slice(i + 1).find((e) => e.post);
  const asLink = (e) => e ? { title: e.title, url: postUrl(e.post) } : null;
  return { prev: asLink(prev), next: asLink(next) };
};

/* -------------------------------------------------- 4. 生成 data.js 的两段 */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ') + "'";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s) => String(s).replace(/\*\*/g, '');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const up = (href) => href.replace(/^(assets|vendor)\//, '../$1/');

const entrySrc = (e) => {
  const extra = [];
  if (e.tag) extra.push(`tag: ${q(e.tag)}`);
  if (e.cover) extra.push(`cover: ${q(e.cover)}`);
  if (e.caption) extra.push(`caption: ${q(e.caption)}`);
  if (e.photoPending) extra.push('photoPending: true');
  if (e.post) extra.push(`url: ${q(postUrl(e.post))}`);
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

/* ---------------------------------------------------- 5. 生成两份 SEO 快照 */
const snapLines = [
  `<p>${esc(meta['金句'])}。${esc(meta['导语'])}</p>`,
  '<h2>这几年</h2>'
];
for (const e of homeReal) {
  const t = e.post ? `<a href="${esc(postUrl(e.post))}">${esc(e.title)}</a>` : esc(e.title);
  snapLines.push(`<p>${esc(e.year)} · ${t}：${esc(e.desc)}</p>`);
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
    const t = e.post ? `<a href="${esc(postUrl(e.post))}">${esc(e.title)}</a>` : esc(e.title);
    arcSnapLines.push(`<p>${esc(e.year)} · ${t}：${esc(e.desc)}</p>`);
  }
} else {
  arcSnapLines.push(`<p>${esc(ARCHIVE_META.empty)}</p>`);
}
const arcSnapBlock = arcSnapLines.join('\n') + '\n';

/* ------------------------------------------------------- 6. 生成静态文章页 */
const idxSrc = fs.readFileSync(INDEX, 'utf8');
const cssHrefs = [...idxSrc.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
  .map((m) => up(m[1]));
const favicon = up((idxSrc.match(/<link rel="icon" href="([^"]+)"/) || [, 'assets/favicon.svg'])[1]);
if (!cssHrefs.length) throw new Error('index.html 找不到样式表引用，无法生成文章页');

function renderPost(e, post, neighbors) {
  const title = post.title || e.title;
  const pageTitle = `${title} | 这几年 | 李文涛`;
  const canon = `${SITE}${postUrl(post.slug)}`;
  const ogImage = `${SITE}assets/og-image.png`;

  const toc = post.sections
    .map((s, i) => s.heading ? `<li><a href="#sec-${i + 1}">${esc(s.heading)}</a></li>` : '')
    .filter(Boolean).join('\n');
  const bodyHtml = post.sections.map((s, i) => [
    s.heading ? `<h2 class="post-h2" id="sec-${i + 1}">${esc(s.heading)}</h2>` : '',
    ...s.paras.map((p) => `<p class="post-p">${inline(p)}</p>`)
  ].filter(Boolean).join('\n')).join('\n');
  const snap = [
    `<h1>${esc(pageTitle)}</h1>`,
    `<p>${esc(e.year)} · ${esc(title)}：${esc(e.desc)}</p>`
  ];
  for (const s of post.sections) {
    if (s.heading) snap.push(`<h2>${esc(s.heading)}</h2>`);
    for (const p of s.paras) snap.push(`<p>${esc(plain(p))}</p>`);
  }
  const snapBlock = snap.join('\n') + '\n';

  const cover = e.cover || e.photoPending
    ? (e.cover
        ? `<figure class="post-cover"><img src="${esc(up(e.cover))}" alt="${esc(e.caption || title)}" loading="lazy">` +
          (e.caption ? `<figcaption class="post-caption">${esc(e.caption)}</figcaption>` : '') +
          `</figure>`
        : `<div class="post-cover is-empty"><p class="life-cover-empty">等待补上照片</p></div>`)
    : '';

  const prev = neighbors.prev;
  const next = neighbors.next;
  const left = prev
    ? `<a class="post-nav-cell" href="../${esc(prev.url)}"><span class="post-nav-kicker">← 上一篇</span><span class="post-nav-title">${esc(prev.title)}</span></a>`
    : `<a class="post-nav-cell" href="../index.html#life"><span class="post-nav-kicker">← 回到这几年</span><span class="post-nav-title">全部日常分享</span></a>`;
  const right = next
    ? `<a class="post-nav-cell is-right" href="../${esc(next.url)}"><span class="post-nav-kicker">下一篇 →</span><span class="post-nav-title">${esc(next.title)}</span></a>`
    : `<a class="post-nav-cell is-right" href="../archive.html"><span class="post-nav-kicker">更早的日常 →</span><span class="post-nav-title">看看归档里的旧记录</span></a>`;

  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: e.desc,
    inLanguage: 'zh-CN',
    author: { '@type': 'Person', name: '李文涛', url: SITE },
    publisher: { '@type': 'Person', name: '李文涛' },
    mainEntityOfPage: canon,
    ...(e.cover ? { image: `${SITE}${e.cover}` } : {}),
    isPartOf: { '@type': 'WebSite', name: '李文涛 · 这几年', url: SITE }
  }, null, 2).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(e.desc)}">
  <meta name="author" content="李文涛">
  <link rel="canonical" href="${esc(canon)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="李文涛的个人主页">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(e.desc)}">
  <meta property="og:url" content="${esc(canon)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:locale" content="zh_CN">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(e.desc)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <script type="application/ld+json">
${ld}
  </script>
  <link rel="icon" href="${esc(favicon)}" type="image/svg+xml">
  <script>
    (function () {
      try {
        var saved = localStorage.getItem('site.theme');
        if (!saved) saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        if (saved === 'dark') document.documentElement.classList.add('dark');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.setAttribute('arco-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        });
      } catch (e) { /* 隐私模式忽略 */ }
    })();
  </script>
${cssHrefs.map((h) => `  <link rel="stylesheet" href="${esc(h)}">`).join('\n')}
  <!-- 由 tools/generate-life.mjs 生成，请勿手改；改 content/posts/${esc(post.slug)}.md 后重跑 npm run life -->
</head>
<body>
  <a class="skip-link" href="#post-main">跳到正文</a>

  <header class="post-header">
    <div class="post-header-inner">
      <a class="post-brand" href="../index.html"><span class="post-brand-dot" aria-hidden="true"></span>李文涛 · 这几年</a>
      <div class="post-header-right">
        <a class="post-top-link" href="../index.html#life">这几年</a>
        <a class="post-top-link" href="../archive.html">更早的日常</a>
        <button type="button" data-theme-toggle aria-label="切换深浅主题" class="post-theme-btn">
          <svg class="post-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>
          <svg class="post-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"></path></svg>
        </button>
      </div>
    </div>
  </header>

  <main id="post-main" tabindex="-1" class="post-main">
    <nav class="post-crumb" aria-label="面包屑">
      <a href="../index.html">首页</a><span aria-hidden="true">/</span>
      <a href="../index.html#life">这几年</a><span aria-hidden="true">/</span>
      <span>${esc(title)}</span>
    </nav>

    <article class="post-article">
      <header class="post-head">
        <p class="post-year">${esc(e.year)}${e.tag ? ` <span aria-hidden="true">·</span> ${esc(e.tag)}` : ''}</p>
        <h1 class="post-title">${esc(title)}</h1>
        <p class="post-lead">${esc(e.desc)}</p>
      </header>

${cover ? '      ' + cover + '\n' : ''}${toc ? `      <nav class="post-toc" aria-label="本文目录">
        <p class="post-toc-label">这一篇写了什么</p>
        <ol>
${toc.split('\n').map((l) => '          ' + l).join('\n')}
        </ol>
      </nav>
` : ''}
      <div class="post-body">
${bodyHtml.split('\n').map((l) => '        ' + l).join('\n')}
      </div>

      <footer class="post-foot">
        <nav class="post-nav" aria-label="相邻文章">
${'          ' + left}
${'          ' + right}
        </nav>
        <a class="post-back" href="../index.html">← 返回生活首页</a>
      </footer>
    </article>
  </main>

  <noscript id="seo-snapshot">
<!-- seo-snapshot:start -->
${snapBlock}<!-- seo-snapshot:end -->
  </noscript>

  <script>
    (function () {
      var btn = document.querySelector('[data-theme-toggle]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var dark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('site.theme', dark ? 'dark' : 'light'); } catch (e) {}
        document.body.setAttribute('arco-theme', dark ? 'dark' : 'light');
      });
    })();
  </script>
</body>
</html>
`;
}

const postPages = postEntries.map((e) => {
  const post = postMap.get(e.post);
  return { slug: post.slug, html: renderPost(e, post, neighborOf(post.slug)) };
});

/* ------------------------------------------------------------ 7. sitemap */
function buildSitemap(xml) {
  const urls = postPages.map((p) => postUrl(p.slug));
  const entries = urls.map((u) =>
    `  <url>\n    <loc>${SITE}${u}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`
  ).join('');
  const block = `${P_START}\n${entries}${P_END}\n`;
  const re = new RegExp(P_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' + P_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?');
  if (re.test(xml)) return xml.replace(re, block);
  if (!xml.includes('</urlset>')) throw new Error('sitemap.xml：找不到 </urlset>');
  return xml.replace('</urlset>', block + '</urlset>');
}
const nextSitemap = buildSitemap(fs.readFileSync(SITEMAP, 'utf8'));

/* --------------------------------------------------------- 8. 版本号与落盘 */
// 只让「md 内容 + 文章正文 + data.js 里非 life/archive 的配置」影响版本号。
// 过滤空行是为了首次插入 archive 段前后结构等价，避免 --check 因版本号漂移而误报。
const stableTail = data.replace(LIFE_RE, '').replace(ARCHIVE_RE, '')
  .split('\n').filter((l) => l.trim() !== '').join('\n');
const postsDigest = [...postMap.values()].map((p) => p.slug + '\n' + p.raw).join('\n---\n');
const version = 'life-' + crypto.createHash('sha1')
  .update(md + '\n' + postsDigest + '\n' + stableTail)
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

const summary = `首页 ${homeEntries.length} 条（${homeReal.length} 真实 / ${slots.length} 占位），归档 ${archived.length} 条，文章 ${postPages.length} 篇，版本 ${version}`;
const artifacts = [
  ['assets/js/data.js', nextData],
  ['index.html', nextIdx],
  ['archive.html', nextArc],
  ['sitemap.xml', nextSitemap]
];

if (CHECK) {
  const bad = [];
  for (const [name, want] of artifacts) {
    if (fs.readFileSync(path.join(root, name), 'utf8') !== want) bad.push(name);
  }
  const wanted = new Set(postPages.map((p) => p.slug + '.html'));
  for (const p of postPages) {
    const f = path.join(POSTS_OUT, p.slug + '.html');
    if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== p.html) bad.push(`posts/${p.slug}.html`);
  }
  if (fs.existsSync(POSTS_OUT)) {
    const extra = fs.readdirSync(POSTS_OUT)
      .filter((f) => f.endsWith('.html') && !wanted.has(f));
    if (extra.length) bad.push(`多余的 posts/${extra.join(', ')}`);
  }
  if (bad.length) {
    console.error(`[life] 与 content/life.md 不一致：${bad.join('、')}；请运行 npm run life`);
    process.exit(1);
  }
  console.log(`[life] 一致 · ${summary}`);
  process.exit(0);
}

if (OUT) {
  fs.mkdirSync(path.join(OUT, 'posts'), { recursive: true });
  for (const [name, content] of artifacts) {
    const file = path.join(OUT, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  for (const p of postPages) fs.writeFileSync(path.join(OUT, 'posts', p.slug + '.html'), p.html);
  console.log(`[life] 已生成到 ${OUT} · ${summary}`);
} else {
  fs.mkdirSync(POSTS_OUT, { recursive: true });
  for (const [name, content] of artifacts) fs.writeFileSync(path.join(root, name), content);
  for (const p of postPages) fs.writeFileSync(path.join(POSTS_OUT, p.slug + '.html'), p.html);
  console.log(`[life] 已同步 data.js / index.html / archive.html / sitemap.xml / posts/*.html · ${summary}`);
}
