/**
 * ============================================================================
 *  generate-skills.mjs —— Skill 指南卡片的唯一生成入口（node tools/generate-skills.mjs）
 * ============================================================================
 *  以前加一张卡要手工改 5 个地方：skill.html 实时模板、skill.html 的 SEO 快照、
 *  sitemap.xml，外加新建 doc 页与 doc.js。历史上有多次「快照标签损坏 / 卡片错位」
 *  都出在前两处的手工同步上。
 *
 *  现在：只改 content/skills.json 一条，然后跑 `npm run skills`。
 *  本脚本从配置生成两处卡片区 + sitemap 的 doc 条目，幂等（重复运行不叠加）。
 *
 *  ！硬约束（用户 2026-11-14 明确要求）：首页「03 可回看的轨迹」下方四格，每次刷新
 *  从 assets/js/skill-cards.js 随机抽 4 个，显示「技能名 + 一行 blurb 简短说明」。
 *  以后每新增一张 Skill，这张卡必须自动进入首页随机池 —— buildCardsJs() 全量读取
 *  cfg.cards 并自动刷新 index.html 的 skill-cards.js?v=skills-<hash> 缓存版本。
 *  blurb 是 skills.json 每张卡的必填字段（≤40 字），新增卡必须一起写。
 *  所以不要手工往首页四格 / app.js 写技能名，也不要另建第二份技能清单。
 *
 *  定位方式刻意不用自定义标记：两处卡片区都用现有 HTML 的结构锚点切分，
 *  这样 `npm run build` 里的 prerender.mjs 重新渲染 noscript 快照后，
 *  锚点依然成立，生成器随时可以再跑一次把快照规范化。
 *
 *  用法：
 *    node tools/generate-skills.mjs              # 生成并写入（内容没变则不写）
 *    node tools/generate-skills.mjs --check     # 只比对，不一致时退出码 1（给 CI 用）
 *    node tools/generate-skills.mjs --out DIR   # 把结果写到 DIR 下的同名文件，不改原文件
 *    node tools/generate-skills.mjs --config F  # 换一份配置（配合 --out 做演练，不碰正式文件）
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgIdx = args.indexOf('--config');
const CONFIG = cfgIdx >= 0 ? path.resolve(args[cfgIdx + 1]) : path.join(root, 'content/skills.json');
const SKILL = path.join(root, 'skill.html');
const SITEMAP = path.join(root, 'sitemap.xml');
const CARDS_JS = path.join(root, 'assets/js/skill-cards.js');
const INDEX = path.join(root, 'index.html');

/* skill.html 里两处卡片区的结构锚点（勿随意改动） */
const SNAP_START = '<!-- seo-snapshot:start -->';
const SNAP_END = '<!-- seo-snapshot:end -->';
const LIVE_START = '        <div class="wl-hero card sk-entry mt-4"';
const LIVE_END = '\n\n      </section>';
const SNAP_CARD_START = '<div class="wl-hero card sk-entry mt-4"';
const SNAP_CARD_END = '</section></main>';

const CHECK = args.includes('--check');
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : null;

