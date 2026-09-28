/**
 * ============================================================================
 *  hotnews-page.js —— 科技热点页逻辑层
 * ============================================================================
 *  数据来源（由 tools/sync_hotnews.py 生成）：
 *    window.HOTNEWS  { updated, source, sources:[{id,name,home,updatedTime,items}] }
 *
 *  职责：
 *    1. 深浅主题（与首页共用 localStorage 键 site.theme）
 *    2. 跨三个源的标题检索
 *    3. 源更新时间的相对显示（刚刚 / N 分钟前 / N 小时前）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var ARCO = window.ArcoVue;
  var HOT = window.HOTNEWS || { sources: [], updated: '' };

  if (!VueNS) { console.error('[hotnews] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';
  var SHOW = 20;   // 每个源最多展示多少条（数据文件也是按这个量抓的）

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
      var sources = HOT.sources || [];
      var totalItems = computed(function () {
        return sources.reduce(function (a, s) { return a + (s.items || []).length; }, 0);
      });
      var shortDate = computed(function () {
        return (HOT.updated || '').split(' ')[0];
      });

      /* ---------------- 检索（跨三个源） ---------------- */
      var query = ref('');
      function match(items) {
        var q = query.value.trim().toLowerCase();
        if (!q) return (items || []).slice(0, SHOW);
        return (items || []).filter(function (it) {
          return String(it.t || '').toLowerCase().indexOf(q) > -1;
        }).slice(0, SHOW);
      }
      function viewOf(src) { return match(src.items); }
      var hitCount = computed(function () {
        return sources.reduce(function (a, s) { return a + match(s.items).length; }, 0);
      });

      /* ---------------- 相对时间 ---------------- */
      function ago(ts) {
        if (!ts) return '未知';
        var diff = Math.floor((Date.now() - Number(ts)) / 1000);
        if (diff < 60) return '刚刚更新';
        if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前更新';
        if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前更新';
        return Math.floor(diff / 86400) + ' 天前更新';
      }

      return {
        hot: HOT, sources: sources,
        theme: theme, toggleTheme: toggleTheme,
        totalItems: totalItems, shortDate: shortDate,
        query: query, viewOf: viewOf, hitCount: hitCount, ago: ago
      };
    }
  });

  /* ================= Arco 组件注册（同首页的做法） ================= */
  if (ARCO) {
    app.use(ARCO);
    var aliasMap = {
      'a-button': 'Button', 'a-tag': 'Tag', 'a-input': 'Input', 'a-input-search': 'InputSearch',
      'a-empty': 'Empty', 'a-link': 'Link', 'a-tooltip': 'Tooltip', 'a-divider': 'Divider'
    };
    Object.keys(aliasMap).forEach(function (alias) {
      var comp = ARCO[aliasMap[alias]];
      if (comp) app.component(alias, comp);
    });
  } else {
    console.error('[hotnews] 未找到 ArcoVue，请确认 vendor/arco-bundle.js 已加载。');
  }

  app.mount('#hot-app');
})();
