/**
 * ============================================================================
 *  weekly.js —— 热点站框架说明页（weekly.html）逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[weekly] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的指令文本 ---------------- */
  var TEXTS = {
    run: 'git clone <开源热点站框架仓库地址> myhot\n' +
      'cd myhot\n' +
      'node scripts/init-env.ts --llm-key <你的模型 API Key>\n' +
      'docker compose up -d --build',
    own: '请读 AGENTS.md 和 customize 文档，把这个站改成「XX 行业」的热点站。\n' +
      '我关心的是：……（写你想盯的信源、你觉得什么消息重要、什么不重要，越具体越好）。\n' +
      '改完帮我跑 npm run typecheck、npm test 和 node scripts/smoke.ts，\n' +
      '并告诉我还需要我自己决定哪些事。',
    eval: 'node --env-file=.env scripts/eval-selection.ts \\\n' +
      '  --gold .data/gold.jsonl \\\n' +
      '  --split development \\\n' +
      '  --label "第一版评分标准"'
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

  app.mount('#weekly-app');
})();
