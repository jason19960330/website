/**
 * ============================================================================
 *  agent-autoloop-doc.js —— Agent Autoloop 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[agent-autoloop-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    receipt:
      '订单已经核对完毕，库存充足。\n' +
      '\n' +
      '```agent-autoloop\n' +
      '{\n' +
      '  "ask": [{\n' +
      '    "title": "怎么发货？",\n' +
      '    "text": "两种方式今天都能发出。",\n' +
      '    "options": ["快递", "自提"],\n' +
      '    "key": "shipping"\n' +
      '  }]\n' +
      '}\n' +
      '```\n' +
      '\n' +
      '# 回执写在 Agent 最后一条回复的末尾；中台收下后这一轮就退出，不占进程等回答。',
    install:
      '# macOS / Linux（登录后常驻服务）\n' +
      'curl -fsSL https://raw.githubusercontent.com/KKKKhazix/agent-autoloop/main/install.sh | sh\n' +
      '\n' +
      '# Windows PowerShell\n' +
      'irm https://raw.githubusercontent.com/KKKKhazix/agent-autoloop/main/install.ps1 | iex\n' +
      '\n' +
      '# 验证：先体检，再用本机 Agent 真实走一遍问答\n' +
      'agent-autoloop --version\n' +
      'agent-autoloop doctor\n' +
      'agent-autoloop try\n' +
      '\n' +
      '# 非交互终端里回答卡片 #1 的第 2 项，然后看它接着干完\n' +
      'agent-autoloop answer 1 2\n' +
      'agent-autoloop status\n' +
      '\n' +
      '# 前提：Node.js 24+、Git、一个已登录的命令行 Agent；Unix 另需 curl\n' +
      '# 临时环境 / CI 加 --no-service；卸载：agent-autoloop uninstall',
    rules:
      '# ~/.agent-autoloop/rules.json\n' +
      '{\n' +
      '  "rules": [\n' +
      '    { "name": "早报",\n' +
      '      "when": { "cron": "0 9 * * *" },\n' +
      '      "to": "codex", "cwd": "~/notes",\n' +
      '      "prompt": "整理昨天的笔记和提交，写今天的早报。" },\n' +
      '    { "name": "处理 issue",\n' +
      '      "when": { "source": "github", "types": ["issues.opened"] },\n' +
      '      "to": "codex", "cwd": "~/code/app",\n' +
      '      "skill": "handle-issue", "parallel": 3 }\n' +
      '  ]\n' +
      '}\n' +
      '\n' +
      '# 常用命令（保存后几秒自动生效，写错了继续按旧规则跑）\n' +
      'agent-autoloop check                 # 校验规则\n' +
      'agent-autoloop check 草稿.json       # 只验草稿，不碰正在跑的中台\n' +
      'agent-autoloop rules explain         # 看生效规则与下次定时\n' +
      'agent-autoloop emit issues.opened --dry-run   # 预演派给谁\n' +
      'agent-autoloop pause 早报           # 暂停（可加 --until 定时恢复）\n' +
      'agent-autoloop resume 早报 / agent-autoloop run 早报',
    agents:
      '# 任何「能收提示词并打印最后一条回复」的 CLI 都能接（写进 rules.json 的 agents）\n' +
      '"hermes": { "name": "Hermes", "worker": "my-mac", "use": "command",\n' +
      '            "command": ["hermes", "chat", "-Q", "-q", "{prompt}"] }\n' +
      '\n' +
      '# README 整理的其他接入命令（作者注明：部分尚未逐个实测）\n' +
      'dsh --profile headless {prompt}       # DeepSeek Harness（0.2.2+）\n' +
      'codebuddy -p {prompt}                # WorkBuddy / CodeBuddy\n' +
      'pi --print {prompt}                  # pi\n' +
      'openclaw agent exec {prompt}         # OpenClaw\n' +
      'agent -p --trust {prompt}            # Cursor CLI\n' +
      '\n' +
      '# 会说 ACP 的 Agent（支持会话新建与恢复）\n' +
      'use: "acp", command: ["gemini", "--acp"]    # Gemini CLI\n' +
      'use: "acp", command: ["opencode", "acp"]    # OpenCode\n' +
      '\n' +
      '# 第三方插件：仓库根目录放 agent.ts / channel.ts / source.ts\n' +
      'agent-autoloop add <git 地址>\n' +
      '\n' +
      '# 注意：{prompt} 作为独立参数传递，不会被当成 shell 代码执行'
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
