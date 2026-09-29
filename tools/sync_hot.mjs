#!/usr/bin/env node
/**
 * ============================================================================
 *  sync_hot.mjs —— 拉取开源行业热点站的公开只读 API，生成站点可直接消费的数据
 * ============================================================================
 *  数据源：一套开源的「自己找热点、自己写日报」的网站框架所暴露的公开匿名 API
 *          （无需 API Key，遵循其公开使用规则第 6 条：个人非商业使用不强制
 *           界面署名，但机器响应中的来源、canonical 与原文链接必须保留并传递）。
 *
 *  因此本脚本的取舍是：
 *    · 页面渲染层：不出现原站名称与 Logo，只展示原文标题、原文来源、原文链接；
 *    · 数据层：仍保留 canonical 与原文链接字段，页面不渲染但也不删除或篡改。
 *
 *  产出：
 *    assets/js/hot-data.js   window.__HOT_DATA__ = {...}
 *                            用 <script src> 方式加载而不是 fetch JSON，好处是
 *                            预渲染（tools/prerender.mjs 在 file:// 下跑）也能读到，
 *                            搜索引擎能抓到当天真正的热点正文。
 *
 *  用法：
 *    node tools/sync_hot.mjs            # 拉取并写入
 *    node tools/sync_hot.mjs --dry-run  # 只打印统计，不落盘
 *
 *  合规提醒：若将来把这些数据用于收费产品、客户交付、对外镜像或模型训练，
 *           需要先按对方公开使用规则取得书面授权。
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JS = path.join(ROOT, 'assets', 'js', 'hot-data.js');
const OUT_STORIES = path.join(ROOT, 'assets', 'js', 'hot-stories.js');

const API_BASE = process.env.HOT_API_BASE || 'https://aihot.news';
const UA = 'personal-hot-site-sync/1.0 (+https://github.com/jason19960330/website)';

const DRY = process.argv.includes('--dry-run');

/** 带 UA 与条件请求头的 GET；失败抛错由上层兜住，保证一个端点挂掉不影响其它端点 */
async function getJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    },
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.json();
}

const pick = (o, k, d = '') => (o && typeof o[k] === 'string' && o[k] ? o[k] : d);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** 取嵌套可选字段里的字符串，任意一层缺失都回退空串 */
const deep = (fn, d = '') => {
  try {
    const v = fn();
    return typeof v === 'string' && v ? v : d;
  } catch (e) { return d; }
};

