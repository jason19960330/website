/**
 * ============================================================================
 *  answer-me-with-html-doc.js —— Answer me with HTML 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[answer-me-with-html-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 指令文本 ---------------- */
  var TEXTS = {
    install:
      '# 一条命令装到你的 Agent（安装器支持 70+ 种，会问你装到哪个）\n' +
      'npx -y skills add QingYunA/answer-me-with-html\n' +
      '\n' +
      '# Claude Code 插件方式\n' +
      '/plugin marketplace add QingYunA/answer-me-with-html\n' +
      '/plugin install answer-me-with-html@answer-me-with-html\n' +
      '\n' +
      '# DeepSeek Harness 插件方式（自带 web profile）\n' +
      'dsh plugin --profile web add github:QingYunA/answer-me-with-html\n' +
      '\n' +
      '# 前提：本机需 Node.js 20+，CLI 已打包在 skill 里，无需 npm install',
    am:
      '# 渲染一页（稿件是扩展 Markdown，组件用 ```flow / ```sequence 等围栏块）\n' +
      'am render 稿件.md\n' +
      '\n' +
      '# 解释视频（3Blue1Brown 风格，图随旁白逐步绘制，配音内嵌）\n' +
      'am video 稿件.md\n' +
      '\n' +
      '# 配置（open 自动开浏览器 / theme / mode 亮暗 / style 写作检查 / scale 字号）\n' +
      'am config            # 查看\n' +
      'am config set open off   # 关闭自动弹浏览器\n' +
      'am config reset     # 恢复默认\n' +
      '\n' +
      '# 高频模式下的页面会堆在 ~/.answer-me-with-html/，定期清理\n' +
      'am clean'
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
