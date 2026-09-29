/**
 * ============================================================================
 *  skill-page.js —— Skill 入口页（skill.html）逻辑层
 * ============================================================================
 *  页面只有一张概览入口卡，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 概览卡整卡可点，跳转到完整指南页 skill-doc.html（卡内 <a> 由自身接管）
 *  完整指南页的指令复制在 skill-doc.js 里。
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[skill] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';
  var DOC_URL = 'skill-doc.html';

  var app = VueNS.createApp({
    setup: function () {
      var ref = VueNS.ref;

      /* ---------------- 主题（与全站保持一致） ---------------- */
      var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      document.body.setAttribute('arco-theme', theme.value);
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', theme.value === 'dark');
        document.body.setAttribute('arco-theme', theme.value);
        try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
      }

      /* ---------------- 概览卡跳转 ---------------- */
      // 整卡可点；卡内 <a>（开源仓库 / 完整指南链接）由自身接管
      function goDoc(e) {
        if (e && e.target && e.target.closest && e.target.closest('a')) return;
        location.href = DOC_URL;
      }

      return {
        theme: theme, toggleTheme: toggleTheme,
        goDoc: goDoc
      };
    }
  });

  app.mount('#skill-app');
})();
