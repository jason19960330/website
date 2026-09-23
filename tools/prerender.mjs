/**
 * ============================================================================
 *  prerender.mjs —— 为爬虫生成静态内容快照（由 tools/build.mjs 调用）
 * ============================================================================
 *  问题：整站是 Vue 在浏览器里渲染的，index.html 源码里只有 `{{ meta.name }}`
 *        这类占位符。搜索引擎（尤其百度、Bing、微信搜一搜）不执行 JS，抓到的是空壳。
 *
 *  方案：构建时用 jsdom 真跑一遍页面，把渲染结果写进页面末尾的
 *        <noscript id="seo-snapshot"> 区块。浏览器开启 JS 时这段是纯文本、
 *        不参与渲染（真实用户完全无感）；爬虫则能读到全部正文。
 *
 *  注意：noscript 必须放在 #app 之外 —— 放进 #app 会被 Vue 当成 in-DOM
 *        模板一起编译，直接炸掉。
 * ============================================================================
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 新增页面时在这里登记一行即可，appId 与页面里挂载 Vue 的根元素 id 对应
// query：渲染时附加在 URL 上的参数（weekly.html 用 ?all=1 关掉分页，让爬虫看到全部期刊）
const PAGES = [
  { file: 'index.html', appId: 'app' },
  { file: 'resume.html', appId: 'resume-app' },
  { file: 'weekly.html', appId: 'weekly-app', query: '?all=1' }
];

const START = '<!-- seo-snapshot:start -->';
const END = '<!-- seo-snapshot:end -->';

async function renderOne(page) {
  const file = path.join(root, page.file);
  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'file://' + file + (page.query || '')
  });
  // 等 Vue 挂载 + Arco 组件渲染 + 数据注入完成
  await new Promise((r) => setTimeout(r, 4500));

  const doc = dom.window.document;
  const app = doc.getElementById(page.appId);
  if (!app || app.innerHTML.includes('{{')) {
    dom.window.close();
    throw new Error(page.file + ' 渲染未完成，拒绝写入快照');
  }

  const holder = doc.createElement('div');
  holder.innerHTML = app.innerHTML;
  // 清掉对爬虫和体积都没价值的部分：图标 symbol、脚本、内联样式、交互控件
  // .vc-* = v-calendar 渲染的日历网格，纯日期数字对爬虫是噪声，只保留板块标题与图例
  holder.querySelectorAll('script, style, svg, [aria-hidden="true"], button, .no-print, .vc-container').forEach((n) => n.remove());
  // 折叠面板在快照里全部展开，否则爬虫会漏掉大段正文
  holder.querySelectorAll('.arco-collapse-item-content').forEach((n) => {
    n.style.display = 'block';
    n.style.height = 'auto';
  });

  const snapshot = holder.innerHTML.replace(/\s{2,}/g, ' ').trim();
  dom.window.close();

  let html = fs.readFileSync(file, 'utf8');
  const block = '\n<noscript id="seo-snapshot">\n' + START + '\n' + snapshot + '\n' + END + '\n</noscript>\n';
  const re = new RegExp('\\n?<noscript id="seo-snapshot">[\\s\\S]*?</noscript>\\n?');
  html = re.test(html) ? html.replace(re, block) : html.replace('</body>', block + '</body>');
  fs.writeFileSync(file, html, 'utf8');

  const text = snapshot.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log('[prerender] ' + page.file.padEnd(12) + ' 快照文本 ' + text.length + ' 字');
}

async function main() {
  for (const p of PAGES) await renderOne(p);
}

main().catch((e) => { console.error(e); process.exit(1); });
