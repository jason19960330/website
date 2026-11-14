/**
 * ============================================================================
 *  verify.mjs —— 站点结构 / 内容一致性总校验（npm run verify）
 * ============================================================================
 *  以前每加一张卡都要手工跑一遍临时脚本：标签平衡、目录锚点、Vue 模板变量、
 *  本地链接、快照卡片数、Vue 编译、JS 语法……这里把它们固化下来。
 *
 *  纯静态检查，不需要浏览器、不需要网络，也不写任何文件。
 *  任何一项失败退出码为 1，适合挂到 CI 或提交前跑一次。
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const { compile } = require('@vue/compiler-dom');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(root, 'content/skills.json');
const SKILL = path.join(root, 'skill.html');
const SITEMAP = path.join(root, 'sitemap.xml');
const GENERATOR = path.join(root, 'tools/generate-skills.mjs');

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const cards = cfg.cards;
const docPages = cards.map((c) => path.join(root, c.doc));
const docScripts = cards.map((c) => path.join(root, 'assets/js', c.doc.replace(/\.html$/, '.js')));

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ ok: true, name, detail: detail || '' });
  } catch (e) {
    results.push({ ok: false, name, detail: e.message });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const count = (s, re) => (s.match(re) || []).length;
const basename = (p) => path.basename(p);

/* ------------------------------------------------------- HTML 标签平衡检查 */
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
  'path', 'circle', 'use', 'line', 'polygon', 'polyline', 'rect', 'stop'
]);
function balance(html) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
  const stack = [];
  const errors = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const tag = m[2].toLowerCase();
    if (m[1]) {
      if (VOID.has(tag)) continue;
      if (!stack.length) { errors.push(`多余的 </${tag}>`); continue; }
      if (stack[stack.length - 1] === tag) stack.pop();
      else errors.push(`</${tag}> 与 <${stack[stack.length - 1]}> 不匹配`);
    } else if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) {
      stack.push(tag);
    }
  }
  return { unclosed: stack, errors };
}
function assertBalanced(html, label) {
  const r = balance(html);
  assert(
    !r.unclosed.length && !r.errors.length,
    `${label} 标签不平衡：未闭合 [${r.unclosed.slice(0, 4).join(', ')}]；错误 ${r.errors.slice(0, 3).join(' / ')}`
  );
}

/* ------------------------------------------------------------- Vue 模板编译 */
function templateOf(html) {
  const dom = new JSDOM(html);
  const app = dom.window.document.getElementById('skill-app');
  const frag = app ? app.innerHTML : '';
  dom.window.close();
  return frag;
}
function assertVueCompiles(html, label) {
  const frag = templateOf(html);
  assert(frag.length > 500, `${label} 找不到 #skill-app 模板`);
  const errors = [];
  compile(frag, { onError: (e) => errors.push(e.message), onWarn: () => {} });
  assert(!errors.length, `${label} Vue 编译错误：${errors.slice(0, 2).join(' / ')}`);
}

