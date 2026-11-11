/**
 * ============================================================================
 *  work.js —— 工作经历页逻辑层
 * ============================================================================
 *  独立挂载 #work-app，不依赖首页 app.js（首页已改为生活年表）。
 *  内容全部来自 data.js；这里只放主题切换与「五段式 Case」的三组创作文案。
 *  数值一律沿用简历里可核对的口径，不另造数字。
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var CONFIG = window.SITE_CONFIG;
  if (!VueNS) { console.error('[work] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }
  if (!CONFIG) { console.error('[work] 未找到 SITE_CONFIG，请确认 assets/js/data.js 已加载。'); return; }

  var ref = VueNS.ref;
  var THEME_KEY = 'site.theme';

  var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  /* 技能条配色：与 resume.js / app.js 同一组色板，按 skillGroups[].color 取色 */
  var BAR_COLORS = {
    sky:     { line: '#0ea5e9', soft: 'rgba(14,165,233,.16)' },
    indigo:  { line: '#6366f1', soft: 'rgba(99,102,241,.16)' },
    emerald: { line: '#10b981', soft: 'rgba(16,185,129,.16)' },
    amber:   { line: '#f59e0b', soft: 'rgba(245,158,11,.16)' },
    violet:  { line: '#8b5cf6', soft: 'rgba(139,92,246,.16)' },
    rose:    { line: '#f43f5e', soft: 'rgba(244,63,94,.16)' }
  };
  function barColor(name) { return BAR_COLORS[name] || BAR_COLORS.sky; }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme.value === 'dark');
    document.body.setAttribute('arco-theme', theme.value === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* 五段式 Case：把「重新定义问题」和「复盘」从职责描述里拆出来。
     这两段是基于现有项目事实的判断性文字，没有新增任何数字。 */
  var caseReframe = [
    '问题不是「台账有没有填」，而是「记录、系统、实物三者能不能对得上」。'
      + '先把命名、分类和责任口径统一，盘点才从一次性的体力活变成可复用的流程。',
    '不是「发电脑、收电脑」，而是让 500+ 员工在设备换代期间几乎感知不到中断。'
      + '难点在排期、逐台交付与回收入库的闭环，而不在装机本身。',
    '不是「把设备装好」，而是把实验室里的方案变成别人也能照着做一遍的交付流程。'
      + '现场联调只是前半段，操作手册与回收流程才是可复制的部分。'
  ];

  var caseReview = [
    '最花时间的其实是命名与分类口径，而不是盘点动作；口径没定，每次对账都要重来一次。'
      + '若重做，会先把字段规范和责任人写进 SOP，再动设备。',
    '批量更新最容易出问题的是旧机回收与用户切换之间的时间差，靠逐台确认兜住了，代价是人力。'
      + '后续更值得投入的是把确认动作系统化，而不是继续加人。',
    '3 个现场都完成了安装调试到验收，但当时没把常见故障整理成检查清单，每次仍要凭经验记。'
      + '这一块是下一次可以直接补上的。'
  ];

  var caseMetrics = [
    [
      { value: '500+', label: '台终端梳理录入' },
      { value: '<1%', label: '盘点差异率' },
      { value: '20+', label: '标准化 SOP' }
    ],
    [
      { value: '500+', label: '员工办公终端' },
      { value: '95%以上', label: '资产台账准确率' },
      { value: '7 年', label: '持续运营' }
    ],
    [
      { value: '3', label: '个现场部署' },
      { value: '1 套', label: '可复用交付流程' },
      { value: '2019', label: '实施年份' }
    ]
  ];

  VueNS.createApp({
    setup: function () {
      return {
        meta: CONFIG.meta,
        timeline: CONFIG.timeline,
        projects: CONFIG.projects,
        skillGroups: CONFIG.skillGroups,
        toolStack: CONFIG.toolStack,
        education: CONFIG.education,
        honors: CONFIG.honors,
        languages: CONFIG.languages,
        caseReframe: caseReframe,
        caseReview: caseReview,
        caseMetrics: caseMetrics,
        barColor: barColor,
        theme: theme,
        toggleTheme: toggleTheme,
        year: new Date().getFullYear()
      };
    }
  }).mount('#work-app');
})();
