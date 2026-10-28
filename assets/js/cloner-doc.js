/**
 * ============================================================================
 *  cloner-doc.js —— AI Website Cloner 使用指南页（cloner-doc.html）逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[cloner-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 指令文本 ---------------- */
  var TEXTS = {
    setup:
      'Set up https://github.com/JCodesMore/ai-website-cloner-template\n' +
      'as a standalone project in a new folder on my computer.\n' +
      'Ask me where to put it. Clone the repository, remove its origin remote,\n' +
      'install dependencies, and run npm run check. Leave it ready for me\n' +
      'to clone a website.\n' +
      '\n' +
      '# 需要：Node.js 24+ 与一个受支持的编码智能体（Claude Code / Codex / OpenCode / Cursor）',
    clone:
      '# Claude Code 里（推荐，走命令桥）：\n' +
      '/clone-website https://example.com\n' +
      '\n' +
      '# 或者直接用自然语言下给任意受支持的 Agent：\n' +
      '请按 .agents/skills/clone-website/ 里的工作流，\n' +
      '把 https://example.com 克隆成本项目里的一个新页面。\n' +
      '# 同源多页直接并列给出：/clone-website <url1> <url2> ...',
    check:
      '# 日常验证三连：\n' +
      'npm run dev      # 打开 http://localhost:3000，与源站同视口对照\n' +
      'npm run lint     # ESLint 检查\n' +
      'npm run typecheck  # TypeScript 严格检查\n' +
      '\n' +
      '# 交付前必须全绿：\n' +
      'npm run check    # lint + typecheck + build\n' +
      '\n' +
      '# 不想装 Node.js 也可以用 Docker：\n' +
      'docker compose up dev --build   # 开发模式，端口 3001\n' +
      'docker compose up app --build   # 生产构建并运行'
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

      /* ---------------- 复制命令 ---------------- */
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

  app.mount('#skill-app');
})();
