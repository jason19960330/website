/**
 * ============================================================================
 *  cicada-doc.js —— 知了 Cicada 使用指南页（cicada-doc.html）逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[cicada-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 指令文本 ---------------- */
  var TEXTS = {
    run:
      '# 安装 Xcode 命令行工具（无需完整 Xcode）\n' +
      'xcode-select --install\n' +
      '\n' +
      '# 编译开发版 → build/Cicada.app（可与正式版并存）\n' +
      'scripts/build.sh\n' +
      'open build/Cicada.app\n' +
      '\n' +
      '# 打包正式版 DMG / zip + SHA-256 校验值\n' +
      'scripts/package.sh',
    build:
      '# 在「设置 › AI 服务」里粘贴 Ling key 后，先用一次检查确认可用\n' +
      '# （应用会发一个仅用 1 个 token 的请求验证 key）\n' +
      '\n' +
      '# 连不上 / key 失效时，设置页会逐步提示：\n' +
      '#   1. 是否开了代理\n' +
      '#   2. 代理软件有没有接管「系统代理」\n' +
      '#   3. 开了代理仍不通（应用不会自己改代理）\n' +
      '\n' +
      '# 想换服务：同页面右上角选 OpenRouter / ZenMux / OpenAI\n' +
      '# 或填任意 OpenAI 兼容地址（含本机模型），key 各存一份'
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
