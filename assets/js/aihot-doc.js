/**
 * ============================================================================
 *  aihot-doc.js —— AIHOT 开源框架完整指南页（aihot-doc.html）逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[aihot-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 指令文本 ---------------- */
  var TEXTS = {
    run:
      '# 1) 用模板一键生成你自己的仓库（推荐），或先 Fork 再 clone\n' +
      'git clone https://github.com/KKKKhazix/AIHOT.git myhot\n' +
      'cd myhot\n' +
      '\n' +
      '# 2) 生成 .env（默认按 DeepSeek 配置；换千问/智谱照 .env.example 改 LLM_*）\n' +
      'node scripts/init-env.ts --llm-key <你的 OpenAI 兼容模型 API Key>\n' +
      '\n' +
      '# 3) 启动（需要 Docker 与本机 Node.js 24）\n' +
      'docker compose up -d --build\n' +
      '\n' +
      '# 打开 http://localhost:3000  ·  后台 /admin  ·  管理员密码见 .env 的 ADMIN_PASSWORD',
    customize:
      '请读 AGENTS.md 和 docs/customize.md，把这个站改成「XX 行业」的热点站。\n' +
      '我关心的是：……（写你想盯的信源、你觉得什么消息重要、什么不重要，越具体越好）。\n' +
      '改完帮我跑 npm run typecheck、npm test 和 node scripts/smoke.ts，\n' +
      '并告诉我还需要我自己决定哪些事。',
    calibrate:
      '# 1) 从你的信源里挑 100–200 条资料，自己标「该选 / 不该选」，存成 .data/gold.jsonl\n' +
      '\n' +
      '# 2) 跑评测，看准确率 / 查准率 / 查全率与不同门槛下的结果\n' +
      'node --env-file=.env scripts/eval-selection.ts --gold .data/gold.jsonl\n' +
      '\n' +
      '# 3) 在后台 SelectBench 逐条看判错的，回去改 industry/prompts/ 里的评分提示词\n' +
      '    （或 industry/selection.ts 里的门槛），再跑一遍',
    agent:
      '# 站点跑起来后：\n' +
      '#  · 打开 /agent        —— 复制 MCP / RSS / API 的接入方式\n' +
      '#  · 只能读网页的 Agent 从 /api/v1/agent 开始\n' +
      '#  · 接口说明见 /openapi-v1.json，机器可读清单见 /llms.txt\n' +
      '\n' +
      '# 公开只读接口示例（免密钥、允许跨域）：\n' +
      '#   精选   GET https://<你的域名>/api/v1/items?limit=100\n' +
      '#   热点   GET https://<你的域名>/api/v1/hot-topics\n' +
      '#   日报   GET https://<你的域名>/api/v1/dailies/latest'
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
