/**
 * ============================================================================
 *  oil-ui-doc.js —— Oil UI 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[oil-ui-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    install:
      '# 终端直接运行安装（使用 npx 自动拉取 Skill 并注册到当前环境）\n' +
      'npx skills add oil-oil/oil-ui\n' +
      '\n' +
      '# 或者直接对你的 AI 编程助手（Claude Code / Cursor / Windsurf / Codex / Antigravity）发送：\n' +
      '请帮我安装这个 Skill：运行 npx skills add oil-oil/oil-ui\n' +
      '\n' +
      '# 若在 DeepSeek Harness 中使用，可安装官方原生插件包：\n' +
      'dsh plugin --profile web add github:oil-oil/dsh-oil-ui',
    prompts:
      '# 场景 1：多方向探索与视觉定调（3 方向拉开差距）\n' +
      '"用 oil-ui 给这个 [产品类型/业务需求] 探索几种设计方向，做成可以预览的页面，并排放在对比页里让我选。"\n' +
      '\n' +
      '# 场景 2：对照现有页面或截图进行无损翻新（老项目三步改造）\n' +
      '"帮我润色这个已有项目页面，按项目现有设计规范来：清噪音、调布局、省步骤，不要改坏原有接口与表单校验。"\n' +
      '\n' +
      '# 场景 3：执行「反 AI 塑料感」专项走查与减法清单\n' +
      '"用 oil-ui 审查当前页面，执行反 AI 塑料感减法清单：撕掉发光渐变胶囊、去掉无意义彩条与套娃卡片，规范字阶与留白。"\n' +
      '\n' +
      '# 场景 4：提炼与沉淀全站设计规范（DESIGN.md）\n' +
      '"根据当前确认的页面视觉方案，提炼一份全站共用的 DESIGN.md，明确色彩变量、字阶排版、间距网格与核心组件约定。"',
    antislop:
      '# Oil UI「反 AI 塑料感」减法走查清单\n' +
      '1. 眉标与胶囊：去掉无实质意义的高饱和渐变胶囊与发光 Badge，改用克制的单色微标或纯字阶排版。\n' +
      '2. 装饰彩条：移除卡片顶边或左侧生硬突兀的粗渐变色条，依靠留白、字重与自然对比度拉开信息层次。\n' +
      '3. 拍平套娃：杜绝“外层底卡 + 中层浅灰卡 + 内层内容卡”的三层嵌套，拍平容器，多用轻量细线与间距呼吸感。\n' +
      '4. 剔除假数据：清除「99.9% 效率跃升」「10x 智能飞跃」等空洞假指标，替换为业务真实数据或产品关键动作。\n' +
      '5. 栅格与排版：严格遵循 4px/8px 间距比例与阶梯字号（如 48/32/24/16/14/12px），确保移动端与桌面端自适应。',
    artlanding:
      '# Oil Art Landing（Pro 免费附赠）特色视觉锚点精选\n' +
      '# 桌面官网系列：\n' +
      '  - Kova（极地冰川）：高透冷感冰裂肌理、微霜晶磨砂与利落线条\n' +
      '  - Aperture（暗房胶片）：红外胶卷颗粒质感、冲印微暗光与精细刻度\n' +
      '  - Cairn（暗岩苔藓）：原生玄武岩石断层、粗粝岩面与点缀苔斑\n' +
      '  - Helixa（长虹玻璃）：经典光栅折射、垂直条纹律动与朦胧背景\n' +
      '  - Riso（棉纸压凹）：传统孔版印刷微重影、未漂白纸质纤维与压印凹陷\n' +
      '  - Aquarelle（水彩浸染）：通透晕染边缘与自然水渍渐渗色彩\n' +
      '# 移动 App 系列：\n' +
      '  - Duna（陶土沙丘）、Kryo（冰块兰花）、Aizome（手工靛蓝扎染）\n' +
      '# 落地特性：支持业务自定义语法派生，出图后支持生成带前景遮挡层次与视差滚动的真实网页。'
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
