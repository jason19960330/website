/**
 * ============================================================================
 *  weekly.js —— 周刊归档页逻辑层（Arco Design 版式）
 * ============================================================================
 *  数据来源（均由 tools/sync_weekly.py 生成）：
 *    window.WEEKLY_INDEX   全量索引：期号 / 标题 / 年月，用于搜索
 *    window.WEEKLY_LATEST  最近 N 期正文：封面 / 导语 / 长话题 / 分章节条目
 *
 *  职责：
 *    1. 深浅主题（与首页共用 localStorage 键 site.theme）
 *    2. 全量搜索：按期号和标题过滤
 *    3. 年份筛选 + 排序 + 「加载更多」分页
 *    4. 折叠展开：每一期用 Arco Collapse 承载
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var ARCO = window.ArcoVue;
  var INDEX = window.WEEKLY_INDEX || { issues: [], total: 0 };
  var LATEST = window.WEEKLY_LATEST || { issues: [], count: 0, updated: '' };

  if (!VueNS) { console.error('[weekly] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';
  var PAGE_SIZE = 8;   // 首屏先给 8 期，其余「加载更多」
  // ?all=1 时一次性列出全部期数：tools/prerender.mjs 用它生成 SEO 快照，
  // 否则爬虫只能抓到前 8 期（真实用户访问不会带这个参数）
  var ALL_FOR_SEO = /[?&]all=1/.test(window.location.search);

  var app = VueNS.createApp({
    setup: function () {
      var ref = VueNS.ref, computed = VueNS.computed;

      /* ---------------- 主题（与首页保持一致） ---------------- */
      var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      document.body.setAttribute('arco-theme', theme.value);
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', theme.value === 'dark');
        document.body.setAttribute('arco-theme', theme.value);
        try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
      }

      /* ---------------- 概览数字 ---------------- */
      // 本地收录的全部条目数（各章节条目求和），给概览条用
      var totalItems = computed(function () {
        return LATEST.issues.reduce(function (sum, it) {
          return sum + (it.sections || []).reduce(function (a, s) { return a + s.items.length; }, 0);
        }, 0);
      });
      // 最近同步只取日期部分（2026-09-23 06:09 → 2026-09-23）
      var shortDate = computed(function () {
        return (LATEST.updated || '').split(' ')[0];
      });

      /* ---------------- 搜索（全量 413 期） ---------------- */
      var query = ref('');
      var hits = computed(function () {
        var q = query.value.trim().toLowerCase();
        if (!q) return [];
        return INDEX.issues.filter(function (it) {
          return String(it.n).indexOf(q) > -1 || it.title.toLowerCase().indexOf(q) > -1;
        }).slice(0, 40);
      });
      function clearQuery() { query.value = ''; }

      /* ---------------- 年份筛选 + 排序 + 分页 ---------------- */
      var years = computed(function () {
        var set = {};
        LATEST.issues.forEach(function (it) { set[String(it.ym).slice(0, 4)] = 1; });
        return Object.keys(set).sort(function (a, b) { return b - a; });
      });
      var year = ref('all');
      var sort = ref('desc');           // desc = 最新在前
      var limit = ref(ALL_FOR_SEO ? Number.MAX_SAFE_INTEGER : PAGE_SIZE);

      var filtered = computed(function () {
        var list = LATEST.issues.slice();
        if (year.value !== 'all') {
          list = list.filter(function (it) { return String(it.ym).slice(0, 4) === year.value; });
        }
        list.sort(function (a, b) {
          return sort.value === 'desc' ? Number(b.n) - Number(a.n) : Number(a.n) - Number(b.n);
        });
        return list;
      });
      var shown = computed(function () { return filtered.value.slice(0, limit.value); });
      var hasMore = computed(function () { return filtered.value.length > limit.value; });

      function loadMore() { limit.value += PAGE_SIZE; }
      function resetLimit() { limit.value = ALL_FOR_SEO ? Number.MAX_SAFE_INTEGER : PAGE_SIZE; }
      function pickYear(y) { year.value = y; resetLimit(); }
      function toggleSort() { sort.value = sort.value === 'desc' ? 'asc' : 'desc'; }

      /* ---------------- 折叠面板 ---------------- */
      // 默认展开最新一期，其余折叠，避免一屏太长
      var openKeys = ref(LATEST.issues.length ? [String(LATEST.issues[0].n)] : []);
      var allOpen = computed(function () {
        return shown.value.length > 0 && openKeys.value.length >= shown.value.length;
      });
      function toggleAll() {
        openKeys.value = allOpen.value ? [] : shown.value.map(function (i) { return String(i.n); });
      }
      function isNewest(it) {
        return LATEST.issues.length > 0 && Number(it.n) === Number(LATEST.issues[0].n);
      }

      /* ---------------- 工具 ---------------- */
      function host(u) {
        try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
      }
      function ghDoc(n) {
        return 'https://github.com/ruanyf/weekly/blob/master/docs/issue-' + n + '.md';
      }
      function countOf(it) {
        return (it.sections || []).reduce(function (a, s) { return a + s.items.length; }, 0);
      }

      return {
        index: INDEX, latest: LATEST,
        theme: theme, toggleTheme: toggleTheme,
        totalItems: totalItems, shortDate: shortDate,
        query: query, hits: hits, clearQuery: clearQuery,
        years: years, year: year, pickYear: pickYear,
        sort: sort, toggleSort: toggleSort, resetLimit: resetLimit,
        shown: shown, filtered: filtered, hasMore: hasMore, loadMore: loadMore,
        openKeys: openKeys, toggleAll: toggleAll, allOpen: allOpen, isNewest: isNewest,
        host: host, ghDoc: ghDoc, countOf: countOf
      };
    }
  });

  /* ================= Arco 组件注册（同首页的做法） ================= */
  if (ARCO) {
    app.use(ARCO);
    var aliasMap = {
      'a-button': 'Button', 'a-tag': 'Tag', 'a-input': 'Input', 'a-input-search': 'InputSearch',
      'a-collapse': 'Collapse', 'a-collapse-item': 'CollapseItem', 'a-divider': 'Divider',
      'a-empty': 'Empty', 'a-link': 'Link', 'a-tooltip': 'Tooltip',
      'a-space': 'Space', 'a-radio': 'Radio', 'a-radio-group': 'RadioGroup', 'a-badge': 'Badge'
    };
    Object.keys(aliasMap).forEach(function (alias) {
      var comp = ARCO[aliasMap[alias]];
      if (comp) app.component(alias, comp);
    });
  } else {
    console.error('[weekly] 未找到 ArcoVue，请确认 vendor/arco-bundle.js 已加载。');
  }

  app.mount('#weekly-app');
})();
