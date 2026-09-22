# website

李文涛的个人主页 —— 单页滚动式简历站点 + 科技爱好者周刊归档。**依赖预编译后提交进仓库，Pages 直接托管，离线也能打开，支持深浅双主题。**

## 目录结构

```
website/
├── index.html                 # 主站骨架（结构层）：单页简历
├── weekly.html                # 周刊归档页：最近 20 期 + 全量检索
├── 404.html                   # GitHub Pages 自定义 404
├── robots.txt / sitemap.xml   # 搜索引擎收录
├── package.json               # 仅构建期依赖（devDependencies），运行时不需要
├── assets/
│   ├── favicon.svg
│   ├── og-image.png           # 社交分享卡片图（1200×630）
│   ├── resume.pdf             # 简历备份（未在页面展示）
│   ├── css/
│   │   ├── tailwind.css       # 自动生成：Tailwind 预编译产物（勿手改）
│   │   └── style.css          # 主题变量 + 组件定制类 + 动效 + 打印样式
│   └── js/
│       ├── data.js            # ★ 内容层：全部简历内容
│       ├── app.js             # 主站逻辑层：主题、Arco 注册、指令、雷达图计算
│       ├── weekly.js          # 归档页逻辑层：搜索、折叠、主题
│       ├── weekly-index.js    # 自动生成：全量索引（期号/标题/年月）
│       └── weekly-latest.js   # 自动生成：最近 20 期正文条目
├── tools/
│   ├── sync_weekly.py         # 周刊同步脚本，生成 weekly-*.js
│   ├── build.mjs              # ★ 依赖构建：esbuild 打包 Arco 按需 + Tailwind 预编译
│   ├── vendor-entry.js        # 打包入口：声明实际用到的组件
│   ├── tailwind.config.js     # Tailwind 配置（content 扫描范围在这里）
│   └── make_og.py             # 重新生成分享卡片图（需 pillow）
├── .github/workflows/
│   └── sync-weekly.yml        # 每日定时同步（GitHub Actions）
└── vendor/
    ├── arco-bundle.js         # 自动生成：Vue 3 完整版 + 按需 Arco 组件
    └── arco-bundle.css        # 自动生成：上述组件的样式
```

| 我想改什么 | 改哪个文件 | 改完要做什么 |
|---|---|---|
| 个人信息、经历、项目、技能、教育、荣誉 | `assets/js/data.js` | 直接刷新即可 |
| 配色（含深浅两套） | `assets/css/style.css` 里的 `:root` 与 `html.dark` | 直接刷新 |
| 主站板块顺序、布局、增删区块 | `index.html` | 若新增了 Tailwind 类，需重新 `npm run build` |
| 交互行为 | `assets/js/app.js` | 同上 |
| 周刊数据来源与数量 | `tools/sync_weekly.py` | 跑一次脚本（勿手改 `weekly-*.js`） |
| 换 Arco 组件 / 升级依赖 | `tools/vendor-entry.js` + `package.json` | `npm run build` |

## 依赖是怎么构建的（重要）

页面加载的 `vendor/arco-bundle.js` 和 `assets/css/tailwind.css` 都是**构建产物**，源码在 `tools/`：

- **Arco 按需打包**：全量 UMD 约 1.0 MB，实际只用了 10 个组件。`tools/build.mjs` 用 esbuild 只把用到的组件 + Vue 完整版（in-DOM 模板需要编译器）打进一个文件
- **Tailwind 预编译**：不再用浏览器端 JIT 的 Play CDN（约 139 KB gzip 且首屏会闪），改为 CLI 扫描 `tools/tailwind.config.js` 中 content 列出的文件，产出静态 CSS

效果：**首页首屏传输量（gzip）从约 526 KB 降到约 137 KB**，且不再有运行时样式编译。

重新构建：

```bash
npm install        # 首次
npm run build      # 改了 tools/ 下的构建配置或页面类名后执行
```