/* ---------------------------------------------------------------- 配置校验 */
function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (cfg.schema !== 1) throw new Error('不支持的 skills.json schema：' + cfg.schema);
  if (!cfg.site || !cfg.entryText || !Array.isArray(cfg.cards) || !cfg.cards.length) {
    throw new Error('skills.json 缺少 site / entryText / cards');
  }
  const ids = new Set();
  const docs = new Set();
  const featured = cfg.cards.filter((c) => c.featured).length;
  if (featured !== 1) throw new Error('cards 里必须且只能有 1 张 featured 主卡，当前 ' + featured);

  cfg.cards.forEach((c, i) => {
    const label = `cards[${i}]`;
    for (const k of ['id', 'kicker', 'title', 'repo', 'doc']) {
      if (!c[k] || typeof c[k] !== 'string') throw new Error(`${label}.${k} 缺失`);
    }
    if (!c.desc || !(Array.isArray(c.desc) || typeof c.desc === 'string') || c.desc.length === 0) {
      throw new Error(`${label}.desc 缺失（字符串或字符串数组）`);
    }
    if (!c.blurb || typeof c.blurb !== 'string' || c.blurb.length > 40) {
      throw new Error(`${label}.blurb 缺失或超过 40 字（首页四格的一行简短说明）`);
    }
    if (!Array.isArray(c.stats) || c.stats.length !== 4) throw new Error(`${label}.stats 必须 4 项`);
    c.stats.forEach((s) => {
      if (!s || !s.label || !s.value) throw new Error(`${label}.stats 项缺 label/value`);
    });
    if (!/^[a-z0-9-]+-doc\.html$/.test(c.doc)) throw new Error(`${label}.doc 格式不对：${c.doc}`);
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(c.repo)) throw new Error(`${label}.repo 不是 GitHub 地址`);
    if (ids.has(c.id)) throw new Error(`重复 id：${c.id}`);
    if (docs.has(c.doc)) throw new Error(`重复 doc：${c.doc}`);
    ids.add(c.id);
    docs.add(c.doc);
  });
  return cfg;
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const descLines = (c) => (Array.isArray(c.desc) ? c.desc : [c.desc]);

/* --------------------------------------------------- 实时模板（人看到的） */
function renderLiveCards(cfg) {
  return cfg.cards.map((c) => {
    const isMain = !!c.featured;
    const heading = isMain ? 'h1' : 'h2';
    const open = isMain
      ? [
          '        <div class="wl-hero card sk-entry mt-4" role="link" tabindex="0"',
          `             aria-label="${esc(c.ariaLabel || '进入 ' + c.title.replace(/ 使用指南$/, '') + ' 完整指南')}"`,
          '             @click="goDoc($event)" @keydown.enter="goDoc($event)">'
        ].join('\n')
      : `        <!-- ${esc(c.comment || c.id + ' 使用指南入口卡')} -->\n        <div class="wl-hero card mt-6">`;

    const desc = descLines(c).map((line) => '                  ' + line).join('\n');
    const stats = c.stats
      .map((s) => `              <div><dt>${esc(s.label)}</dt><dd class="tnum">${esc(s.value)}</dd></div>`)
      .join('\n');

    return [
      open,
      '          <span class="wl-hero-bar" aria-hidden="true"></span>',
      '          <div class="p-6 sm:p-8">',
      '            <div class="mt-4 flex flex-wrap items-start justify-between gap-5">',
      '              <div class="min-w-0">',
      `                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-accent">${esc(c.kicker)}</p>`,
      `                <${heading} class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">${esc(c.title)}</${heading}>`,
      '                <p class="mt-3 max-w-2xl text-sm leading-relaxed text-dim">',
      desc,
      '                </p>',
      '              </div>',
      '',
      `              <a href="${esc(c.repo)}" target="_blank" rel="noopener" class="wl-src">`,
      '                <svg class="h-4 w-4"><use href="#i-external"></use></svg>',
      '                <span class="leading-tight">开源仓库<br>GitHub</span>',
      '              </a>',
      '            </div>',
      '',
      '            <dl class="wl-stats">',
      stats,
      '            </dl>',
      '',
      `            <a href="${esc(c.doc)}" class="sk-entry-link">`,
      `              <span>${esc(cfg.entryText)}</span>`,
      '              <svg class="h-4 w-4" aria-hidden="true"><use href="#i-arrow-right"></use></svg>',
      '            </a>',
      '          </div>',
      '        </div>'
    ].join('\n');
  }).join('\n\n');
}

/* --------------------------------------------- 快照（爬虫读的压缩静态文本） */
/* 与 prerender.mjs 的清理结果一致：去掉 svg / aria-hidden 装饰、Vue 指令属性，
   标签全部贴合，描述文字前后各留一个空格。 */
