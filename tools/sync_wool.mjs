#!/usr/bin/env node
/**
 * ============================================================================
 *  sync_wool.mjs —— 同步「羊毛速递」数据（资源雷达 · 真福利精选）
 * ============================================================================
 *  数据源：https://radar.zichuanlan.top/ 的公开只读接口 /api/items
 *  筛选口径 = 原站「真福利精选」：kind=freebie、免费/有条件领取、未过期、
 *            7 天内、AI 验真保留、评分 ≥ 50、按最新发布排序。
 *
 *  为什么不直接让浏览器跨域请求：
 *    该接口没有返回 Access-Control-Allow-Origin，浏览器直接 fetch 会被拦。
 *    所以走「GitHub Actions 定时抓 → 生成同源 JS → 页面用 <script> 读」，
 *    与站内 hot-data.js / weekly-index.js 的做法一致，预渲染也能读到。
 *
 *  产出：assets/js/wool.js
 *    window.WOOL_DATA = { schemaVersion, source, sourceName,
 *                         intervalMinutes, updatedAt, items: [...] }
 *    每次被重新加载时额外派发 wool:update，页面开着也能无刷新更新。
 *
 *  用法：
 *    node tools/sync_wool.mjs              # 抓取并写入（数据无变化则不写盘）
 *    node tools/sync_wool.mjs --dry-run    # 只打印本次抓到的条目
 *    node tools/sync_wool.mjs --check      # 离线校验现有 wool.js 结构
 *    node tools/sync_wool.mjs --out FILE   # 写到指定文件（临时目录/沙箱用）
 *
 *  说明：条目只保留标题、简介、领取方式、来源、发布时间与原文链接，
 *        每张卡都直达原始页面，并在首页标注数据来源与刷新频率。
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'assets', 'js', 'wool.js');
const API = process.env.WOOL_API ||
  'https://radar.zichuanlan.top/api/items?kind=freebie&obtain=free%2Cconditional' +
  '&unexpired=1&aiOnly=1&maxAgeDays=7&hideRejected=1&minScore=50&sort=newest&limit=60';
const SOURCE = 'https://radar.zichuanlan.top/';
const SOURCE_NAME = '资源雷达';
const INTERVAL_MINUTES = 30;
const LIMIT = 5;
const UA = 'personal-site-wool-sync/1.0 (+https://github.com/jason19960330/website)';

const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry-run');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > -1 ? path.resolve(process.argv[outIdx + 1]) : DEFAULT_OUT;

/* 原站 source_id → 卡片上显示的来源名；未登记的用 ID 兜底 */
const SOURCE_NAMES = {
  'linuxdo-welfare': 'LINUX DO 福利',
  'linuxdo-resource': 'LINUX DO 资源',
  'linuxdo-deals': 'LINUX DO 好价',
  'xhs-search': '小红书',
  'zhihu-search': '知乎',
  'rss-smzdm': '什么值得买',
  'rss-freebieshark': 'FreebieShark',
  'epic-free': 'Epic Games',
  'steam-free': 'Steam',
  'github-trending': 'GitHub',
  'rss-keylol': '其乐 Keylol',
  'rss-freestufftimes': 'Free Stuff Times',
  'bsky-plugins': 'Bluesky',
  'rss-nodeloc': 'NodeLoc'
};

function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function sourceLabel(id) {
  return SOURCE_NAMES[id] || clip(String(id || SOURCE_NAME).replace(/[-_]/g, ' '), 18) || SOURCE_NAME;
}

function tagOf(it) {
  if (Array.isArray(it.codes) && it.codes.length) return '含兑换码';
  if (it.kind === 'deal') return '好价';
  if (it.obtain === 'free') return '直接白嫖';
  if (it.obtain === 'conditional') return '有条件领';
  return '福利';
}

