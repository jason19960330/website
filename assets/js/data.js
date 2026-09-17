/**
 * ============================================================================
 *  site.data.js —— 全站内容配置层
 * ============================================================================
 *  这个文件是整站唯一的内容来源。template（index.html）与逻辑（app.js）
 *  都不包含任何个人信息，因此：
 *
 *    · 更新站点内容   → 只改这个文件
 *    · 调整外观结构   → 改 index.html
 *    · 调整交互行为   → 改 app.js
 *
 *  所有条目都支持 placeholder 标记：只要任意条目带 `placeholder: true`，
 *  页面顶部会出现一条「示例内容」提示条，把示例替换成真实内容后自动消失。
 * ============================================================================
 */
window.SITE_CONFIG = {

  /* ------------------------------------------------------------------
   * 1. 基础信息
   * ---------------------------------------------------------------- */
  meta: {
    name: '李文涛',
    shortName: '李文涛',
    avatarText: 'WT',
    title: 'AI 探索者 / 自动化工作流构建',
    // 依次轮换展示的身份关键词
    roles: ['AI 探索者', '自动化工作流构建者', 'Python 效率工程师'],
    bio: '热衷于探索大模型应用、智能体技能（Agent Skills）与 Python 生产力自动化。致力于用技术提升日常效率与个人知识体系质量。',
    // 关于我板块的详细段落，支持任意条数
    intro: [
      '我关注的是「让机器把重复的事情做完」这件事本身——从一条 Python 脚本，到一个能被反复调用的 Agent Skill，再到一整套自动流转的工作流。工具会换代，但把时间从重复劳动里赎回来这件事，始终值得做。',
      '日常里我把大部分精力投入在大模型应用、智能体技能设计与知识管理体系上，也喜欢把踩过的坑沉淀成可复用的模板和文档。'
    ],
    location: '中国',
    email: '573164137@qq.com',
    available: true,                 // 是否显示「开放合作中」状态点
    availabilityText: '开放合作中'
  },

  /* ------------------------------------------------------------------
   * 2. 导航（id 必须与 index.html 中 <section id="..."> 对应）
   * ---------------------------------------------------------------- */
  nav: [
    { id: 'home',      label: '首页' },
    { id: 'about',     label: '关于' },
    { id: 'skills',    label: '技能' },
    { id: 'projects',  label: '项目' },
    { id: 'timeline',  label: '经历' },
    { id: 'writing',   label: '文章' },
    { id: 'contact',   label: '联系' }
  ],

  /* ------------------------------------------------------------------
   * 3. 社交链接（icon 支持：github / mail / website / rss / zhihu / juejin）
   * ---------------------------------------------------------------- */
  social: [
    { name: 'GitHub',  icon: 'github',  url: 'https://github.com/jason19960330' },
    { name: 'Website', icon: 'website', url: 'https://jason19960330.github.io/website/' },
    { name: 'Email',   icon: 'mail',    url: 'mailto:573164137@qq.com' }
  ],

  /* ------------------------------------------------------------------
   * 4. 数据概览
   *    live 字段 = 从 GitHub 实时拉取的字段名，拉取失败则回退到 value
   * ---------------------------------------------------------------- */
  stats: [
    { label: '开源仓库',   value: 12, suffix: '',  live: 'repos' },
    { label: 'GitHub 关注者', value: 8, suffix: '', live: 'followers' },
    { label: '技能点',     value: 15, suffix: '+' },
    { label: '写作累计',   value: 9,  suffix: ' 篇' }
  ],

  /* ------------------------------------------------------------------
   * 5. 技能矩阵（level 0-100，同时驱动技能条与「能力雷达图」）
   *    color: sky / indigo / emerald / amber / rose / violet
   * ---------------------------------------------------------------- */
  skillGroups: [
    {
      title: 'AI 与智能体',
      desc: '把模糊的需求翻译成模型听得懂的结构',
      color: 'sky',
      skills: [
        { name: 'Prompt 工程',      level: 88 },
        { name: 'Agent Skills 设计', level: 82 },
        { name: '大模型应用开发',    level: 74 },
        { name: 'RAG / 知识库检索',  level: 66 }
      ]
    },
    {
      title: '编程与开发',
      desc: '能跑起来的东西才算做完',
      color: 'indigo',
      skills: [
        { name: 'Python',       level: 90 },
        { name: 'HTML / CSS / Tailwind', level: 78 },
        { name: 'Vue.js',       level: 72 },
        { name: 'JavaScript',   level: 70 }
      ]
    },
    {
      title: '自动化工作流',
      desc: '一次写好，长期躺赢',
      color: 'emerald',
      skills: [
        { name: '脚本自动化',        level: 86 },
        { name: '数据采集与清洗',    level: 76 },
        { name: '定时任务 / 调度',   level: 70 }
      ]
    },
    {
      title: '知识与工具',
      desc: '让积累可复用、可检索',
      color: 'amber',
      skills: [
        { name: 'Obsidian 知识管理', level: 88 },
        { name: 'Markdown 写作',     level: 86 },
        { name: 'Git 版本控制',      level: 74 }
      ]
    }
  ],

  /* ------------------------------------------------------------------
   * 6. 项目作品（featured 会占两列；留空 links.demo 则不显示演示入口）
   * ---------------------------------------------------------------- */
  projects: [
    {
      name: 'Agent Skills 实践合集',
      year: '2026',
      summary: '把日常重复流程沉淀成可被调用的智能体技能包，覆盖文档处理、批量改写与信息抽取三类场景，做到一次编写、多处复用。',
      tags: ['AI Agent', 'Python', 'Skills'],
      links: { repo: 'https://github.com/jason19960330', demo: '' },
      featured: true,
      placeholder: true
    },
    {
      name: 'Python 效率工具箱',
      year: '2025',
      summary: '一批解决具体痛点的小工具：批量重命名、报表合并、定时抓取与推送。全部命令行可用，参数统一，附带使用示例。',
      tags: ['Python', '自动化', 'CLI'],
      links: { repo: 'https://github.com/jason19960330', demo: '' },
      featured: false,
      placeholder: true
    },
    {
      name: 'Obsidian 知识体系模板',
      year: '2025',
      summary: '一套围绕「收集—整理—输出」设计的笔记工作流模板，包含元数据结构、标签体系与双向链接规范，可一键套用。',
      tags: ['Obsidian', '知识管理', '模板'],
      links: { repo: 'https://github.com/jason19960330', demo: '' },
      featured: false,
      placeholder: true
    },
    {
      name: '个人主页 · Vue 3 + Tailwind',
      year: '2026',
      summary: '你现在看到的这个站点。零构建部署，内容与逻辑完全分离，全部依赖本地化，离线也能正常打开。',
      tags: ['Vue 3', 'Tailwind', 'GitHub Pages'],
      links: { repo: 'https://github.com/jason19960330/website', demo: 'https://jason19960330.github.io/website/' },
      featured: false,
      placeholder: true
    }
  ],

  /* ------------------------------------------------------------------
   * 7. 经历时间线（倒序排列，最新在最前）
   * ---------------------------------------------------------------- */
  timeline: [
    {
      period: '2025 — 至今',
      role: 'AI 应用探索 · 个人项目',
      org: '独立开发者',
      summary: '围绕大模型与智能体技能构建自动化工作流，同时把实践经验整理成可持续迭代的技能包与文档。',
      tags: ['AI Agent', 'Python'],
      placeholder: true
    },
    {
      period: '2023 — 2025',
      role: '效率工具开发与知识管理',
      org: '个人实践',
      summary: '用 Python 处理日常重复劳动，逐步建立起以 Obsidian 为核心的个人知识管理体系。',
      tags: ['自动化', '知识管理'],
      placeholder: true
    },
    {
      period: '2021 — 2023',
      role: '前端与交互入门',
      org: '自学 / 实践',
      summary: '从 HTML、CSS 到 Vue.js，完成若干前端小项目，建立起对交互与界面结构的基本认知。',
      tags: ['Vue.js', '前端'],
      placeholder: true
    }
  ],

  /* ------------------------------------------------------------------
   * 8. 文章 / 博客（url 留空则只展示标题，不生成链接）
   * ---------------------------------------------------------------- */
  posts: [
    {
      title: '从零设计一个可复用的 Agent Skill',
      date: '2026-08-12',
      source: '待发布',
      url: '',
      excerpt: '好的技能包应该像工具而不是一次性脚本：边界清晰、输入明确、失败可预期。聊聊我在设计时的取舍。',
      tags: ['AI', 'Agent'],
      placeholder: true
    },
    {
      title: '用 Python 把每天 30 分钟的重复操作压到 30 秒',
      date: '2026-05-04',
      source: '待发布',
      url: '',
      excerpt: '三个真实场景下的脚本改造记录，以及什么时候应该写脚本、什么时候应该忍住不写。',
      tags: ['Python', '效率'],
      placeholder: true
    },
    {
      title: '我的 Obsidian 笔记流：收集、整理到输出',
      date: '2025-11-20',
      source: '待发布',
      url: '',
      excerpt: '一套用了两年还在迭代的笔记工作流，重点是如何让旧笔记持续产生价值。',
      tags: ['Obsidian', '方法论'],
      placeholder: true
    }
  ],

  /* ------------------------------------------------------------------
   * 9. GitHub 数据源（决定「数据可视化」板块的实时部分）
   * ---------------------------------------------------------------- */
  github: {
    username: 'jason19960330',
    enabled: true,        // false 则完全使用静态数值
    cacheMinutes: 30      // 本地缓存时长，避免频繁请求
  }
};
