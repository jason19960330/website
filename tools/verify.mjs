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
