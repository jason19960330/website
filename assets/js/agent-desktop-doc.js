/**
 * ============================================================================
 *  agent-desktop-doc.js —— Agent Desktop 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[agent-desktop-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    install:
      '# 安装（前置：Node.js 18 或更新）\n' +
      'npm install -g agent-desktop\n' +
      '# macOS / Linux 也可以用 Homebrew 默认目录\n' +
      'brew install agent-desktop\n' +
      '\n' +
      '# 体检：平台、权限、supported_surfaces\n' +
      'agent-desktop status\n' +
      'agent-desktop version\n' +
      '\n' +
      '# 首次使用前，让 Agent 读随二进制发布的指南\n' +
      'agent-desktop skills get desktop\n' +
      'agent-desktop skills get platform\n' +
      '\n' +
      '# macOS 引导辅助功能授权，然后第一次观察\n' +
      'agent-desktop permissions --guide\n' +
      'agent-desktop snapshot --app Finder -i\n' +
      '\n' +
      '# PowerShell 里每个 ref 都要加引号：agent-desktop click \'@s8f3k2p9:e8\'\n' +
      '# npm 12 拦了 postinstall 时：npm install -g agent-desktop --allow-scripts=agent-desktop',
    loop:
      '# ① 画浅图：三层结构，被截断的分支带 children_count\n' +
      'agent-desktop snapshot --skeleton --app "Notes" -i --compact\n' +
      '\n' +
      '# ② 下钻某个区域：新 ref 仍属于同一个 snapshot id\n' +
      'agent-desktop snapshot --root @s8f3k2p9:e3 -i --compact\n' +
      '\n' +
      '# ③ 动作：ref 必须带快照前缀，裸 @eN 会返回 INVALID_ARGS\n' +
      'agent-desktop click @s8f3k2p9:e12\n' +
      '\n' +
      '# ④ 验证：等真实状态，别用固定 sleep 碰运气\n' +
      'agent-desktop wait --element @s8f3k2p9:e6 --predicate value --value 7 --timeout 5000\n' +
      'agent-desktop get @s8f3k2p9:e6 --property value\n' +
      '\n' +
      '# ok: true 只代表命令返回了结果，效果要靠这一轮重新观察来确认\n' +
      '# 只有 disposition.retry 为 safe 时才允许重试或替换动作',
    mcp:
      '# 随二进制发布的 Skills（永远与版本一致）\n' +
      'agent-desktop skills get desktop | jq -r \'.data.content\'\n' +
      'agent-desktop skills get platform\n' +
      'agent-desktop skills get desktop workflows\n' +
      '\n' +
      '# 装一份静态副本到支持 skills 的 Agent harness\n' +
      'npx skills add https://github.com/vercel-labs/agent-desktop --skill agent-desktop\n' +
      '\n' +
      '# MCP：写进客户端的 mcpServers 配置\n' +
      '{\n' +
      '  "mcpServers": {\n' +
      '    "agent-desktop": { "command": "agent-desktop", "args": ["mcp"] }\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      '# 全局 flag 只能在启动 server 时给，单个 tool 传不了\n' +
      'agent-desktop mcp --session s1 --headed\n' +
      '\n' +
      '# 或写进 AGENTS.md：\n' +
      '# Use agent-desktop to see and operate desktop apps. Before the first use,\n' +
      '# run "agent-desktop skills get desktop" and "agent-desktop skills get platform".',
    contract:
      '# 成功 envelope（输入已派发，效果尚未确认）\n' +
      '{\n' +
      '  "version": "2.6", "ok": true, "command": "click",\n' +
      '  "data": { "action": "click",\n' +
      '    "disposition": { "delivery": "delivered_unverified", "retry": "unsafe" } }\n' +
      '}\n' +
      '\n' +
      '# 错误 envelope（带 recovery 时说明这一下确实没送到）\n' +
      '{\n' +
      '  "version": "2.6", "ok": false, "command": "click",\n' +
      '  "error": { "code": "STALE_REF", "message": "...",\n' +
      '    "recovery": { "strategy": "refresh_snapshot_then_retry_original",\n' +
      '      "retryable": true, "requires_fresh_snapshot": true },\n' +
      '    "disposition": { "delivery": "not_delivered", "retry": "safe" } }\n' +
      '}\n' +
      '\n' +
      '# 判断是否重试的顺序\n' +
      '# 1. 读 error.code：INVALID_ARGS / ACTION_NOT_SUPPORTED / PERM_DENIED 改输入或环境即可\n' +
      '# 2. 读 error.disposition.retry：unsafe / unknown 先重新观察界面再决定\n' +
      '# 3. retry 为 safe 且有 recovery：照 strategy 走（多为重新取快照 + 新 ref）\n' +
      '# 4. retry 为 safe 但无 recovery：先修掉原因，再用 find 拿到的新 ref 重试\n' +
      '\n' +
      '# 退出码：0 成功 / 1 结构化错误 / 2 命令行解析错误\n' +
      '# 永远按 code 与 disposition 分支，不要按 message 或 suggestion 分支'
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