/* ------------------------------------------------------------ 本地资源可达 */
function assertLocalLinks(html, label) {
  const refs = [...html.matchAll(/(?:href|src)="((?!https?:|#|mailto:|data:)[^"#?]+)"/g)]
    .map((m) => m[1]);
  const missing = [...new Set(refs)].filter((r) => !fs.existsSync(path.join(root, r)));
  assert(!missing.length, `${label} 引用了不存在的文件：${missing.slice(0, 5).join(', ')}`);
}

/* doc.js 里 TEXTS 的 key 有两种写法：
   `install:\n  '...'`（9 个新页）和 `install: '...'`（最初的 skill-doc.js），
   所以只在 TEXTS 对象区间内按 `^\s+key:` 抓取，不要求行尾为空。 */
function jsTextKeys(js) {
  const start = js.indexOf('var TEXTS = {');
  const end = start < 0 ? -1 : js.indexOf('\n  };', start);
  const body = start < 0 ? js : js.slice(start, end < 0 ? js.length : end);
  return new Set([...body.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]));
}

/* ================================================================= 检查项 */

/* 1. 配置与生成产物是否同步（顺带复用生成器的配置校验） */
check('配置与生成产物同步（generate-skills --check）', () => {
  execFileSync(process.execPath, [GENERATOR, '--check'], { cwd: root, stdio: 'pipe' });
  return `${cards.length} 张卡，两处卡片区与 sitemap 均已同步`;
});

/* 2. 四处卡片数一致 */
check('卡片数一致（配置 / 实时 / 快照 / sitemap）', () => {
  const html = fs.readFileSync(SKILL, 'utf8');
  const live = html.split('<!-- seo-snapshot:start -->')[0];
  const snap = html.split('<!-- seo-snapshot:start -->')[1].split('<!-- seo-snapshot:end -->')[0];
  const sitemap = fs.readFileSync(SITEMAP, 'utf8');
  const liveN = count(live, /class="sk-entry-link"/g);
  const snapN = count(snap, /class="sk-entry-link"/g);
  const docUrls = [...sitemap.matchAll(/<loc>[^<]*\/([^/]+\.html)<\/loc>/g)]
    .map((m) => m[1]).filter((f) => f.endsWith('-doc.html'));
  assert(liveN === cards.length, `实时模板 ${liveN} 张，配置 ${cards.length} 张`);
  assert(snapN === cards.length, `SEO 快照 ${snapN} 张，配置 ${cards.length} 张`);
  assert(docUrls.length === cards.length, `sitemap 中 doc 条目 ${docUrls.length} 条，配置 ${cards.length} 张`);
  for (const c of cards) assert(docUrls.includes(c.doc), `sitemap 缺少 ${c.doc}`);
  assert(!snap.includes('<svg'), 'SEO 快照里混入了 svg 装饰（应只留可见文字）');
  return `${liveN} / ${snapN} / ${docUrls.length} / ${cards.length}`;
});

/* 3. skill.html 自身 */
check('skill.html 标签平衡 / Vue 编译 / 本地链接', () => {
  const html = fs.readFileSync(SKILL, 'utf8');
  const snap = html.split('<!-- seo-snapshot:start -->')[1].split('<!-- seo-snapshot:end -->')[0];
  // 必须校验完整文件：只截 seo-snapshot 之前会把 <html>/<body>/<noscript> 切掉一半
  assertBalanced(html, 'skill.html');
  assertBalanced(snap, 'skill.html SEO 快照');
  assertVueCompiles(html, 'skill.html');
  assertLocalLinks(html, 'skill.html');
  return '实时模板 + 快照均平衡，Vue 编译 0 错误';
});

/* 4. 每张卡对应的 doc 页与逻辑脚本存在，且互相引用 */
check('指南页 / 逻辑脚本成对且被正确引用', () => {
  cards.forEach((c, i) => {
    assert(fs.existsSync(docPages[i]), `缺少 ${c.doc}`);
    assert(fs.existsSync(docScripts[i]), `缺少 assets/js/${basename(docScripts[i])}`);
    const html = fs.readFileSync(docPages[i], 'utf8');
    assert(
      html.includes('assets/js/' + basename(docScripts[i])),
      `${c.doc} 没有引用 assets/js/${basename(docScripts[i])}`
    );
    assert(html.includes(c.repo), `${c.doc} 没有指向上游仓库 ${c.repo}`);
  });
  return `${cards.length} 组 doc.html + doc.js`;
});

/* 5. 逐页结构校验 */
check('10 个指南页：标签 / 锚点 / 模板变量 / 链接 / Vue 编译', () => {
  const problems = [];
  cards.forEach((c, i) => {
    const page = docPages[i];
    const html = fs.readFileSync(page, 'utf8');
    const js = fs.readFileSync(docScripts[i], 'utf8');
    const name = basename(page);
    try {
      assertBalanced(html, name);

      const ids = new Set([...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]));
      const anchors = new Set([...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]));
      const lost = [...anchors].filter((a) => !ids.has(a));
      assert(!lost.length, `${name} 目录锚点找不到对应章节：${lost.join(', ')}`);
      assert(ids.size === 8, `${name} 章节数 ${ids.size}，应为 8`);

      const used = new Set([
        ...[...html.matchAll(/\{\{\s*texts\.(\w+)\s*\}\}/g)].map((m) => m[1]),
        ...[...html.matchAll(/(?:copied === '|copy\(')(\w+)/g)].map((m) => m[1])
      ]);
      const jsKeys = jsTextKeys(js);
      const absent = [...used].filter((k) => !jsKeys.has(k));
      assert(!absent.length, `${name} 模板用到的复制块在 JS 里不存在：${absent.join(', ')}`);

      assertVueCompiles(html, name);
      assertLocalLinks(html, name);
      new vm.Script(js, { filename: basename(docScripts[i]) });
      assert(js.includes("mount('#skill-app')"), `${name} 的 JS 没有挂载 #skill-app`);
    } catch (e) {
      problems.push(e.message);
    }
  });
  assert(!problems.length, problems.join('；'));
  return `8 节 × ${cards.length} 页，锚点 / 变量 / 链接 / 语法全部对齐`;
});

