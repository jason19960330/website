/**
 * ============================================================================
 *  ricoui-blocks-doc.js —— RicoUI Blocks 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[ricoui-blocks-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    components:
      '# V1.0 · 15 个组件 / 5 类，把 URL 里的组件名换成下面任意一个\n' +
      '# Dither Pop  file-organizer / flip-switch / dither-progress / github-repo\n' +
      '# Display     magnifier / contribution-graph / empty-states\n' +
      '#             kubai-empty-states / social-card\n' +
      '# Buttons     button / bell-button\n' +
      '# Backgrounds ascii-background\n' +
      '# Preloader   popin-preloader / clip-image-preloader\n' +
      '#             step-overlap-preloader\n' +
      '#\n' +
      '# 第三方依赖（安装时自动声明）\n' +
      '#   motion → flip-switch、file-organizer\n' +
      '#   gsap   → 三个 preloader\n' +
      '#   其余 10 个组件零第三方依赖\n' +
      '#\n' +
      '# 独立 HTML 版：ascii-background.html、social-card.html\n' +
      '# 在组件详情页 Copy / Download，不需要 React 工程',
    install:
      '# 前置：任意 React + Tailwind 项目\n' +
      '# Next.js / Vite / TanStack Start / Astro + React / React Router 都可以\n' +
      'npx shadcn@latest add https://blocks.ricoui.com/r/flip-switch.json\n' +
      'npx shadcn@latest add https://blocks.ricoui.com/r/file-organizer.json\n' +
      'npx shadcn@latest add https://blocks.ricoui.com/r/ascii-background.json\n' +
      'npx shadcn@latest add https://blocks.ricoui.com/r/popin-preloader.json\n' +
      '#\n' +
      '# motion / gsap 等依赖随安装自动写入 package.json\n' +
      '# 组件源码直接落到项目里（target 由 registry item 指定），归你所有\n' +
      '#\n' +
      '# Manual 路径：完全不用 shadcn CLI 也能用\n' +
      '# 1. 打开 https://blocks.ricoui.com/components 选组件\n' +
      '# 2. 看详情页 Dependencies，手动安装列出来的包\n' +
      '# 3. Copy Source 复制 .tsx 到项目并 import\n' +
      '# 4. ASCII Background / Social Card 另有独立 .html 可直接复制',
    dev:
      '# 本地跑官网：Node.js >= 22.12.0（.nvmrc 固定 22.23.3）+ pnpm\n' +
      'git clone https://github.com/ricocc/ricoui-blocks.git\n' +
      'cd ricoui-blocks\n' +
      'nvm use\n' +
      'pnpm install\n' +
      'pnpm dev\n' +
      '#\n' +
      'pnpm build       # 生产构建 + 类型检查\n' +
      'pnpm preview     # 预览构建产物\n' +
      'pnpm deploy      # 构建并部署到 Cloudflare Workers\n' +
      '#\n' +
      '# 本地 GA4（可选，仅生产构建加载）\n' +
      'cp .env.example .env\n' +
      '# 填 VITE_GOOGLE_ANALYTICS_ID\n' +
      '#\n' +
      '# 参与开发前先读 AGENTS.md，再按需看 docs/ 下五份开发文档',
    registry:
      '# Registry 源：根目录 registry.json + registry/ 下的真实组件源码\n' +
      '# 构建产物：public/r/*.json（生成的，不要手改）\n' +
      'pnpm registry:validate    # 校验 Registry 配置\n' +
      'pnpm registry:build       # 生成 public/r/*.json\n' +
      '#\n' +
      '# 新增一个组件的固定链路（一次做完一个，不批量建空壳）\n' +
      '# component source → preview → metadata → registry item\n' +
      '#   → docs → install verification → next component\n' +
      '#\n' +
      '# 安装验证：官网 Demo 正常不等于 Registry 一定可安装\n' +
      '# 在临时 React + Tailwind 项目里跑一次 shadcn add 再算完成\n' +
      '#\n' +
      '# 检查项：schema 正确 / 文件存在 / dependencies 完整\n' +
      '#   / shadcn build 成功 / JSON URL 可访问 / 临时项目可运行\n' +
      '#\n' +
      '# npm 依赖写 dependencies，item 之间依赖写 registryDependencies'
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
