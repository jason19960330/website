/**
 * ============================================================================
 *  animation-handbook-doc.js —— Animation Handbook 使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[animation-handbook-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    quickstart:
      '# 1. 克隆 Animation Handbook 官方开源手册仓库\n' +
      'git clone https://github.com/matinmonshizadeh/animation-handbook.git\n' +
      'cd animation-handbook\n' +
      '\n' +
      '# 2. 启动本地静态服务器（手册基于纯原生 HTML/CSS/JS，完全不需要 npm install 或打包编译）\n' +
      'python3 -m http.server 8000\n' +
      '\n' +
      '# 3. 浏览器访问体验\n' +
      '# 打开 http://localhost:8000 即可离线畅玩全部 176 种动效并查看源码与调试面板\n' +
      '# 也可直接在线访问：https://matinmonshizadeh.github.io/animation-handbook/',
    prompts:
      '# 场景 1：3D 微倾斜与光斑跟随卡片（Parallax 3D Tilt & Spotlight）\n' +
      '"请使用纯 HTML、CSS 和原生 JavaScript 实现一个卡片微交互动效：鼠标划入时产生最大 6 度的 3D 视角微倾斜（perspective + rotateX/Y），并在表面掠过一层跟随光标坐标移动的柔和冷蓝漫反射高光；鼠标移出时使用三次贝塞尔曲线平滑弹性复位；在手机触屏或 prefers-reduced-motion 时自动平置降级。"\n' +
      '\n' +
      '# 场景 2：顶部极细渐变滚动阅读进度条（Scroll Progress Bar）\n' +
      '"请为页面顶部实现一条 2.5px 的渐变滚动阅读进度条：固定在视口最顶层，优先使用 CSS 原生 animation-timeline: scroll() 120Hz 硬件加速，并提供基于 scroll 事件与 requestAnimationFrame 的轻量兜底；页面向下滚动时由左向右平滑拉满。"\n' +
      '\n' +
      '# 场景 3：文字打字机与平滑渐变流光（Text Typography）\n' +
      '"请为标题实现极简打字机展开动效：文字逐字显现后光标微弱闪烁，随后文字内部掠过一道克制的冷蓝微渐变流光，避免大面积高饱和色彩造成的视觉疲劳。"\n' +
      '\n' +
      '# 场景 4：主题切换平滑变形（Theme Toggle Morph）\n' +
      '"请为深浅主题切换按钮制作纯 CSS/SVG 动效：点击时太阳的 8 束光芒平滑缩进并旋转淡出，核心圆球平滑变形为弯月边缘，过渡时间 0.35s。"',
    code_tilt:
      '<!-- HTML 结构 -->\n' +
      '<div class="tilt-card" id="card">\n' +
      '  <div class="card-content">\n' +
      '    <h3>3D 交互卡片</h3>\n' +
      '    <p>鼠标掠过感受视差倾斜与漫反射光泽</p>\n' +
      '  </div>\n' +
      '</div>\n' +
      '\n' +
      '/* CSS 样式 */\n' +
      '.tilt-card {\n' +
      '  position: relative; overflow: hidden;\n' +
      '  transform-style: preserve-3d; will-change: transform;\n' +
      '  transition: transform .4s cubic-bezier(.16, 1, .3, 1), box-shadow .35s ease;\n' +
      '}\n' +
      '.tilt-card.is-tilting { transition: transform .08s ease-out; }\n' +
      '.tilt-card::before {\n' +
      '  content: \'\'; position: absolute; inset: 0; pointer-events: none;\n' +
      '  background: radial-gradient(circle 260px at var(--spot-x, 50%) var(--spot-y, 50%), rgba(2, 132, 199, .15), transparent 65%);\n' +
      '  opacity: var(--spot-opacity, 0); transition: opacity .35s ease;\n' +
      '}\n' +
      '\n' +
      '// 原生 JS 驱动\n' +
      'const el = document.getElementById(\'card\');\n' +
      'el.addEventListener(\'pointermove\', (e) => {\n' +
      '  if (e.pointerType && e.pointerType !== \'mouse\') return;\n' +
      '  const r = el.getBoundingClientRect();\n' +
      '  const px = (e.clientX - r.left) / r.width;\n' +
      '  const py = (e.clientY - r.top) / r.height;\n' +
      '  el.classList.add(\'is-tilting\');\n' +
      '  el.style.transform = `perspective(900px) rotateX(${(py - 0.5) * -7}deg) rotateY(${(px - 0.5) * 7}deg) translateY(-2px)`;\n' +
      '  el.style.setProperty(\'--spot-x\', `${px * 100}%`);\n' +
      '  el.style.setProperty(\'--spot-y\', `${py * 100}%`);\n' +
      '  el.style.setProperty(\'--spot-opacity\', \'1\');\n' +
      '});\n' +
      'el.addEventListener(\'pointerleave\', () => {\n' +
      '  el.classList.remove(\'is-tilting\');\n' +
      '  el.style.transform = \'perspective(900px) rotateX(0) rotateY(0) translateY(0)\';\n' +
      '  el.style.setProperty(\'--spot-opacity\', \'0\');\n' +
      '});',
    famous_prompts:
      '# 场景 1：复现 Linear 官网磁吸按钮（Magnetic Button）\n' +
      '"实现一个类似 Linear 的磁吸按钮：当光标接近按钮边缘 30px 范围以内时，按钮整体产生微弱吸引力向光标方向偏移最大 8px；光标移开时带弹性阻尼缓动回弹到原始位置。"\n' +
      '\n' +
      '# 场景 2：复现 Apple 官网平滑视差深度（Parallax Depth of Field）\n' +
      '"实现一个类似 Apple 产品发布页的视差滚动图层：背景虚化远景慢速平移（0.3x 速度），前景文字全速滚动，中间层产品卡片带轻微缩放变换，营造影院级景深空间感。"\n' +
      '\n' +
      '# 场景 3：复现 Stripe 极速流光渐变（Spotlight Edge Glow）\n' +
      '"实现类似 Stripe 的发光卡片网格：每个卡片拥有 1px 幽灵细线，当光标在网格中划过时，只有光标附近的卡片边缘被瞬间点亮激活，营造精密硬件仪表的科技光晕感。"'
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