function renderSnapshotCards(cfg) {
  return cfg.cards.map((c) => {
    const isMain = !!c.featured;
    const heading = isMain ? 'h1' : 'h2';
    const open = isMain
      ? `<div class="wl-hero card sk-entry mt-4" role="link" tabindex="0" aria-label="${esc(c.ariaLabel || '进入 ' + c.title.replace(/ 使用指南$/, '') + ' 完整指南')}">`
      : '<div class="wl-hero card mt-6">';
    const desc = ' ' + descLines(c).join(' ') + ' ';
    const stats = c.stats
      .map((s) => `<div><dt>${esc(s.label)}</dt><dd class="tnum">${esc(s.value)}</dd></div>`)
      .join('');

    return open +
      '<div class="p-6 sm:p-8">' +
        '<div class="mt-4 flex flex-wrap items-start justify-between gap-5">' +
          '<div class="min-w-0">' +
            `<p class="text-xs font-semibold uppercase tracking-[0.2em] text-accent">${esc(c.kicker)}</p>` +
            `<${heading} class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">${esc(c.title)}</${heading}>` +
            `<p class="mt-3 max-w-2xl text-sm leading-relaxed text-dim">${desc}</p>` +
          '</div>' +
          `<a href="${esc(c.repo)}" target="_blank" rel="noopener" class="wl-src">` +
            '<span class="leading-tight">开源仓库<br>GitHub</span>' +
          '</a>' +
        '</div>' +
        `<dl class="wl-stats">${stats}</dl>` +
        `<a href="${esc(c.doc)}" class="sk-entry-link"><span>${esc(cfg.entryText)}</span></a>` +
      '</div></div>';
  }).join('');
}

/* -------------------------------------------------------------- skill.html */
function buildSkillHtml(html, cfg) {
  const liveStart = html.indexOf(LIVE_START);
  const liveEnd = html.indexOf(LIVE_END, liveStart);
  if (liveStart < 0 || liveEnd < 0) throw new Error('skill.html：找不到实时卡片区锚点，页面结构可能被改过');

  // 先替换实时区；末尾那个 '\n' 与保留的 '\n\n      </section>' 合成原有的三个换行
  let out = html.slice(0, liveStart) + renderLiveCards(cfg) + '\n' + html.slice(liveEnd);

  const snapStart = out.indexOf(SNAP_START);
  const snapEnd = out.indexOf(SNAP_END, snapStart);
  if (snapStart < 0 || snapEnd < 0) throw new Error('skill.html：找不到 seo-snapshot 标记');

  const body = out.slice(snapStart + SNAP_START.length, snapEnd);
  const cardStart = body.indexOf(SNAP_CARD_START);
  const cardEnd = body.indexOf(SNAP_CARD_END, cardStart);
  if (cardStart < 0 || cardEnd < 0) throw new Error('skill.html：找不到快照卡片区锚点');

  const newBody = body.slice(0, cardStart) + renderSnapshotCards(cfg) + body.slice(cardEnd);
  return out.slice(0, snapStart + SNAP_START.length) + newBody + out.slice(snapEnd);
}

/* -------------------------------------------------------------- sitemap.xml */
/* 只管 *-doc.html 条目：多余的删掉、缺的补到 </urlset> 前；其余页面的顺序原样保留。 */
function buildSitemap(xml, cfg) {
  const wanted = new Set(cfg.cards.map((c) => c.doc));
  const blockRe = /  <url>\n    <loc>([^<]+)<\/loc>\n    <changefreq>[^<]+<\/changefreq>\n    <priority>[^<]+<\/priority>\n  <\/url>\n/g;
  const present = new Set();

  let out = xml.replace(blockRe, (block, loc) => {
    const file = loc.split('/').pop();
    if (!file.endsWith('-doc.html')) return block;
    present.add(file);
    return wanted.has(file) ? block : '';
  });

  const missing = cfg.cards.filter((c) => !present.has(c.doc));
  if (missing.length) {
    const entries = missing.map((c) =>
      `  <url>\n    <loc>${cfg.site}${c.doc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`
    ).join('');
    if (!out.includes('</urlset>')) throw new Error('sitemap.xml：找不到 </urlset>');
    out = out.replace('</urlset>', entries + '</urlset>');
  }
  return out;
}