/* 6. sitemap 本身 */
check('生活首页 / 工作经历页 / sitemap / 内容层联动', () => {
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const live = idx.split('<!-- seo-snapshot:start -->')[0];
  assert(fs.existsSync(path.join(root, 'work.html')), '缺少 work.html');
  for (const id of ['home', 'life', 'growth', 'work', 'calendar', 'contact']) {
    assert(live.includes(`id="${id}"`), `index.html 实时区缺少 section #${id}`);
  }
  assert(!live.includes('id="timeline"'), 'index.html 仍残留旧的工作经历明细段');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert(sitemap.includes('/work.html'), 'sitemap 未登记 work.html');
  const cfg = fs.readFileSync(path.join(root, 'assets/js/data.js'), 'utf8');
  assert(cfg.includes('life:') && cfg.includes('growth:') && cfg.includes('photos:'), 'data.js 缺少 life / growth / photos');
  const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
  assert(app.includes('life: CONFIG.life') && app.includes('growth: CONFIG.growth')
    && app.includes('photos: CONFIG.photos'), 'app.js 未暴露 life / growth / photos');
  return '首页 6 段、work.html、sitemap、内容层与逻辑层齐全';
});

check('生活年表：life.md 与生成产物一致', () => {
  execFileSync(process.execPath, [path.join(root, 'tools/generate-life.mjs'), '--check'], {
    cwd: root, stdio: 'pipe'
  });
  return 'data.js / SEO 快照 / 缓存版本号均由 content/life.md 生成';
});

