/**
 * ============================================================================
 *  archive.js —— 「更早的日常」归档页逻辑层
 * ============================================================================
 *  独立挂载 #archive-app，不依赖首页 app.js。
 *  归档条目由 tools/generate-life.mjs 从 content/life.md 自动切分：
 *  非占位记录按 md 书写顺序，前 3 条给首页，第 4 条起全部留在这里。
 *  本文件只负责主题切换与挂载，不存放任何内容。
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var CONFIG = window.SITE_CONFIG;
  if (!VueNS) { console.error('[archive] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }
  if (!CONFIG) { console.error('[archive] 未找到 SITE_CONFIG，请确认 assets/js/data.js 已加载。'); return; }
  if (!CONFIG.archive) { console.error('[archive] 未找到 SITE_CONFIG.archive，请运行 npm run life 生成。'); return; }

  var ref = VueNS.ref;
  var THEME_KEY = 'site.theme';
  var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme.value === 'dark');
    document.body.setAttribute('arco-theme', theme.value === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
  }

  VueNS.createApp({
    setup: function () {
      return {
        meta: CONFIG.meta,
        archive: CONFIG.archive,
        theme: theme,
        toggleTheme: toggleTheme,
        year: new Date().getFullYear()
      };
    }
  }).mount('#archive-app');
})();