产物必须提交进仓库（Pages 不跑构建）。

### Arco 的接入要点（排过的坑）

1. **UMD 导出名不带 `a-` 前缀**，而 in-DOM 模板必须写小写 kebab。`app.js` 里显式补注册了 `a-button`、`a-timeline` 等别名，否则组件静默失效。
2. **Vue 必须用含编译器的版本**（`vue.esm-browser.prod.js`），runtime-only 版本编译不了 in-DOM 模板，且不报明确错误。
3. **Arco 暗色主题写在同一份 CSS 里**，给 `<body>` 加 `arco-theme="dark"` 激活，由 `app.js` 的 `applyTheme()` 同步。

## 本地预览

```bash
python3 -m http.server 8000   # 访问 http://localhost:8000
```

## 部署

推送后 Pages 自动构建（1–2 分钟延迟，看不到变化先 Cmd+Shift+R 强刷）。

## SEO 与分享

- `index.html` 带 Open Graph / Twitter Card：分享到微信、领英、X 会出卡片（图：`assets/og-image.png`，改文案后跑 `npm run og` 重新生成，需 pillow）
- JSON-LD `Person` 结构化数据（搜索引擎直接读取）
- `sitemap.xml` + `robots.txt` + canonical

## 双主题

所有颜色走 CSS 变量，Tailwind 侧封装语义类（`bg-base` / `text-ink` / `border-hair` / `text-accent` …），切 `html.dark` 整体换肤。头部前置脚本先读 localStorage（无记录跟随系统）打标记，避免首屏闪白。

## 科技爱好者周刊板块

接入 [ruanyf/weekly](https://github.com/ruanyf/weekly)（阮一峰《科技爱好者周刊》）：

- **主站**：「在读周刊」板块展示最近 6 期；导航栏和 Hero 侧栏有归档页入口
- **归档页** `weekly.html`：最近 **20 期**完整条目 + 全部 **413 期**标题/期号搜索

数据由 `tools/sync_weekly.py` 生成（只用标准库；网络异常退避重试，再失败退回 curl）。GitHub Actions 每天 **北京时间 09:30** 自动同步，**内容变了才提交**。

> 版权说明：周刊正文版权归原作者阮一峰所有，归档页标注来源，每期保留「在 GitHub 阅读原文」链接。

## 内容与数据来源

内容整理自个人简历（`assets/resume.pdf`，未在页面公开展示）：

| 板块 | 内容 |
|---|---|
| Hero | 姓名 / 头衔 / 求职意向 / 所在地、电话、邮箱 |
| 关于 | 自我简介 + 核心数据（7 年 / 500+ / 90%+ / 20+）+ 核心优势 |
| 技能 | 四大技能组（含自评等级）+ 能力雷达图 + 工具栈 |
| 经历 | 晖致医药、北京鲨鱼公园，明细可折叠展开 |
| 项目 | 资产台账规范化、终端资产运营、新零售现场交付 |
| 教育 | 教育背景 + 证书荣誉 + 语言能力 |

> 技能里的 `level` 是按简历上的「精通 / 熟练 / 了解」换算的参考值（90+ 精通、80+ 熟练、65+ 熟悉），可在 `data.js` 中微调。

## 交互、动效与无障碍

- 主题切换（持久化 + 跟随系统）、滚动入场、技能条生长、数字滚动计数、卡片光标聚光、悬停抬升
- 导航 scroll spy、移动端抽屉、返回顶部、复制电话 → Arco Message 提示
- 打印样式：Cmd+P 或「存为 PDF」时自动白底黑字、隐藏导航与动效、折叠面板全展开、卡片不跨页断裂
- 无障碍：skip-link（Tab 直达正文）、`:focus-visible` 统一焦点环、`section` 锚点 `scroll-margin-top` 防顶栏遮挡
- 已适配 `prefers-reduced-motion`
