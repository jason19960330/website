/**
 * ============================================================================
 *  skill-page.js —— Skill 指南页（skill.html）逻辑层
 * ============================================================================
 *  职责：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 推文卡片流：列表只露摘要，点击卡片跳转到完整指南页（skill-doc.html）对应章节
 *    3. 概览入口卡整卡可点（卡内 GitHub 链接除外）
 *    4. 指令块「复制」能力保留在完整指南页（skill-doc.js）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[skill] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';
  var DOC_URL = 'skill-doc.html';

  /* ---------------- 可复制的指令文本 ---------------- */
  var TEXTS = {
    install: 'npx skills add https://github.com/larashero3-dotcom/lieflat-charts --skill lieflat-charts',
    installAlt: 'git clone https://github.com/larashero3-dotcom/lieflat-charts ~/.claude/skills/lieflat-charts',
    article: '用 lieflat-charts 把这份数据做成 4-6 张中文配图，用于公众号长文。\n' +
      '数据：\n' +
      '（粘贴你的数据：CSV、表格或纯文本都行）\n\n' +
      '默认先比较 Lupi Editorial 和 Basics 候选，两组都不适配时再使用 Glance。\n' +
      '每张图只承担一个结论，保留真实单位，同一批图只用一种色系。',
    video: '用 lieflat-charts 把这份数据做成带滚动入场、数字递增和动态排名的 HTML，\n' +
      '我要用浏览器全屏录屏做视频素材（1080x1920 竖屏）。\n' +
      '打开页面即自动播放，不需要点击交互，整套动效控制在 8 秒内。\n\n' +
      '数据：\n' +
      '（粘贴你的数据）',
    report: '基于这份数据，用 lieflat-charts 生成一份完整的中文 HTML 报告。\n' +
      '报告类型：月度运营（版心 1080，中等密度，4 个图表槽位）。\n' +
      '需要组织好标题、核心结论、KPI、图表、旁注和数据来源，可直接发布。\n\n' +
      '数据：\n' +
      '（粘贴你的数据）',
    brand: '这是我参考图的配色逻辑（见附图）：\n' +
      '请只提取颜色关系与明度层次，不要复制原图的构图和图型。\n' +
      '用这套色重做上一批图：图型结构、比例和数据完全不变，\n' +
      '只替换色彩系统，同一批图只用这一套色。'
  };

  /* ---------------- 卡片数据：列表摘要 + 全文正文 ----------------
   * item: { s: 加粗引导词（可空）, t: 正文（允许 <strong> 等静态标记） }
   * prompt: { key: TEXTS 键, label: 说明 }
   * link: { label, href }
   * ------------------------------------------------------------- */
  var POSTS = [
    {
      id: 'what', no: '01', date: '09-23',
      title: '它到底是什么',
      preview: '不是图表库，而是一套「教 Agent 怎么把图画得有编辑品味」的规则 + 现成模板。装上之后，Agent 出图时会被规则约束，不能随意自由发挥。',
      items: [
        { s: '模板驱动', t: '：每张图必须先锁定图型编号，再复制仓库里该图型的真实实现骨架，禁止另画一张「看起来差不多」的图，也禁止退回图表库默认样式。' },
        { s: '先判形状，再选图', t: '：比较、时间序列、占比、带正负、分布、网络、逐条记录——数据形状才是选图的主键，不用你指定图型。' },
        { s: '统一视觉语法', t: '：统一的字体、留白、发丝线与动效节奏，默认 Mono 黑白灰，也可切换青瓷蓝 / 椰林绿 / 编辑部红三套彩色。' },
        { s: '图数由结论数决定', t: '：一个问题出 1 张，2–3 个结论出 2–3 张，长文 4–6 张，单页上限 6 张，不会为了凑数硬加图。' }
      ],
      tip: '<strong>为什么它出的图比普通 AI 好看：</strong>因为 Agent 不是在「凭空生成 SVG」，而是在一套已经调好比例、留白和动效的真实模板上替换数据。'
    },
    {
      id: 'install', no: '02', date: '09-24',
      title: '怎么安装',
      preview: '遵循 Agent Skills 规范，一条命令装到对应 Agent 的 skills 目录即可。装完直接对 Agent 说人话就行，不用记指令格式。',
      prompts: [
        { key: 'install', label: '一条命令安装（Claude Code / 兼容 SKILL.md 的 Agent）' },
        { key: 'installAlt', label: '也可以直接克隆到 skills 目录（Codex 换成 ~/.codex/skills/）' }
      ],
      tip: '装好之后不用记指令格式，只要说「<strong>把这些调研数据做成 5 张中文配图</strong>」就够了；想更稳一点，可以补一句「默认先比较 Lupi Editorial 和 Basics 候选」。'
    },
    {
      id: 's1', no: '03', date: '09-25',
      title: '场景一 · 给文章制作数据配图',
      preview: '最适合数据型、研究型、工具测评型长文。出图自带排版和旁注，普通内容直接用完全够，能明显提升文章的专业感。',
      chips: ['X 长文 / 公众号配图', '4–6 张小红书数据配图', '短帖的一张关键结论图', '深度报告拆成可传播的数据结论', '多工具多维度测评对比'],
      items: [
        { s: '', t: '不需要提前想好用柱状图、折线图还是散点图——把数据和使用场景告诉它，它先判断数据结构再选模板。' },
        { s: '', t: '一次让它在同一批里出多张图时，它会避免重复图型，每张图只承担一个独立结论。' },
        { s: '', t: '数据里有真实单位就保留真实单位；取整造成的误差会在底注里「认账」，不会偷偷凑成整数。' }
      ],
      prompts: [{ key: 'article', label: '直接这样下指令' }],
      tip: '配图数量按「结论数」来，不是按数据列数来：<strong>一篇文章 4–6 张</strong>就够，再多就该拆成多页。'
    },
    {
      id: 's2', no: '04', date: '09-26',
      title: '场景二 · 给视频制作动态数据画面',
      preview: '部分模板自带滚动入场、数字递增、动态排名和交互效果。生成 HTML 后用浏览器录屏，就是现成的视频素材。',
      chips: ['视频开场', '口播中的数据证据', '排名变化动画', '趋势演示', 'B-roll 数据素材'],
      items: [
        { s: '', t: 'G16 Bar Race、G18 Draw-in + Counter、G12 Stagger Wave 这几个模板本身就是为动效设计的。' },
        { s: '', t: '录屏前把浏览器窗口调到目标比例（如 1080×1920 竖屏），全屏后再录，避免缩放糊边。' },
        { s: '', t: '如果本机开了「减少动态效果」，动画会被系统降级——录屏前记得关掉。' }
      ],
      prompts: [{ key: 'video', label: '直接这样下指令' }]
    },
    {
      id: 's3', no: '05', date: '09-26',
      title: '场景三 · 生成完整的数据报告',
      preview: '只有当你明确说出「报告 / 白皮书 / 海报 / brief / Dashboard 报告」这类词时，它才会切换到报告模式，从 12 套中英文整页模板里选一套。',
      chips: ['调研一页纸', '年度数据海报', '月度运营报告', '研究简报', '产品与项目复盘', '数据 Dashboard', '个人年度记录'],
      items: [
        { s: '', t: '报告不是把几张图堆在一起，而是同时组织标题、核心结论、KPI、图表、旁注、数据来源和结尾。' },
        { s: '', t: '每套模板都有中文版和英文版，同一份报告里不混语言；版心从 600 到 1080px 不等，密度分低 / 中 / 高。' },
        { s: '', t: '金融经济、业务运营、产品复盘、个人年度记录都能套用——不要被模板名字里的行业词限制住。' }
      ],
      prompts: [{ key: 'report', label: '直接这样下指令' }],
      tip: '有歧义时它会默认出图而不是出报告。想要报告，就把「<strong>报告 / 白皮书 / 海报</strong>」这类词说清楚。'
    },
    {
      id: 'color', no: '06', date: '09-27',
      title: '统一成自己的品牌色',
      preview: 'Skill 自带的美商已经够用；如果你有品牌视觉，也可以让它整批换成你的主题色——没有完整色值，给一张参考图也行。',
      items: [
        { s: '', t: '有完整色值就直接给色值；让它建立一套 custom 色板，同一批图只用这一套。' },
        { s: '', t: '没有完整色值也没关系：给一张参考图，让它<strong>只提取颜色逻辑，不复制原图构图</strong>。' },
        { s: '', t: '换色后仍要保持图型结构、比例、对比度和数据含义不变——颜色只换肤，不改数据契约。' }
      ],
      prompts: [{ key: 'brand', label: '直接这样下指令' }]
    },
    {
      id: 'rules', no: '07', date: '09-28',
      title: '三条硬规则（写指令时记住就够）',
      preview: '给数据 + 给场景，不给图型；单一色系；不要让它编数据。记住这三条，出图质量就稳了。',
      items: [
        { s: '给数据 + 给场景，不给图型。', t: '你说要柱状图，反而可能限制它选出更诚实的编码方式。' },
        { s: '单一色系。', t: '同一份 HTML 或同一组图只使用一种色彩系统，不混搭。' },
        { s: '不要让它编数据。', t: '没有的数据就空着；模板里带演示数据的槽位要主动删掉。' }
      ]
    },
    {
      id: 'care', no: '08', date: '09-29',
      title: '使用须知',
      preview: '许可是 PolyForm Noncommercial 1.0，商业用途需要授权；部分图表依赖 CDN；仓库体积约 27MB；地图要显式要求。',
      items: [
        { s: '许可是 PolyForm Noncommercial 1.0', t: '：学习、修改、非商业使用都可以，商业用途需要另行取得作者授权。' },
        { s: '部分图表依赖 CDN', t: '：Glance 系列、网络图 / 力导向图，以及报告模板 R11、R12 需要联网加载 ECharts / Chart.js；要离线用就选 R01–R10 并把字体内联。' },
        { s: '仓库体积约 27MB', t: '（主要是模板与预览图），SKILL.md 本身 37KB，建议只在需要出图时才启用这个 Skill。' },
        { s: '地图要显式要求', t: '：默认不会给你地图图型，需要地域分布时明确说出来。' }
      ],
      links: [
        { label: '开源仓库', href: 'https://github.com/larashero3-dotcom/lieflat-charts' },
        { label: '作者 @lieflat_3', href: 'https://x.com/lieflat_3' }
      ]
    }
  ];

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

      /* ---------------- 页面跳转 ---------------- */
      // 概览入口卡：整卡可点，卡内 <a>（开源仓库 / 完整指南链接）由自身接管
      function goDoc(e) {
        if (e && e.target && e.target.closest && e.target.closest('a')) return;
        location.href = DOC_URL;
      }

      // 推文卡片：跳到完整指南页对应章节
      function go(p) {
        location.href = DOC_URL + '#' + p.id;
      }

      /* ---------------- 复制指令 ---------------- */
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
        texts: TEXTS, posts: POSTS,
        theme: theme, toggleTheme: toggleTheme,
        goDoc: goDoc, go: go,
        copied: copied, copy: copy
      };
    }
  });

  app.mount('#skill-app');
})();