function usable(it) {
  if (!it || typeof it !== 'object') return false;
  if (it.status && it.status !== 'active') return false;
  if (it.ai_keep !== undefined && it.ai_keep !== null && Number(it.ai_keep) !== 1) return false;
  if (it.kind && it.kind !== 'freebie' && it.kind !== 'deal') return false;
  if (!/^https:\/\//.test(String(it.url || ''))) return false;
  const title = clip(it.title, 200);
  if (title.length < 5) return false;
  // 纯抽奖/开奖类对中文读者价值低，交给原站看，这里不占卡片
  if (/sweepstakes|giveaway|抽奖|开奖/i.test(title)) return false;
  // 没有发布时间的搜索聚合条目无法给出「多久前」，优先展示有时间戳的真实福利
  const ts = Date.parse(it.published_at || '');
  return Number.isFinite(ts) && ts <= Date.now() + 24 * 3600 * 1000;
}

function normalize(it) {
  return {
    id: String(it.id),
    title: clip(it.title, 58),
    summary: clip(it.summary || it.content || '', 110),
    url: String(it.url),
    tag: tagOf(it),
    obtain: it.obtain === 'free' ? 'free' : 'conditional',
    source: sourceLabel(it.source_id),
    publishedAt: new Date(it.published_at).toISOString()
  };
}

/** 在离线沙箱里执行 wool.js，取出 window.WOOL_DATA（不联网、不写盘） */
function readWool(file) {
  const js = fs.readFileSync(file, 'utf8');
  const sandbox = {
    window: {
      dispatchEvent: function () {},
      CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
    }
  };
  vm.runInNewContext(js, sandbox, { filename: path.basename(file) });
  return sandbox.window.WOOL_DATA;
}

function assertData(d, label) {
  if (!d || typeof d !== 'object') throw new Error(`${label} 未暴露 window.WOOL_DATA`);
  if (d.schemaVersion !== 1) throw new Error(`${label} schemaVersion 不是 1`);
  if (!String(d.source || '').includes('radar.zichuanlan.top')) throw new Error(`${label} 缺少数据来源`);
  if (d.intervalMinutes !== INTERVAL_MINUTES) throw new Error(`${label} 刷新间隔不是 30 分钟`);
  if (!Number.isFinite(Date.parse(d.updatedAt || ''))) throw new Error(`${label} updatedAt 不是合法时间`);
  if (!Array.isArray(d.items) || !d.items.length || d.items.length > LIMIT) {
    throw new Error(`${label} items 数量异常：${d.items && d.items.length}`);
  }
  for (const it of d.items) {
    for (const k of ['id', 'title', 'url', 'tag', 'obtain', 'source', 'publishedAt']) {
      if (!it[k]) throw new Error(`${label} 条目缺少 ${k}`);
    }
    if (!/^https:\/\//.test(it.url)) throw new Error(`${label} 条目链接不是 https：${it.url}`);
    if (!Number.isFinite(Date.parse(it.publishedAt))) throw new Error(`${label} 条目时间不合法`);
    if (!['free', 'conditional'].includes(it.obtain)) throw new Error(`${label} 领取方式异常`);
  }
}

function render(payload) {
  return '/* 自动生成，请勿手改 —— 由 tools/sync_wool.mjs 写入，每 30 分钟由 GitHub Actions 同步。\n' +
    ' * 数据来源：资源雷达 https://radar.zichuanlan.top/ 公开只读接口 /api/items。\n' +
    ' * 页面读 window.WOOL_DATA；重载本脚本时派发 wool:update 事件。\n' +
    ' */\n' +
    'window.WOOL_DATA = ' + JSON.stringify(payload, null, 2) + ';\n' +
    'if (typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {\n' +
    '  try { window.dispatchEvent(new window.CustomEvent("wool:update", { detail: window.WOOL_DATA })); } catch (e) {}\n' +
    '}\n';
}

async function main() {
  if (CHECK) {
    assertData(readWool(OUT), path.basename(OUT));
    const d = readWool(OUT);
    console.log(`[wool:check] ${path.basename(OUT)} 结构正常：${d.items.length} 条，更新于 ${d.updatedAt}`);
    return;
  }

  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`接口返回 HTTP ${res.status}`);
  const json = await res.json();
  const raw = Array.isArray(json.items) ? json.items : [];
  const items = raw.filter(usable).map(normalize);
  // 中文站点优先展示中文条目，组内保持「最新发布」顺序（ES2019 起 sort 稳定）
  items.sort(function (a, b) {
    return (/[\u4e00-\u9fff]/.test(b.title) ? 1 : 0) - (/[\u4e00-\u9fff]/.test(a.title) ? 1 : 0);
  });
  items.length = Math.min(items.length, LIMIT);
  if (items.length < 3) throw new Error(`只筛到 ${items.length} 条可用羊毛，保留旧数据`);

  if (DRY) {
    console.log(`[wool:dry] 接口 ${raw.length} 条 → 可用 ${items.length} 条`);
    items.forEach((it, i) => console.log(`  ${i + 1}. [${it.tag}] ${it.title} — ${it.source}`));
    return;
  }

  /* 只有条目真的变了才写盘：避免每 30 分钟产生一次无意义的自动提交 */
  if (fs.existsSync(OUT)) {
    try {
      const old = readWool(OUT);
      if (old && JSON.stringify(old.items) === JSON.stringify(items)) {
        console.log('[wool] 条目无变化，保留已有 wool.js（updatedAt 不刷新）');
        return;
      }
    } catch (e) {
      console.warn('[wool] 旧数据解析失败，将直接覆盖：' + e.message);
    }
  }

  const payload = {
    schemaVersion: 1,
    source: SOURCE,
    sourceName: SOURCE_NAME,
    intervalMinutes: INTERVAL_MINUTES,
    updatedAt: new Date().toISOString(),
    items
  };
  const content = render(payload);
  assertData(readWoolFromString(content), '新生成的数据');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, content, 'utf8');
  console.log(`[wool] 已写入 ${path.relative(ROOT, OUT)}：${items.length} 条，${(content.length / 1024).toFixed(1)} KB`);
  items.forEach((it, i) => console.log(`  ${i + 1}. [${it.tag}] ${it.title} — ${it.source}`));
}

function readWoolFromString(js) {
  const sandbox = {
    window: {
      dispatchEvent: function () {},
      CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
    }
  };
  vm.runInNewContext(js, sandbox, { filename: 'wool.js' });
  return sandbox.window.WOOL_DATA;
}

main().catch((e) => {
  console.error('[wool] 同步失败，保留旧数据：' + e.message);
  process.exit(1);
});
