/**
 * ============================================================================
 *  skill-page.js —— Skill 指南页（skill.html）逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 指令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var ARCO = window.ArcoVue;

  if (!VueNS) { console.error('[skill] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的指令文本 ---------------- */
  var TEXTS = {
    install: 'npx skills add https://github.com/larashero3-dotcom/lieflat-charts --skill lieflat-charts',
    installAlt: 'git clone https://github.com/larashero3-dotcom/lieflat-charts ~/.claude/skills/lieflat-charts',
    article: '用 lieflat-charts 把这份数据做成 4-6 张中文配图，用于公众号长文。\n' +
      '数据：\n' +
      '（粘贴你的数据：CSV、表格或纯文本都行）\n\n' +
      '默认先比较 Lupi Editorial 和 Basics 候选，两组都不适配时再使用 Glance。\n' +
      '每张图只承担一个结论，保留真实单位，同一批图只用一种色系。',
    video: '用 lieflat-charts 把这份数据做成带滚动入场、数字递增和动态排名的 HTML，\n' +
      '我要用浏览器全屏录屏做视频素材（1080x1920 竖屏）。\n' +
      '打开页面即自动播放，不需要点击交互，整套动效控制在 8 秒内。\n\n' +
      '数据：\n' +
      '（粘贴你的数据）',
    report: '基于这份数据，用 lieflat-charts 生成一份完整的中文 HTML 报告。\n' +
      '报告类型：月度运营（版心 1080，中等密度，4 个图表槽位）。\n' +
      '需要组织好标题、核心结论、KPI、图表、旁注和数据来源，可直接发布。\n\n' +
      '数据：\n' +
      '（粘贴你的数据）',
    brand: '这是我参考图的配色逻辑（见附图）：\n' +
      '请只提取颜色关系与明度层次，不要复制原图的构图和图型。\n' +
      '用这套色重做上一批图：图型结构、比例和数据完全不变，\n' +
      '只替换色彩系统，同一批图只用这一套色。'
  };

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

      /* ---------------- 复制指令 ---------------- */
      var copied = ref('');
      var timer = null;

      function fallbackCopy(text) {
        // http 或老旧浏览器下 navigator.clipboard 可能不存在，退回 execCommand
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
        document.body.removeChild(ta);
      }

      function copy(key) {
        var text = TEXTS[key];
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
        copied.value = key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { copied.value = ''; }, 1800);
      }

      return {
        texts: TEXTS,
        theme: theme, toggleTheme: toggleTheme,
        copied: copied, copy: copy
      };
    }
  });

  /* ================= Arco 组件注册（与其他页面一致） ================= */
  if (ARCO) {
    app.use(ARCO);
    var aliasMap = {
      'a-button': 'Button', 'a-tag': 'Tag', 'a-link': 'Link',
      'a-divider': 'Divider', 'a-empty': 'Empty'
    };
    Object.keys(aliasMap).forEach(function (alias) {
      var comp = ARCO[aliasMap[alias]];
      if (comp) app.component(alias, comp);
    });
  }

  app.mount('#skill-app');
})();