/* ------------------------------------------------------------------
 * 首页随机技能池：从同一份 skills.json 抽 id / 短名 / 指南页，供首页四格
 * 每次刷新随机展示 4 个。短名去掉「使用指南」后缀，卡片里更简洁。
 * index.html 里 skill-cards.js 的缓存版本号也由这里幂等维护。
 * ---------------------------------------------------------------- */
function shortTitle(title) {
  return String(title).replace(/\s*使用指南\s*$/, '').trim();
}
function buildCardsJs(cfg) {
  const list = cfg.cards.map((c) => ({
    id: c.id,
    name: shortTitle(c.title) || c.title,
    blurb: c.blurb,
    title: c.title,
    doc: c.doc,
    kicker: c.kicker
  }));
  const version = 'skills-' + crypto.createHash('sha1')
    .update(JSON.stringify(list)).digest('hex').slice(0, 8);
  const content = '/* 由 tools/generate-skills.mjs 从 content/skills.json 生成，请勿手改。\n'
    + '   首页「03 可回看的轨迹」下方四格每次刷新从这里随机抽 4 个。 */\n'
    + 'window.SKILL_CARDS = ' + JSON.stringify(list, null, 2) + ';\n';
  return { content, version };
}
function buildIndex(html, version) {
  const re = /skill-cards\.js\?v=[^"']+/;
  if (!re.test(html)) throw new Error('index.html 找不到 skill-cards.js 的缓存版本号');
  return html.replace(re, 'skill-cards.js?v=' + version);
}

/* ------------------------------------------------------------------- 主流程 */
function firstDiff(a, b) {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] !== B[i]) return `第 ${i + 1} 行\n  现有: ${A[i].slice(0, 120)}\n  生成: ${B[i].slice(0, 120)}`;
  }
  return `行数不同（现有 ${A.length} / 生成 ${B.length}）`;
}

function main() {
  const cfg = loadConfig();
  const cards = buildCardsJs(cfg);
  const results = [
    { file: SKILL, content: buildSkillHtml(fs.readFileSync(SKILL, 'utf8'), cfg) },
    { file: SITEMAP, content: buildSitemap(fs.readFileSync(SITEMAP, 'utf8'), cfg) },
    { file: CARDS_JS, content: cards.content },
    { file: INDEX, content: buildIndex(fs.readFileSync(INDEX, 'utf8'), cards.version) }
  ];

  console.log(`[generate] content/skills.json  ${cfg.cards.length} 张卡`);
  let dirty = false;

  for (const r of results) {
    const old = fs.existsSync(r.file) ? fs.readFileSync(r.file, 'utf8') : '';
    const same = old === r.content;
    console.log(`[generate] ${path.basename(r.file).padEnd(14)} ${same ? '一致' : (CHECK ? '需要重新生成' : '已更新')}`);
    if (!same) {
      dirty = true;
      if (CHECK) console.log('           ' + firstDiff(old, r.content));
    }
    if (!CHECK && !OUT_DIR && !same) fs.writeFileSync(r.file, r.content, 'utf8');
    if (OUT_DIR) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, path.basename(r.file)), r.content, 'utf8');
    }
  }

  if (OUT_DIR) console.log(`[generate] 结果已写入 ${OUT_DIR}（原文件未改动）`);
  if (CHECK && dirty) {
    console.error('[generate] --check 未通过：请先运行 npm run skills 再提交。');
    process.exit(1);
  }
}

main();
