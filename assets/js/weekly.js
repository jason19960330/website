/**
 * ============================================================================
 *  weekly.js —— 周刊归档页逻辑层
 * ============================================================================
 *  数据来源（均由 tools/sync_weekly.py 生成）：
 *    window.WEEKLY_INDEX   全量索引：期号 / 标题 / 年月，用于搜索
 *    window.WEEKLY_LATEST  最近 N 期正文：封面 / 导语 / 长话题 / 分章节条目
 *
 *  职责：
 *    1. 深浅主题（与首页共用 localStorage 键 site.theme）
 *    2. 全量搜索：按期号和标题过滤
 *    3. 折叠展开：每一期用 Arco Collapse 承载
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var ARCO = window.ArcoVue;
  var INDEX = window.WEEKLY_INDEX || { issues: [] };
  var LATEST = window.WEEKLY_LATEST || { issues: [] };

  if (!VueNS) { console.error('[weekly] 未找到 Vue，请确认 vendor/vue.global.prod.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

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

      /* ---------------- 搜索 ---------------- */
      var query = ref('');
      var hits = computed(function () {
        var q = query.value.trim().toLowerCase();
        if (!q) return [];
        return INDEX.issues.filter(function (it) {
          return String(it.n).indexOf(q) > -1 || it.title.toLowerCase().indexOf(q) > -1;
        }).slice(0, 40);
      });

      /* ---------------- 折叠面板 ---------------- */
      // 默认展开最新一期，其余折叠，避免一屏太长
      var openKeys = ref(LATEST.issues.length ? [String(LATEST.issues[0].n)] : []);
      function toggleAll() {
        openKeys.value = openKeys.value.length ? [] : LATEST.issues.map(function (i) { return String(i.n); });
      }

      function host(u) {
        try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
      }
      function ghDoc(n) {
        return 'https://github.com/ruanyf/weekly/blob/master/docs/issue-' + n + '.md';
      }
      function countOf(it) {
        return it.sections.reduce(function (a, s) { return a + s.items.length; }, 0);
      }

      return {
        index: INDEX, latest: LATEST,
        theme: theme, toggleTheme: toggleTheme,
        query: query, hits: hits,
        openKeys: openKeys, toggleAll: toggleAll,
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
      'a-empty': 'Empty', 'a-link': 'Link', 'a-tooltip': 'Tooltip', 'a-card': 'Card'
    };
    Object.keys(aliasMap).forEach(function (alias) {
      var comp = ARCO[aliasMap[alias]];
      if (comp) app.component(alias, comp);
    });
  } else {
    console.error('[weekly] 未找到 ArcoVue，请确认 vendor/arco-vue.min.js 已加载。');
  }

  app.mount('#weekly-app');
})();
