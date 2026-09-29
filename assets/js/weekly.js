/**
 * ============================================================================
 *  weekly.js —— AI 行业热点速览页（weekly.html）逻辑层
 * ============================================================================
 *  数据来源分两级：
 *    1. assets/js/hot-data.js —— 由 tools/sync_hot.mjs 生成、GitHub Actions
 *       每 3 小时自动同步并提交。用 <script src> 而不是 fetch，好处是预渲染
 *       （jsdom 跑在 file:// 下）同样能读到，爬虫与搜索引擎能看到当天正文。
 *    2. 兜底直连公开只读接口 —— 只有数据文件缺失且页面跑在 http(s) 下才触发，
 *       比如刚 fork 仓库、Actions 还没跑过。接口允许跨域，但不要依赖它，
 *       它有轮询间隔要求，高频直接访问不礼貌。
 *
 *  合规：个人非商业使用无需界面署名，因此页面不出现对方站名与 Logo；
 *        但每条内容都保留并展示原文链接与原始信源名，版权归原作者所有。
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  if (!VueNS) { console.error('[weekly] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';
  var API_BASE = 'https://aihot.news';

  /* 分类 key → 中文显示名（接口返回英文 key，未知分类兜底「其它」） */
  var CAT_LABEL = {
    'ai-models': '模型',
    'model': '模型',
    'ai-products': '产品',
    'product': '产品',
    'industry': '行业',
    'paper': '论文',
    'research': '论文',
    'tip': '观点',
    'opinion': '观点',
    'tutorial': '教程'
  };

  var WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function dayKey(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'unknown';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dayLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '时间未知';
    var md = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (dayKey(iso) === dayKey(Date.now())) return '今天 · ' + md;
    if (dayKey(iso) === dayKey(Date.now() - 86400000)) return '昨天 · ' + md;
    return md + ' ' + WEEKDAY[d.getDay()];
  }
  function fmtTime(iso) {
    if (!iso) return '--:--';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '--:--' : pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function relTime(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '';
    var h = Math.floor(diff / 3600000);
    if (h < 1) return Math.max(1, Math.floor(diff / 60000)) + ' 分钟前';
    if (h < 24) return h + ' 小时前';
    return Math.floor(h / 24) + ' 天前';
  }
  /* 「X：某人（@a, 某机构）（RSS）」这类长信源名压成短名 */
  function shortName(name) {
    if (!name) return '';
    return String(name).replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim().slice(0, 20);
  }

  var app = VueNS.createApp({
    setup: function () {
      var ref = VueNS.ref;
      var computed = VueNS.computed;
      var onMounted = VueNS.onMounted;

      /* ---------------- 主题（与全站共用 localStorage 键） ---------------- */
      var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      document.body.setAttribute('arco-theme', theme.value);
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', theme.value === 'dark');
        document.body.setAttribute('arco-theme', theme.value);
        try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
      }

      /* ---------------- 数据装载 ---------------- */
      var raw = window.__HOT_DATA__ || null;
      var items = ref(raw && Array.isArray(raw.items) ? raw.items : []);
      var topics = ref(raw && Array.isArray(raw.topics) ? raw.topics : []);
      var daily = ref(raw && raw.daily ? raw.daily : null);
      var updatedAt = ref(raw && raw.updatedAt ? raw.updatedAt : null);
      var loading = ref(!raw);

      // 兜底：数据文件缺失且跑在 http(s) 下，直接问接口要一次
      if (!raw && location.protocol !== 'file:' && typeof fetch === 'function') {
        fetch(API_BASE + '/api/v1/items?mode=selected&window=7d&by=timeline&limit=100')
          .then(function (r) { return r.json(); })
          .then(function (j) {
            items.value = (j.items || []).map(function (it) {
              return {
                id: it.id, title: it.title, originalTitle: it.originalTitle || '',
                summary: it.summary || '', reason: it.reason || '',
                category: it.category || '', score: it.score || 0,
                publishedAt: it.publishedAt || it.discoveredAt || null,
                sourceName: (it.source && it.source.name) || '',
                url: (it.links && it.links.original) || ''
              };
            });
            updatedAt.value = new Date().toISOString();
            loading.value = false;
          })
          .catch(function () { loading.value = false; });

        fetch(API_BASE + '/api/v1/hot-topics')
          .then(function (r) { return r.json(); })
          .then(function (j) {
            topics.value = (j.items || []).map(function (t) {
              return {
                rank: t.rank, id: t.id, title: t.title,
                sourceName: (t.source && t.source.name) || '',
                url: (t.links && t.links.original) || '',
                sourceCount: t.sourceCount || 0, participantCount: t.participantCount || 0,
                signalCount: t.signalCount || 0, sourceNames: t.sourceNames || [],
                latestAt: t.latestAt || null
              };
            });
          })
          .catch(function () { /* 榜单失败不影响精选 */ });

        fetch(API_BASE + '/api/v1/dailies/latest')
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var rep = j.report;
            if (!rep) return;
            daily.value = {
              date: rep.date,
              leadTitle: (rep.lead && rep.lead.title) || '',
              leadParagraph: (rep.lead && rep.lead.leadParagraph) || '',
              sections: (rep.sections || []).map(function (s) {
                return {
                  label: s.label || '其它',
                  items: (s.items || []).map(function (x) {
                    return {
                      title: x.title, summary: x.summary || '',
                      sourceName: (x.source && x.source.name) || '',
                      url: (x.links && x.links.original) || ''
                    };
                  })
                };
              })
            };
          })
          .catch(function () { /* 日报失败不影响精选 */ });
      }

      /* ---------------- 视图状态 ---------------- */
      var tab = ref('feed');           // feed 精选 / topics 热点榜 / daily AI 日报
      var keyword = ref('');
      var scope = ref('today');        // today 今天 / all 近七天
      var cat = ref('all');
      var kwInput = ref(null);

      var todayKey = dayKey(Date.now());

      /* ---------------- 派生数据 ---------------- */
      var todayCount = computed(function () {
        return items.value.filter(function (i) { return dayKey(i.publishedAt) === todayKey; }).length;
      });

      var hasData = computed(function () {
        return items.value.length > 0 || topics.value.length > 0 || !!daily.value;
      });

      var updatedLabel = computed(function () {
        if (!updatedAt.value) return '待同步';
        var d = new Date(updatedAt.value);
        if (isNaN(d.getTime())) return '待同步';
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      });

      var dateBig = computed(function () {
        var d = new Date();
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
      });
      var weekLabel = computed(function () { return WEEKDAY[new Date().getDay()]; });

      var categories = computed(function () {
        var map = {};
        items.value.forEach(function (i) {
          var k = i.category || 'other';
          map[k] = (map[k] || 0) + 1;
        });
        var list = [{ key: 'all', label: '全部', count: items.value.length }];
        var order = ['ai-models', 'ai-products', 'industry', 'paper', 'tip'];
        Object.keys(map).sort(function (a, b) {
          var ia = order.indexOf(a), ib = order.indexOf(b);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        }).forEach(function (k) {
          list.push({ key: k, label: CAT_LABEL[k] || '其它', count: map[k] });
        });
        return list;
      });

      var scoped = computed(function () {
        if (scope.value !== 'today') return items.value;
        return items.value.filter(function (i) { return dayKey(i.publishedAt) === todayKey; });
      });

      var filtered = computed(function () {
        var kw = keyword.value.trim().toLowerCase();
        var list = scoped.value;
        if (cat.value !== 'all') {
          list = list.filter(function (i) { return (i.category || 'other') === cat.value; });
        }
        if (kw) {
          list = list.filter(function (i) {
            return ((i.title || '') + (i.summary || '') + (i.sourceName || '') + (i.reason || '')).toLowerCase().indexOf(kw) >= 0;
          });
        }
        // 「今天」却还没有当天数据时自动放宽到近七天，避免打开就是空页面
        if (!list.length && scope.value === 'today' && !kw && cat.value === 'all') return items.value;
        return list;
      });

      var groups = computed(function () {
        var map = {};
        var order = [];
        filtered.value.forEach(function (i) {
          var k = dayKey(i.publishedAt);
          if (!map[k]) { map[k] = { key: k, label: dayLabel(i.publishedAt), items: [] }; order.push(k); }
          map[k].items.push(i);
        });
        return order.map(function (k) { return map[k]; });
      });

      var tabs = computed(function () {
        return [
          { key: 'feed', label: '精选', count: items.value.length },
          { key: 'topics', label: '热点榜', count: topics.value.length },
          { key: 'daily', label: 'AI 日报', count: daily.value ? 1 : 0 }
        ];
      });

      /* 「/」唤起搜索（不在输入框里时） */
      onMounted(function () {
        window.addEventListener('keydown', function (e) {
          if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
          var tag = (e.target && e.target.tagName) || '';
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          if (kwInput.value && kwInput.value.focus) { e.preventDefault(); kwInput.value.focus(); }
        });
      });

      return {
        theme: theme, toggleTheme: toggleTheme,
        loading: loading, hasData: hasData,
        items: items, topics: topics, daily: daily,
        todayCount: todayCount, updatedLabel: updatedLabel,
        dateBig: dateBig, weekLabel: weekLabel,
        tab: tab, tabs: tabs, keyword: keyword, scope: scope, cat: cat,
        kwInput: kwInput, categories: categories, filtered: filtered, groups: groups,
        fmtTime: fmtTime, relTime: relTime, shortName: shortName,
        catLabel: function (k) { return CAT_LABEL[k] || '其它'; }
      };
    }
  });

  app.mount('#weekly-app');
})();
