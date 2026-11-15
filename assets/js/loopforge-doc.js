/**
 * ============================================================================
 *  loopforge-doc.js —— LoopForge 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[loopforge-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    deploy:
      '# 平台版前置：Git、Docker、Compose、Python 3、curl（脚本会检查并可补装）\n' +
      'git clone https://github.com/Tencent/LoopForge.git\n' +
      'cd LoopForge\n' +
      './start.sh\n' +
      '\n' +
      '# 直接拉 compose.yaml pin 的 GHCR 发布镜像，不在本地构建\n' +
      '# 国内拉 ghcr.io 常断：设成可替换 ghcr.io 的镜像站主机名\n' +
      'MIRROR=ghcr.nju.edu.cn ./start.sh\n' +
      'MIRROR=ghcr.nju.edu.cn ./start.sh pull\n' +
      '\n' +
      '# 服务管理（默认 0.0.0.0:8090，第一个注册的账号是管理员）\n' +
      './start.sh logs\n' +
      './start.sh stop\n' +
      './start.sh restart\n' +
      './start.sh dev\n' +
      '\n' +
      '# 核对镜像摘要与发布说明是否一致（看 RepoDigests 里 @ 后面的部分）\n' +
      'docker image inspect ghcr.io/tencent/loopforge:<pin>\n' +
      '\n' +
      '# 免 API Key 体验：切到体验项目 → 流程模板 → 平台验收·脚本与审批 → 运行流程\n' +
      '# 脚本生成报告后停在人工关口，到「待我确认」批准，观察流程继续产出最终产物',
    local:
      '# Local 版前置：Node.js 20+、Python 3.8+，在目标项目目录里执行\n' +
      'npx -y loopforge-cli@latest install claude\n' +
      'npx -y loopforge-cli@latest status claude\n' +
      'npx -y loopforge-cli@latest doctor\n' +
      '\n' +
      '# 在 Claude Code 里启动工作流\n' +
      '/start-devflow "为订单列表增加状态筛选，并补充接口测试"\n' +
      '\n' +
      '# Classic 中断后继续（CodeBuddy / Cursor / Claude Code）\n' +
      '/resume-devflow {task_slug}\n' +
      '# Codex 用 $devflow-codex resume {task_slug}\n' +
      '\n' +
      '# 其他宿主：CodeBuddy / Cursor 用 /start-devflow "<需求>"，Codex 用 $devflow-codex "<需求>"\n' +
      '# 一次任务后，需求 / 方案 / 审查 / 测试 / 总结落在 artifacts/{task_slug}/\n' +
      '\n' +
      '# CodeBuddy Classic 内置本地可观测看板（数据聚合与页面服务全在本机）\n' +
      'python3 .codebuddy/skills/agent-observability/scripts/build_dashboard_data.py --project-root .\n' +
      'python3 -m http.server 8765 --directory .codebuddy/skills/agent-observability/scripts/dashboard\n' +
      '# 浏览器打开 http://localhost:8765',
    portable:
      '# Portable Edition：只装基于 Agent Skills 的可移植工作流\n' +
      'npx -y loopforge-cli@latest skills install claude\n' +
      '# Claude Code / CodeBuddy / Cursor / DSH / Hermes → /devflow "<需求>"\n' +
      '# Codex → $devflow "<需求>"          Pi → /skill:devflow "<需求>"\n' +
      '\n' +
      'npx -y loopforge-cli@latest skills install dsh\n' +
      'npx -y loopforge-cli@latest skills install pi && pi install npm:pi-subagents\n' +
      'npx -y loopforge-cli@latest skills install hermes && hermes skills trust .\n' +
      '\n' +
      '# 长期维护：全局装 CLI，先 plan 看会写哪些文件，再更新 / 卸载\n' +
      'npm install --global loopforge-cli\n' +
      'loopforge plan claude\n' +
      'loopforge update claude\n' +
      'loopforge uninstall claude\n' +
      'loopforge skills status claude\n' +
      '# 同一项目同一宿主只能启用一种 Edition，切换需重新安装并加 --force\n' +
      '# 安装状态写在 .devflow/install-state.json，检测到你改过文件会停下而不是覆盖',
    dev:
      '# 参与 LoopForge 本身的开发：Go 1.26.11+\n' +
      'bash scripts/dev.sh\n' +
      'bash scripts/install.sh\n' +
      '\n' +
      '# 已克隆仓库时，从当前源码安装 Local CLI\n' +
      'pipx install ./local\n' +
      '\n' +
      '# 可选工具：腾讯云只读 MCP Initializr（Redis / CDB / TDSQL-C / TKE / CLS / COS）\n' +
      '# 不含在 npm CLI 包里，需克隆仓库后单独启动\n' +
      'cd local/tools/tcmcp\n' +
      '\n' +
      '# 想继续读的文档\n' +
      'docs/deployment.md\n' +
      'docs/conversation-workspaces.md\n' +
      'docs/architecture.md\n' +
      'docs/local/usage.zh-CN.md\n' +
      'docs/validation.md\n' +
      'docs/testing/acceptance-matrix.md'
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
