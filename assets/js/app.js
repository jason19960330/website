/**
 * ============================================================================
 *  app.js —— 站点逻辑层
 * ============================================================================
 *  只处理「行为」，不含任何内容数据（内容全在 data.js）
 *    1. 深浅主题：切换、持久化、同步 Arco 主题
 *    2. Arco 按需注册（UMD 导出名无 a- 前缀，这里显式注册别名）
 *    3. 指令：v-reveal 入场、v-count 数字滚动、v-spotlight 光标聚光
 *    4. 导航：滚动监听、scroll spy、移动端抽屉
 *    5. 能力雷达图的 SVG 坐标计算
 *    6. 邮箱 / 电话复制 + Arco Message 提示
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  var ARCO = window.ArcoVue;
  var CONFIG = window.SITE_CONFIG;
  if (!VueNS) { console.error('[site] 未找到 Vue，请确认 vendor/vue.global.prod.js 已加载。'); return; }
  if (!CONFIG) { console.error('[site] 未找到 SITE_CONFIG，请确认 assets/js/data.js 已加载。'); return; }

  var createApp = VueNS.createApp;
  var ref = VueNS.ref;
  var computed = VueNS.computed;
  var onMounted = VueNS.onMounted;
  var onUnmounted = VueNS.onUnmounted;

  var THEME_KEY = 'site.theme';

  var app = createApp({
    setup: function () {
      var meta = CONFIG.meta;

      /* ---------------- 主题 ---------------- */
      // index.html 的头部脚本已提前写入 html.dark，这里只做状态同步，避免首屏闪白
      var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

      function applyTheme(next) {
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.body.setAttribute('arco-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 隐私模式忽略 */ }
      }
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        applyTheme(theme.value);
      }

      /* ---------------- 滚动 / 导航 ---------------- */
      var scrolled = ref(false);
      var showTop = ref(false);
      var activeSection = ref(CONFIG.nav[0].id);
      var menuOpen = ref(false);

      function onScroll() {
        var y = window.scrollY || document.documentElement.scrollTop;
        scrolled.value = y > 8;
        showTop.value = y > 640;
      }
      function jump(id) {
        menuOpen.value = false;
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      function toTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      function navActive(id) { return activeSection.value === id ? 'nav-link is-active' : 'nav-link'; }

      /* ---------------- 复制 + Arco Message ---------------- */
      var Message = ARCO && ARCO.Message;
      function toast(text) { if (Message) Message.success(text); }

      function writeClipboard(text, okText) {
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); toast(okText); } catch (e) { toast(text); }
          document.body.removeChild(ta);
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { toast(okText); }, fallback);
        } else {
          fallback();
        }
      }
      function copyPhone() { writeClipboard(meta.phone, '电话已复制：' + meta.phone); }

      /* ---------------- 周刊：首页只渲染最近 6 期的标题卡片 ---------------- */
      // 数据由 tools/sync_weekly.py 生成，缺失时该板块自动留空，不影响其他内容
      var WEEKLY = window.WEEKLY_INDEX;
      var weeklyReady = !!(WEEKLY && WEEKLY.issues && WEEKLY.issues.length);
      var weeklyTeaser = weeklyReady ? WEEKLY.issues.slice(0, 6) : [];
      var weeklyTotal = weeklyReady ? WEEKLY.total : 0;
      function ghIssue(n) {
        return 'https://github.com/ruanyf/weekly/blob/master/docs/issue-' + n + '.md';
      }

      /* ---------------- 技能等级文案 ---------------- */
      function levelLabel(level) {
        if (level >= 90) return '精通';
        if (level >= 80) return '熟练';
        if (level >= 65) return '熟悉';
        return '了解 · 可快速上手';
      }
      function levelTagColor(level) {
        if (level >= 90) return 'green';
        if (level >= 80) return 'arcoblue';
        if (level >= 65) return 'orange';
        return 'gray';
      }

      var BAR_COLORS = {
        sky:     { line: '#0ea5e9', soft: 'rgba(14,165,233,.16)' },
        indigo:  { line: '#6366f1', soft: 'rgba(99,102,241,.16)' },
        emerald: { line: '#10b981', soft: 'rgba(16,185,129,.16)' },
        amber:   { line: '#f59e0b', soft: 'rgba(245,158,11,.16)' },
        violet:  { line: '#8b5cf6', soft: 'rgba(139,92,246,.16)' },
        rose:    { line: '#f43f5e', soft: 'rgba(244,63,94,.16)' }
      };
      function barColor(name) { return BAR_COLORS[name] || BAR_COLORS.sky; }

      /* ---------------- 能力雷达图 ---------------- */
      var RADAR = { size: 300, cx: 150, cy: 150, r: 96 };
      var radar = computed(function () {
        var groups = CONFIG.skillGroups;
        var n = groups.length;
        if (n < 3) return null;
        var values = groups.map(function (g) {
          if (!g.skills.length) return 0;
          return Math.round(g.skills.reduce(function (a, s) { return a + s.level; }, 0) / g.skills.length);
        });
        function point(i, radius) {
          var angle = (-90 + (360 / n) * i) * (Math.PI / 180);
          return { x: RADAR.cx + Math.cos(angle) * radius, y: RADAR.cy + Math.sin(angle) * radius };
        }
        var axes = [], labels = [];
        for (var i = 0; i < n; i++) {
          var outer = point(i, RADAR.r);
          axes.push({ x1: RADAR.cx, y1: RADAR.cy, x2: outer.x, y2: outer.y });
          var lp = point(i, RADAR.r + 26);
          labels.push({
            x: lp.x, y: lp.y, text: groups[i].title, value: values[i],
            anchor: lp.x > RADAR.cx + 4 ? 'start' : (lp.x < RADAR.cx - 4 ? 'end' : 'middle')
          });
        }
        function polygonByLevel(level) {
          var pts = [];
          for (var j = 0; j < n; j++) {
            var p = point(j, RADAR.r * (level / 100));
            pts.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
          }
          return pts.join(' ');
        }
        return {
          rings: [25, 50, 75, 100].map(polygonByLevel),
          axes: axes,
          labels: labels,
          dataPoints: values.map(function (v, idx) {
            var p = point(idx, RADAR.r * (v / 100));
            return p.x.toFixed(1) + ',' + p.y.toFixed(1);
          }).join(' '),
          dots: values.map(function (v, idx) { return point(idx, RADAR.r * (v / 100)); })
        };
      });

      /* ---------------- 身份关键词轮换 ---------------- */
      var roleIndex = ref(0);
      var roleTimer = null;
      var spyObserver = null;
      var year = new Date().getFullYear();

      onMounted(function () {
        applyTheme(theme.value);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        if (meta.roles.length > 1) {
          roleTimer = setInterval(function () {
            roleIndex.value = (roleIndex.value + 1) % meta.roles.length;
          }, 3000);
        }
        if ('IntersectionObserver' in window) {
          spyObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) activeSection.value = e.target.id; });
          }, { rootMargin: '-45% 0px -50% 0px' });
          CONFIG.nav.forEach(function (n) {
            var el = document.getElementById(n.id);
            if (el) spyObserver.observe(el);
          });
        }
      });

      onUnmounted(function () {
        window.removeEventListener('scroll', onScroll);
        clearInterval(roleTimer);
        if (spyObserver) spyObserver.disconnect();
      });

      return {
        meta: meta, nav: CONFIG.nav, social: CONFIG.social,
        stats: CONFIG.stats, skillGroups: CONFIG.skillGroups, toolStack: CONFIG.toolStack,
        timeline: CONFIG.timeline, projects: CONFIG.projects,
        education: CONFIG.education, honors: CONFIG.honors, strengths: CONFIG.strengths,
        scrolled: scrolled, showTop: showTop, activeSection: activeSection, menuOpen: menuOpen,
        jump: jump, toTop: toTop, navActive: navActive,
        theme: theme, toggleTheme: toggleTheme,
        copyPhone: copyPhone, toast: toast,
        levelLabel: levelLabel, levelTagColor: levelTagColor,
        weeklyTeaser: weeklyTeaser, weeklyReady: weeklyReady,
        weeklyTotal: weeklyTotal, ghIssue: ghIssue, barColor: barColor,
        radar: radar, roleIndex: roleIndex, year: year
      };
    }
  });

  /* ================= Arco 组件注册 ================= */
  if (ARCO) {
    app.use(ARCO);
    // UMD 的导出名不带 a- 前缀，这里补注册模板里使用的 kebab 别名
    var aliasMap = {
      'a-button': 'Button', 'a-link': 'Link', 'a-tag': 'Tag', 'a-divider': 'Divider',
      'a-avatar': 'Avatar', 'a-space': 'Space', 'a-tooltip': 'Tooltip', 'a-popover': 'Popover',
      'a-timeline': 'Timeline', 'a-timeline-item': 'TimelineItem',
      'a-collapse': 'Collapse', 'a-collapse-item': 'CollapseItem',
      'a-drawer': 'Drawer', 'a-card': 'Card', 'a-progress': 'Progress'
    };
    Object.keys(aliasMap).forEach(function (alias) {
      var comp = ARCO[aliasMap[alias]];
      if (comp) app.component(alias, comp);
    });
  } else {
    console.error('[site] 未找到 ArcoVue，请确认 vendor/arco-vue.min.js 已加载。');
  }

  /* ================= 指令：滚动入场 ================= */
  var revealObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-visible');
          revealObserver.unobserve(e.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' })
    : null;

  app.directive('reveal', {
    mounted: function (el, binding) {
      el.classList.add('reveal');
      if (binding.value) el.style.transitionDelay = binding.value + 'ms';
      if (!revealObserver) { el.classList.add('is-visible'); return; }
      revealObserver.observe(el);
    },
    unmounted: function (el) { if (revealObserver) revealObserver.unobserve(el); }
  });

  /* ================= 指令：数字滚动计数 ================= */
  app.directive('count', {
    mounted: function (el, binding) {
      if (!(binding.value > 0)) return;
      function ease(t) { return 1 - Math.pow(1 - t, 3); }
      function run() {
        var target = binding.value, startTs = null, dur = 1200;
        function frame(ts) {
          if (startTs === null) startTs = ts;
          var p = Math.min(1, (ts - startTs) / dur);
          el.textContent = String(Math.round(target * ease(p)));
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }
      if (!('IntersectionObserver' in window)) { run(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.disconnect();
          setTimeout(run, 120);
        });
      }, { threshold: 0.4 });
      io.observe(el);
    }
  });

  /* ================= 指令：光标聚光 ================= */
  app.directive('spotlight', {
    mounted: function (el) {
      el.classList.add('spot');
      function move(e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
      el._spotMove = move;
      el.addEventListener('pointermove', move);
    },
    unmounted: function (el) {
      if (el._spotMove) el.removeEventListener('pointermove', el._spotMove);
    }
  });

  app.mount('#app');
})();
