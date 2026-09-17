# website

李文涛的个人主页 —— 单页滚动式个人站点，零构建部署，依赖全部本地化。

## 目录结构

```
website/
├── index.html              # 页面骨架（结构层）：唯一的 HTML 文件
├── assets/
│   ├── favicon.svg         # 站点图标
│   ├── css/
│   │   └── style.css       # 主题变量 + Tailwind 表达不了的组件类与动效
│   └── js/
│       ├── data.js         # ★ 内容层：所有个人信息、技能、项目、经历、文章
│       └── app.js          # 逻辑层：滚动监听、入场动画、GitHub 数据、雷达图计算
├── vendor/
│   ├── vue.global.prod.js  # Vue 3.5.42（本地化，离线可用）
│   └── tailwind.play.js    # Tailwind CSS 3.4.16（本地化）
└── README.md
```

三层职责分离，互不掺内容：

| 我想改什么 | 改哪个文件 |
|---|---|
| 姓名、简介、技能、项目、经历、文章 | `assets/js/data.js` |
| 配色、动效时长、卡片质感 | `assets/css/style.css` 顶部的 `:root` 变量 |
| 板块顺序、布局、增删区块 | `index.html` |
| 交互行为、数据来源 | `assets/js/app.js` |

## 本地预览

直接双击 `index.html` 即可（依赖已本地化，无需联网）。
但建议起本地服务，避免个别浏览器的本地文件限制：

```bash
python3 -m http.server 8000
# 然后打开 http://localhost:8000
```

## 部署到 GitHub Pages

推送到 GitHub 后，在仓库 Settings → Pages 里选择 `main` 分支的根目录（`/root`）即可，无需构建步骤。

> 注意：GitHub Pages 会把 `.md` 一并发布，`README.md` 不会覆盖首页，入口始终是 `index.html`。

## 板块与数据来源

| 板块 | 内容来源 |
|---|---|
| Hero / 关于 | `data.js` → `meta` |
| 数据概览 | `data.js` → `stats`；标注了 `live` 的字段会优先取 GitHub 实时值 |
| 主力语言分布 | 实时调用 GitHub API 统计，失败时自动隐藏该卡片 |
| 技能矩阵 | `data.js` → `skillGroups`（同一份数据同时驱动雷达图） |
| 项目 / 经历 / 文章 | `data.js` → `projects` / `timeline` / `posts` |

GitHub 相关数据带 30 分钟本地缓存，接口限流或离线时会回退到静态数值，不会影响页面。

## 关于示例内容

`projects` / `timeline` / `posts` 里目前是占位示例条目（在 `data.js` 中标记为 `placeholder: true`）。
页面右下角会出现一条提示条，把示例替换成真实内容后，**该提示会自动消失**。

## 依赖更新

`vendor/` 里的两个文件是固定版本的构建产物，属于离线兜底。如需升级：

```bash
curl -L -o vendor/vue.global.prod.js https://unpkg.com/vue@3/dist/vue.global.prod.js
curl -L -o vendor/tailwind.play.js  https://cdn.tailwindcss.com/3.4.16
```

其中 Tailwind 的生产环境提示已在本副本中移除（原本是无条件 `console.warn`）。