/* 从「https://xxx/story/<publicId>」里取出 publicId；取不到返回空串 */
function storyIdFrom(url) {
  if (typeof url !== 'string' || !url) return '';
  const m = url.match(/\/story\/([^/?#]+)/);
  return m ? m[1] : '';
}

function mapItem(it) {
  return {
    id: pick(it, 'id'),
    title: pick(it, 'title'),
    originalTitle: pick(it, 'originalTitle'),
    summary: pick(it, 'summary'),
    reason: pick(it, 'reason'),
    category: pick(it, 'category', 'industry'),
    score: num(it.score),
    publishedAt: it.publishedAt || it.discoveredAt || null,
    sourceName: deep(() => it.source.name),
    url: deep(() => it.links.original),
    // 机器层保留来源 canonical（不删除、不篡改）；页面渲染不使用该字段
    canonical: deep(() => it.links.aihot)
  };
}

function mapTopic(t) {
  return {
    rank: num(t.rank),
    id: pick(t, 'id'),
    title: pick(t, 'title'),
    sourceName: deep(() => t.source.name),
    url: deep(() => t.links.original),
    sourceCount: num(t.sourceCount),
    signalCount: num(t.signalCount),
    participantCount: num(t.participantCount),
    sourceNames: Array.isArray(t.sourceNames) ? t.sourceNames.slice(0, 12) : [],
    latestAt: t.latestAt || null,
    // 事件详情页 id：从 links.story（形如 .../story/<publicId>）里取出末段
    storyId: storyIdFrom(deep(() => t.links.story)),
    canonical: deep(() => t.links.aihot)
  };
}

function mapDailyItem(it) {
  return {
    title: pick(it, 'title'),
    summary: pick(it, 'summary'),
    sourceName: deep(() => it.source.name),
    url: deep(() => it.links.original),
    canonical: deep(() => it.links.aihot)
  };
}

/**
 * 事件详情（story）：给热点榜每条事件抓 AI 综述 + 报道时间线。
 * 放在同步期而不是页面运行时拉取，好处是详情页纯静态、无网络依赖、秒开；
 * 控制并发为 3，避免一次打太多请求。任一事件失败只跳过它自己。
 */
function mapStory(s) {
  return {
    publicId: pick(s, 'publicId'),
    title: pick(s, 'title'),
    status: pick(s, 'status'),
    sourceCount: num(s.sourceCount),
    reportCount: num(s.reportCount),
    firstReportAt: s.firstReportAt || null,
    latestAt: s.latestAt || null,
    latest: pick(s, 'latest'),
    digest: pick(s, 'digest'),
    digestUpdatedAt: s.digestUpdatedAt || null,
    reports: (Array.isArray(s.reports) ? s.reports : []).map((r) => ({
      id: pick(r, 'id'),
      title: pick(r, 'title'),
      summary: pick(r, 'summary'),
      sourceName: deep(() => r.source.name),
      firstParty: !!(r.source && r.source.firstParty),
      publishedAt: r.publishedAt || null,
      url: deep(() => r.links.original)
    }))
  };
}

async function collectStories(topics) {
  const ids = topics.map((t) => t.storyId).filter(Boolean).slice(0, 10);
  const out = {};
  let okCount = 0;

  for (let i = 0; i < ids.length; i += 3) {
    const batch = ids.slice(i, i + 3);
    const res = await Promise.allSettled(
      batch.map((id) => getJSON(`${API_BASE}/api/v1/stories/${encodeURIComponent(id)}`))
    );
    res.forEach((r, k) => {
      if (r.status === 'fulfilled' && r.value && r.value.story) {
        const st = mapStory(r.value.story);
        if (st.publicId) { out[st.publicId] = st; okCount += 1; }
      }
    });
  }
  console.log(`[sync] 事件详情 ${okCount}/${ids.length} 条`);
  return out;
}

async function collect() {
  // 三路并行拉取，任一失败降级为空但不中断整体
  const [itemsRes, topicsRes, dailyRes] = await Promise.allSettled([
    getJSON(`${API_BASE}/api/v1/items?mode=selected&window=7d&by=timeline&limit=100`),
    getJSON(`${API_BASE}/api/v1/hot-topics`),
    getJSON(`${API_BASE}/api/v1/dailies/latest`)
  ]);

  const items = itemsRes.status === 'fulfilled'
    ? (Array.isArray(itemsRes.value.items) ? itemsRes.value.items.map(mapItem) : [])
    : [];
  const topics = topicsRes.status === 'fulfilled'
    ? (Array.isArray(topicsRes.value.items) ? topicsRes.value.items.map(mapTopic) : [])
    : [];
  const rawDaily = dailyRes.status === 'fulfilled' ? dailyRes.value.report : null;

  const daily = rawDaily
    ? {
        date: pick(rawDaily, 'date'),
        generatedAt: rawDaily.generatedAt || null,
        leadTitle: deep(() => rawDaily.lead.title),
        leadParagraph: deep(() => rawDaily.lead.leadParagraph),
        sections: (Array.isArray(rawDaily.sections) ? rawDaily.sections : []).map((s) => ({
          label: pick(s, 'label', '其它'),
          items: (Array.isArray(s.items) ? s.items : []).map(mapDailyItem)
        })),
        canonical: deep(() => rawDaily.links.aihot)
      }
    : null;

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    // 合规要求：标注这只是数据管道的来源信息，页面 UI 不展示品牌名
    provenance: {
      note: 'content synced from a public read-only industry hotspot API',
      repo: 'https://github.com/KKKKhazix/AIHOT',
      terms: `${API_BASE}/terms`
    },
    items,
    topics,
    daily,
    stats: {
      items: items.length,
      topics: topics.length,
      dailySections: daily ? daily.sections.length : 0,
      dailyItems: daily ? daily.sections.reduce((n, s) => n + s.items.length, 0) : 0
    },
    errors: [
      itemsRes.status === 'rejected' ? `items: ${itemsRes.reason.message}` : null,
      topicsRes.status === 'rejected' ? `hot-topics: ${topicsRes.reason.message}` : null,
      dailyRes.status === 'rejected' ? `dailies/latest: ${dailyRes.reason.message}` : null
    ].filter(Boolean)
  };
}

async function main() {
  const data = await collect();
  const stories = await collectStories(data.topics);

  console.log(`[sync] 精选条目 ${data.stats.items} 条 · 热点榜 ${data.stats.topics} 条 · 日报 ${data.stats.dailySections} 个板块 / ${data.stats.dailyItems} 条`);
  if (data.errors.length) console.warn('[sync] 部分端点失败：' + data.errors.join(' | '));
  if (data.stats.items === 0 && data.stats.topics === 0 && !data.daily) {
    console.error('[sync] 三个端点全部失败，不覆盖既有数据。');
    process.exit(1);
  }
  if (DRY) {
    console.log('[sync] dry-run 模式，未写入文件。');
    return;
  }

  fs.mkdirSync(path.dirname(OUT_JS), { recursive: true });
  fs.writeFileSync(
    OUT_JS,
    '/* 自动生成，请勿手改 —— 由 tools/sync_hot.mjs 写入，每 3 小时通过 Actions 自动同步 */\n' +
      'window.__HOT_DATA__ = ' + JSON.stringify(data) + ';\n',
    'utf8'
  );
  const kb = (fs.statSync(OUT_JS).size / 1024).toFixed(1);
  console.log(`[sync] 已写入 ${path.relative(ROOT, OUT_JS)}（${kb} KB）`);

  // 事件详情单独一个文件：详情页按 id 直接查表，不让列表页为它付出体积代价
  if (Object.keys(stories).length) {
    const payload = {
      schemaVersion: 1,
      updatedAt: data.updatedAt,
      stories
    };
    fs.writeFileSync(
      OUT_STORIES,
      '/* 自动生成，请勿手改 —— 由 tools/sync_hot.mjs 写入，每 3 小时通过 Actions 自动同步 */\n' +
        'window.__HOT_STORIES__ = ' + JSON.stringify(payload) + ';\n',
      'utf8'
    );
    const kb2 = (fs.statSync(OUT_STORIES).size / 1024).toFixed(1);
    console.log(`[sync] 已写入 ${path.relative(ROOT, OUT_STORIES)}（${kb2} KB，${Object.keys(stories).length} 个事件）`);
  } else {
    console.warn('[sync] 本次未拉到任何事件详情，保留既有 hot-stories.js');
  }
}

main().catch((e) => {
  console.error('[sync] 失败：', e.message);
  process.exit(1);
});
