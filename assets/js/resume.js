/**
 * ============================================================================
 *  resume.js —— 简历页逻辑层
 * ============================================================================
 *  只做三件事：
 *    1. 深浅主题切换（与首页共用 localStorage 键 site.theme）
 *    2. 打印 / 存为 PDF（走浏览器原生打印，样式由 style.css 的 @media print 段负责）
 *    3. Arco 组件别名注册（UMD 导出名无 a- 前缀）
 *  内容全部来自 data.js，与首页同源，改一次两处同步生效。
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var ARCO = window.ArcoVue;
  var CONFIG = window.SITE_CONFIG;
  if (!VueNS) { console.error('[resume] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }
  if (!CONFIG) { console.error('[resume] 未找到 SITE_CONFIG，请确认 assets/js/data.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  var app = VueNS.createApp({
    setup: function () {
      var meta = CONFIG.meta;
      var theme = VueNS.ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

      function applyTheme(next) {
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.body.setAttribute('arco-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 隐私模式忽略 */ }
      }
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        applyTheme(theme.value);
      }
      function doPrint() {
        // 等一帧，确保主题切换等样式变更已落地再唤起打印
        window.requestAnimationFrame(function () { window.print(); });
      }
      function levelLabel(level) {
        if (level >= 90) return '精通';
        if (level >= 80) return '熟练';
        if (level >= 65) return '熟悉';
        return '了解';
      }

      // 技能条配色（与首页 app.js 保持一致的一组色板）
      var BAR_COLORS = {
        sky:     { line: '#0ea5e9', soft: 'rgba(14,165,233,.16)' },
        indigo:  { line: '#6366f1', soft: 'rgba(99,102,241,.16)' },
        emerald: { line: '#10b981', soft: 'rgba(16,185,129,.16)' },
        amber:   { line: '#f59e0b', soft: 'rgba(245,158,11,.16)' },
        violet:  { line: '#8b5cf6', soft: 'rgba(139,92,246,.16)' },
        rose:    { line: '#f43f5e', soft: 'rgba(244,63,94,.16)' }
      };
      function barColor(name) { return BAR_COLORS[name] || BAR_COLORS.sky; }

      VueNS.onMounted(function () { applyTheme(theme.value); });

      return {
        meta: meta,
        stats: CONFIG.stats,
        strengths: CONFIG.strengths,
        timeline: CONFIG.timeline,
        projects: CONFIG.projects,
        education: CONFIG.education,
        honors: CONFIG.honors,
        skillGroups: CONFIG.skillGroups,
        toolStack: CONFIG.toolStack,
        theme: theme, toggleTheme: toggleTheme,
        doPrint: doPrint, levelLabel: levelLabel, barColor: barColor
      };
    }
  });

  /* ================= Arco 组件注册 ================= */
  if (ARCO) {
    app.use(ARCO);
    var aliasMap = {
      'a-button': 'Button', 'a-tag': 'Tag', 'a-divider': 'Divider',
      'a-avatar': 'Avatar', 'a-tooltip': 'Tooltip'
    };
    Object.keys(aliasMap).forEach(function (alias) {
      var comp = ARCO[aliasMap[alias]];
      if (comp) app.component(alias, comp);
    });
  } else {
    console.error('[resume] 未找到 ArcoVue，请确认 vendor/arco-bundle.js 已加载。');
  }

  app.mount('#resume-app');
})();
