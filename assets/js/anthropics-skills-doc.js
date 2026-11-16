/**
 * ============================================================================
 *  anthropics-skills-doc.js —— Anthropic Agent Skills 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[anthropics-skills-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    catalog:
      '# Anthropic Agent Skills —— 19 个 Skill / 5 个插件包\n' +
      '# 插件包（.claude-plugin/marketplace.json）\n' +
      '#   document-skills       4 个   xlsx / docx / pptx / pdf\n' +
      '#   example-skills       12 个   见下方分组\n' +
      '#   claude-api            1 个   Claude API 与 SDK 参考\n' +
      '#   academy-guide         1 个   推荐 Claude Academy 课程\n' +
      '#   discernment-nudge     1 个   回答后追加 2-3 个追问\n' +
      '#\n' +
      '# 文档处理（生产级，Claude 文件能力的底层实现）\n' +
      '#   xlsx    表格读写 / 公式 / 图表 / 格式清洗\n' +
      '#   docx    Word 创建与编辑（目录、修订、批注、套模板）\n' +
      '#   pptx    演示创建与解析（母版、备注、合并拆分）\n' +
      '#   pdf     提取 / 合并 / 拆分 / 表单 / 水印 / OCR\n' +
      '#\n' +
      '# 创意与设计（6）\n' +
      '#   algorithmic-art       p5.js 生成艺术，带种子随机与参数探索\n' +
      '#   brand-guidelines      Anthropic 官方品牌色与字体\n' +
      '#   canvas-design         海报 / 静态视觉，输出 PNG 与 PDF\n' +
      '#   frontend-design       界面视觉方向、排版与去模板化\n' +
      '#   slack-gif-creator     Slack 动画 GIF（含约束与校验工具）\n' +
      '#   theme-factory         10 套预设主题，也能现场生成\n' +
      '#\n' +
      '# 开发与技术（4）\n' +
      '#   mcp-builder            MCP Server（FastMCP / MCP SDK）\n' +
      '#   web-artifacts-builder  复杂 HTML artifact（React + Tailwind + shadcn）\n' +
      '#   webapp-testing         Playwright 本地 Web 应用测试与截图\n' +
      '#   claude-api             API / SDK 参考，617 行约 10 万字符\n' +
      '#\n' +
      '# 写作与引导（5）\n' +
      '#   skill-creator          造技能 / 对照评测 / description 优化\n' +
      '#   doc-coauthoring        结构化文档共创流程\n' +
      '#   internal-comms         周报 / 事故 / 更新 / FAQ 模板\n' +
      '#   academy-guide          课程与教程推荐（回答用法类问题时）\n' +
      '#   discernment-nudge      事实核查式追问（每轮对话至多一次）\n' +
      '#\n' +
      '# 仓库规模：544 个路径；canvas-design 带 84 个文件（含字体）；\n' +
      '# claude-api 单份 SKILL.md 105119 字符，pptx 272 行、28170 字符',
    frontmatter:
      '# SKILL.md 最小可用版本（文件名固定，放在同名文件夹里）\n' +
      '---\n' +
      'name: my-skill-name\n' +
      'description: 说清这个技能做什么、什么时候该用，并带上利于触发的关键词。\n' +
      '---\n' +
      '\n' +
      '# My Skill Name\n' +
      '\n' +
      '## 步骤\n' +
      '1. 先确认输入，再执行……\n' +
      '2. 输出结果前自检……\n' +
      '\n' +
      '## 示例\n' +
      '- 输入：……  输出：……\n' +
      '\n' +
      '# 字段约束（agentskills.io/specification）\n' +
      '#   name         必填，1-64 字符，小写字母 / 数字 / 连字符，\n' +
      '#                不以连字符开头结尾、不含连续连字符、须与目录同名\n' +
      '#   description  必填，1-1024 字符，写清「做什么」+「何时用」+ 触发关键词\n' +
      '#   license      可选，简短协议名或随包 LICENSE 文件\n' +
      '#   compatibility 可选，≤500 字符，说明环境要求（多数技能不需要）\n' +
      '#   metadata     可选，string -> string 的任意键值映射\n' +
      '#   allowed-tools 可选，空格分隔的预授权工具，实验性、各实现支持不同\n' +
      '#\n' +
      '# 正文建议 < 500 行 / < 5000 tokens；细节拆到 scripts / references / assets',
    install:
      '# Claude Code：把仓库注册为插件市场，再按包安装\n' +
      '/plugin marketplace add anthropics/skills\n' +
      '/plugin install document-skills@anthropic-agent-skills\n' +
      '/plugin install example-skills@anthropic-agent-skills\n' +
      '# 装完直接提需求，例如：\n' +
      '# Use the PDF skill to extract the form fields from path/to/form.pdf\n' +
      '\n' +
      '# 也可以先 Browse and install plugins -> anthropic-agent-skills\n' +
      '# -> 选 document-skills 或 example-skills -> Install now\n' +
      '\n' +
      '# Claude.ai：付费计划已内置这些示例技能，设置里也能上传自定义技能\n' +
      '# https://support.claude.com/en/articles/12512180-using-skills-in-claude\n' +
      '\n' +
      '# Claude API：Anthropic 预置技能 + 上传自定义技能\n' +
      '# https://docs.claude.com/en/api/skills-guide\n' +
      '\n' +
      '# 规范正文（本仓库 spec/ 只有一句指路）\n' +
      '# https://agentskills.io/specification\n' +
      '# 本地查阅：skills/（19 个范例）、template/SKILL.md（3 行模板）',
    create:
      '# 目录结构：只有 SKILL.md 必需，其余按需添加\n' +
      'my-skill-name/\n' +
      '├── SKILL.md          # frontmatter + 指令（建议 < 500 行）\n' +
      '├── scripts/          # 可执行脚本，不读进上下文也能跑\n' +
      '├── references/       # 按需读取的文档，引用保持一层深\n' +
      '└── assets/           # 模板 / 图片 / 字体等产出用资源\n' +
      '\n' +
      '# 校验 frontmatter 与命名（agentskills 的参考实现）\n' +
      'skills-ref validate ./my-skill-name\n' +
      '\n' +
      '# 用 skill-creator 起评测工作区（与技能目录同级）\n' +
      '# my-skill-name-workspace/iteration-1/eval-0/with_skill/outputs/\n' +
      '# my-skill-name-workspace/iteration-1/eval-0/without_skill/outputs/\n' +
      '# 同一轮同时启动「带技能」和「不带技能」两组做对照\n' +
      '\n' +
      '# description 触发用例：20 条，8-10 条应触发 + 8-10 条近似误触\n' +
      '# [{"query": "用户会真的打出来的原话", "should_trigger": true},\n' +
      '#  {"query": "关键词相近但应该走别的工具", "should_trigger": false}]\n' +
      '\n' +
      '# 迭代：应用改进 -> 重跑全部用例到 iteration-N+1 -> 人工看 eval-viewer\n' +
      '# -> 读反馈再改，直到用户满意 / 反馈为空 / 不再有明显提升'
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
