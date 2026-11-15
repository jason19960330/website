/**
 * ============================================================================
 *  lanshu-html-ppt-doc.js —— 岚叔 HTML 演示模板 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[lanshu-html-ppt-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    templates:
      '# 30 套模板 ID 速查（每套 10–12 页，共 338 页）\n' +
      '# 经典 / 叙事\n' +
      '#   01-swiss          瑞士国际主义    设计系统 / 商业汇报\n' +
      '#   02-editorial      杂志编辑        趋势报告 / 品牌故事\n' +
      '#   03-aurora         暗夜极光        AI 产品 / 技术发布\n' +
      '#   04-brutalism      新粗野主义      融资路演 / 年轻品牌\n' +
      '#   05-luxury         黑金奢华        高端品牌 / 客户提案\n' +
      '#   06-bauhaus        包豪斯          设计课程 / 创意教育\n' +
      '#   07-consulting     咨询战略        战略汇报 / 董事会材料\n' +
      '#   08-oriental       新中式          文旅策展 / 中式品牌\n' +
      '#   09-organic        北欧自然        ESG 报告 / 可持续\n' +
      '#   10-masterplan     无限画布        战略全景 / 空间叙事\n' +
      '#   11-morph          数据变形叙事    数据报告 / 人群洞察\n' +
      '#   12-generative     生成艺术        艺术展览 / 算法演示\n' +
      '#   13-cinematic      电影片头        品牌纪录 / 活动开场\n' +
      '#   14-live-model     活体演示        情景测算 / 投资评审\n' +
      '#   15-kinetic        动态排版        品牌焕新 / 宣言发布\n' +
      '# 交互 / 实验（21–30 为本次新增 10 套）\n' +
      '#   16-spatial        空间界面        硬件发布 / 概念设计\n' +
      '#   17-terminal       终端即演示      开发者大会 / 开源项目\n' +
      '#   18-riso           孔版印刷        艺术书展 / 独立出版\n' +
      '#   19-collage        桌面拼贴        创意比稿 / 产品故事\n' +
      '#   20-globe          地球仪叙事      出海业务 / 年度报告\n' +
      '#   21-academic       学术答辩        毕业答辩 / 课题汇报\n' +
      '#   22-bento          便当格          产品发布 / 年度总结\n' +
      '#   23-chalkboard     黑板课堂        教学课件 / 科普讲座\n' +
      '#   24-chat           对话叙事        AI 产品 / 用户研究\n' +
      '#   25-pixel          像素闯关        年会 / 团队复盘\n' +
      '#   26-newspaper      报纸头版        年度大事记 / 新闻发布\n' +
      '#   27-blueprint      蓝图工程        工程评审 / 技术架构\n' +
      '#   28-official       政企汇报        年度工作汇报 / 述职\n' +
      '#   29-metro          地铁线路        产品路线图 / 里程碑\n' +
      '#   30-comic          漫画分镜        用户故事 / 培训案例\n' +
      '#\n' +
      '# 选型依据：references/template-catalog.md + catalog.json（含原始文件 SHA-256）\n' +
      '# 23 套源码内置多页打印样式，PDF 效果仍需实测',
    install:
      '# 前置：Python 3.10+，不需要安装任何 Python 第三方依赖\n' +
      'git clone https://github.com/cclank/lanshu-html-ppt-templates.git\n' +
      'cd lanshu-html-ppt-templates\n' +
      'python3 scripts/install.py\n' +
      '# 默认装到 ~/.codex/skills/lanshu-html-ppt-templates\n' +
      '# 设了 CODEX_HOME 时用该目录下的 skills/\n' +
      '\n' +
      '# 给其它支持 SKILL.md 的助手指定技能目录\n' +
      'python3 scripts/install.py --skills-dir /path/to/your/skills\n' +
      '# 安装器只复制 Skill 必需资源，并拒绝覆盖已有目录\n' +
      '# 装完重开助手的新聊天，刷新技能发现\n' +
      '\n' +
      '# 也可以不克隆，直接下载完整包（含原始模板与缩略图）\n' +
      '# https://github.com/cclank/lanshu-html-ppt-templates/releases/latest/download/lanshu-html-ppt-templates.zip\n' +
      '\n' +
      '# 新聊天里的示例提示\n' +
      '# 使用 $lanshu-html-ppt-templates，\n' +
      '# 把下面的内容做成 12 页产品发布演示。\n' +
      '# 受众是企业客户，采用暗夜极光风格，\n' +
      '# 输出单文件 HTML，并写好逐页演讲备注。\n' +
      '# [粘贴你的材料]',
    cli:
      '# 在仓库根目录运行；Python 3.10+，JS 语法校验还需要 Node.js\n' +
      'python3 scripts/deck.py list          # 列出 30 套模板\n' +
      'python3 scripts/deck.py list --pdf    # 只看带多页打印样式的\n' +
      '\n' +
      '# 创建完整副本，不覆盖已有文件\n' +
      'python3 scripts/deck.py new 07-consulting \\\n' +
      '  --output outputs/strategy.html \\\n' +
      '  --title "年度业务战略"\n' +
      '# --title 只改浏览器标题；封面 / 正文 / 图表 / 备注还要继续编辑\n' +
      '\n' +
      'python3 scripts/deck.py source 07-consulting   # 精简源码（只隐藏字体 Base64）\n' +
      'python3 scripts/deck.py inspect outputs/strategy.html   # 结构 / 备注 / 内联 JS\n' +
      'python3 scripts/deck.py validate outputs/strategy.html  # 静态校验\n' +
      '\n' +
      '# 改完文字后联网按实际用字重新裁剪内嵌字体\n' +
      'python3 scripts/embed_fonts.py "我的演示（已编辑）.html"\n' +
      '\n' +
      '# 手机遥控：用本地放映服务打开，浏览器里按 M 扫码\n' +
      'python3 scripts/present.py\n' +
      'python3 scripts/present.py outputs/strategy.html',
    dev:
      '# 无运行时 npm 依赖，不需要 npm install；开发 / 部署建议 Node.js 22+\n' +
      'npm run check     # 校验 30 套资源、页数、备注 JSON 与内联 JS 语法\n' +
      'npm run build     # 生成 dist/ 静态站点 + release/ 完整 ZIP\n' +
      'npm run dev       # 构建后在 http://127.0.0.1:4173 本地预览\n' +
      'npm run release   # 把完整 ZIP 发成 GitHub Release 附件（需已登录 gh）\n' +
      '\n' +
      '# 发布前先按 preview-media.json 校验下载预览素材（不进版本库）\n' +
      'python3 scripts/fetch_previews.py\n' +
      'python3 scripts/deploy.py --dry-run\n' +
      'npm run deploy    # 构建、校验并部署到 Cloudflare Workers Static Assets\n' +
      '\n' +
      '# 改了放映工具包源码后，同步进各模板并更新 catalog.json 校验值\n' +
      'python3 scripts/inject_toolkit.py\n' +
      '\n' +
      '# 复用部署到自己的域名：改 wrangler.jsonc 的 Worker 名与 routes[].pattern\n' +
      '# 完整包 SHA256SUMS.txt 与 ZIP 一起放在 GitHub Releases'
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