check('归档页：滚动切分 / 加载更多 / sitemap / 快照', () => {
  const arcPath = path.join(root, 'archive.html');
  assert(fs.existsSync(arcPath), '缺少 archive.html');
  assert(fs.existsSync(path.join(root, 'assets/js/archive.js')), '缺少 assets/js/archive.js');
  const arc = fs.readFileSync(arcPath, 'utf8');
  assert(arc.includes('id="archive-app"') && arc.includes('archive.js'), '归档页挂载点 / 脚本缺失');
  assert(arc.includes('archive.entries') && arc.includes('archive.empty'), '归档页模板未渲染条目 / 空态');
  assert(arc.includes('<!-- seo-snapshot:start -->'), '归档页缺少 SEO 快照锚点');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // 归档入口只保留在首页底部「加载更多」；顶部导航按需求不再挂「归档」链接
  assert(/<a[^>]*href="archive\.html"[^>]*class="life-more"/.test(idx), '首页「加载更多」未指向归档页');
  const cfg = fs.readFileSync(path.join(root, 'assets/js/data.js'), 'utf8');
  assert(cfg.includes('\n  archive: {'), 'data.js 缺少 archive 段');
  const seg = (key) => cfg.split('\n  ' + key + ': {')[1].split('\n  },')[0];
  const count = (s) => (s.match(/\{ year:/g) || []).length;
  const homeCount = count(seg('life'));
  const arcCount = count(seg('archive'));
  assert(homeCount === 6, `首页应固定 6 条，实际 ${homeCount} 条`);
  const md = fs.readFileSync(path.join(root, 'content/life.md'), 'utf8');
  const realCount = (md.match(/^### /gm) || []).length - (md.match(/^- 占位：是/gm) || []).length;
  assert(arcCount === Math.max(0, realCount - 3), '归档条数与「真实记录 - 3」不符');
  const sitemap = fs.readFileSync(SITEMAP, 'utf8');
  assert(sitemap.includes('/archive.html'), 'sitemap 未登记 archive.html');
  const pre = fs.readFileSync(path.join(root, 'tools/prerender.mjs'), 'utf8');
  assert(pre.includes("file: 'archive.html'"), 'prerender.mjs 未登记归档页');
  return `首页 6 条 / 归档 ${arcCount} 条，入口与快照齐全`;
});

check('生活年表：封面图片已入库且写进 data.js', () => {
  const md = fs.readFileSync(path.join(root, 'content/life.md'), 'utf8');
  const covers = [...md.matchAll(/^- 封面：(.+)$/gm)].map((m) => m[1].trim());
  const missing = covers.filter((c) => !fs.existsSync(path.join(root, c)));
  assert(!missing.length, `封面图片不存在：${missing.join('、')}`);
  const cfg = fs.readFileSync(path.join(root, 'assets/js/data.js'), 'utf8');
  for (const c of covers) assert(cfg.includes(c), `data.js 未写入封面 ${c}`);
  return covers.length ? `${covers.length} 张封面已入库并写入 data.js` : '暂无封面图片';
});


check('日常分享文章页：标题可点 / 静态全文 / sitemap / SEO 快照', () => {
  const md = fs.readFileSync(path.join(root, 'content/life.md'), 'utf8');
  const slugs = [...md.matchAll(/^- 文章：(.+)$/gm)]
    .map((m) => m[1].trim().replace(/\.md$/i, ''));
  assert(slugs.length, 'life.md 里没有任何带全文的条目');
  assert(new Set(slugs).size === slugs.length, 'life.md 里「- 文章：」短名重复');

  for (const f of ['index.html', 'archive.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    assert(html.includes(':href="e.url"'), `${f} 卡片标题没有绑定 e.url`);
    assert(html.includes('life-title-link'), `${f} 缺少可点标题样式类`);
  }
  const cfg = fs.readFileSync(path.join(root, 'assets/js/data.js'), 'utf8');
  const sitemap = fs.readFileSync(SITEMAP, 'utf8');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const slug of slugs) {
    assert(/^[a-z0-9][a-z0-9-]*$/.test(slug), `文章短名不合法：${slug}`);
    const src = path.join(root, 'content/posts', slug + '.md');
    assert(fs.existsSync(src), `缺少 content/posts/${slug}.md`);
    assert(fs.readFileSync(src, 'utf8').includes('# '), `content/posts/${slug}.md 没有章节小标题`);
    const page = path.join(root, 'posts', slug + '.html');
    assert(fs.existsSync(page), `缺少 posts/${slug}.html`);
    const html = fs.readFileSync(page, 'utf8');
    assertBalanced(html, `posts/${slug}.html`);
    assert(html.includes('<!-- seo-snapshot:start -->') && html.includes('<!-- seo-snapshot:end -->'),
      `posts/${slug}.html 缺少 SEO 快照`);
    for (const cls of ['post-toc', 'post-cover', 'post-nav', 'post-body']) {
      assert(html.includes(cls), `posts/${slug}.html 缺少 .${cls}`);
    }
    assert(html.includes('../index.html') && html.includes('../archive.html'),
      `posts/${slug}.html 缺少返回入口`);
    // 文章页在 posts/ 子目录：../ 前缀要剥掉再按站点根解析
    const refs = [...html.matchAll(/(?:href|src)="(\.\.\/[^"#?]+)"/g)].map((m) => m[1]);
    const missing = [...new Set(refs)]
      .filter((r) => !fs.existsSync(path.join(root, r.replace(/^\.\.\//, ''))));
    assert(!missing.length, `posts/${slug}.html 引用了不存在的文件：${missing.slice(0, 4).join(', ')}`);
    assert(cfg.includes(`posts/${slug}.html`), `data.js 未写入 posts/${slug}.html`);
    assert(idx.includes(`href="posts/${slug}.html"`), `首页 SEO 快照未链接 posts/${slug}.html`);
    assert(sitemap.includes(`/posts/${slug}.html`), `sitemap 未登记 posts/${slug}.html`);
  }
  return `${slugs.length} 篇文章，标题 / 全文快照 / sitemap 全链路打通`;
});

check('sitemap.xml 结构完整且 URL 不重复', () => {
  const xml = fs.readFileSync(SITEMAP, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert(xml.trim().endsWith('</urlset>'), 'sitemap.xml 未正常结束');
  assert(locs.length === count(xml, /<url>/g), `<url> 与 <loc> 数量不一致`);
  assert(new Set(locs).size === locs.length, 'sitemap 里有重复 URL');
  return `${locs.length} 个 URL，无重复`;
});

/* ================================================================== 汇总 */
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  if (!r.ok) failed++;
}
console.log(`[verify] ${results.length - failed}/${results.length} 项通过`);
if (failed) process.exit(1);
