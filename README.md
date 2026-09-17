# website

李文涛的个人主页 —— 单页滚动式简历站点。**零构建部署，依赖全部本地化，离线即可打开，支持深浅双主题。**

## 目录结构

```
website/
├── index.html                 # 页面骨架（结构层）：唯一的 HTML
├── assets/
│   ├── favicon.svg
│   ├── avatar.jpg             # 可选：放进来就会替换掉字母头像
│   ├── css/style.css          # 主题变量 + Tailwind 表达不了的组件类与动效
│   └── js/
│       ├── data.js            # ★ 内容层：全部简历内容
│       └── app.js             # 逻辑层：主题、Arco 注册、指令、雷达图计算
├── vendor/
│   ├── vue.global.prod.js     # Vue 3.5.42
│   ├── arco-vue.min.js        # Arco Design Vue 2.58.0（UMD）
│   ├── arco.min.css
│   └── tailwind.play.js       # Tailwind CSS 3.4.16
└── README.md
```

三层职责分离，互不掺内容：

| 我想改什么 | 改哪个文件 |
|---|---|
| 个人信息、经历、项目、技能、教育、荣誉 | `assets/js/data.js` |
| 配色（含深浅两套） | `assets/css/style.css` 里的 `:root` 与 `html.dark` |
| 板块顺序、布局、增删区块 | `index.html` |
| 交互行为 | `assets/js/app.js` |

## 本地预览

双击 `index.html` 即可打开；建议起本地服务以避免个别浏览器的本地文件限制：

```bash
python3 -m http.server 8000   # 然后访问 http://localhost:8000
```

## 部署到 GitHub Pages

推送后在仓库 Settings → Pages 选择 `main` 分支根目录（`/root`）即可，无构建步骤。
首次推送或改动较大时，Pages 有 **1–2 分钟**构建延迟，看不到变化先强制刷新（Cmd + Shift + R）。

## 技术选型

- **Vue 3 global build**（含编译器）+ **Tailwind Play CDN**：零构建，改完即生效
- **Arco Design Vue**：Button / Tag / Timeline / Collapse / Tooltip / Drawer / Avatar / Divider + Message 提示
- 全部依赖已下载到 `vendor/`，不受网络影响

### Arco 的接入要点（排了两个坑）

1. **UMD 导出名不带 `a-` 前缀**，而 in-DOM 模板必须写小写 kebab。因此在 `app.js` 里显式补注册了 `a-button`、`a-timeline` 等别名，否则组件静默失效。
2. **Arco 的暗色主题写在同一份 CSS 里**，激活方式是给 `<body>` 加 `arco-theme="dark"` 属性，由 `app.js` 的 `applyTheme()` 负责同步。

## 双主题实现

所有颜色走 CSS 变量，Tailwind 侧封装了一组语义色，布局里只写语义类，因此**不需要到处写 `dark:` 前缀**：

| 语义类 | 用途 |
|---|---|
| `bg-base` / `bg-panel` / `bg-raise` | 页面底色 / 卡片 / 次级填充 |
| `border-hair` | 描边 |
| `text-ink` / `text-dim` / `text-faint` | 主 / 次 / 弱文字 |
| `text-accent` / `bg-accent/10` | 强调色 |

切换逻辑：`index.html` 头部有段前置脚本先读 localStorage（无记录则跟随系统 `prefers-color-scheme`）打上 `html.dark`，避免首屏闪白；点击右上角按钮切换并记住选择，同时同步 Arco 主题。

## 内容与数据来源

内容全部整理自个人简历（`李文涛_技术支持.pdf`）：

| 板块 | 内容 |
|---|---|
| Hero | 姓名 / 头衔 / 求职意向 / 所在地、电话、邮箱 |
| 关于 | 自我简介 + 核心数据（7 年 / 500+ / 99% / 20+）+ 核心优势 |
| 技能 | 四大技能组（含自评等级）+ 能力雷达图 + 工具栈 |
| 经历 | 晖致医药、北京鲨鱼公园，明细可折叠展开 |
| 项目 | 资产台账规范化、终端资产运营、新零售现场交付 |
| 教育 | 教育背景 + 证书荣誉 + 语言能力 |

> 技能里的 `level` 是按简历上的「精通 / 熟练 / 了解」换算的参考值（90+ 精通、80+ 熟练、65+ 熟悉），可在 `data.js` 中按需微调。

## 交互与动效

- 主题切换（持久化 + 跟随系统）
- 滚动入场（`v-reveal`）、技能条生长、数字滚动计数（`v-count`）
- 卡片光标聚光（`v-spotlight`）、悬停抬升
- 导航 scroll spy 高亮、移动端抽屉菜单、返回顶部
- 复制邮箱 / 电话 → Arco Message 成功提示
- 经历与项目的明细折叠展开（Arco Collapse）
- 已适配 `prefers-reduced-motion`，系统开启「减少动态效果」时全部降级

## 依赖更新

`vendor/` 内为固定版本构建产物，升级方式：

```bash
curl -L -o vendor/vue.global.prod.js https://unpkg.com/vue@3/dist/vue.global.prod.js
curl -L -o vendor/arco-vue.min.js   https://unpkg.com/@arco-design/web-vue@2.58.0/dist/arco-vue.min.js
curl -L -o vendor/arco.min.css      https://unpkg.com/@arco-design/web-vue@2.58.0/dist/arco.min.css
curl -L -o vendor/tailwind.play.js  https://cdn.tailwindcss.com/3.4.16
```

其中 Tailwind 的生产环境提示已在本副本中移除（原本是无条件 `console.warn`）。
