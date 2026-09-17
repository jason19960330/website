/**
 * ============================================================================
 *  app.js —— 站点逻辑层
 * ============================================================================
 *  职责：只处理「行为」，不含任何内容数据（内容全在 data.js）
 *        1. 滚动状态 / 导航高亮（scroll spy）
 *        2. 入场动画指令 v-reveal、数字滚动指令 v-count
 *        3. GitHub 实时数据拉取（失败自动降级为静态值）
 *        4. 能力雷达图的 SVG 坐标计算
 *        5. 邮箱复制、移动端菜单、返回顶部
 * ============================================================================
 */
(function () {
  'use strict';

  // vue.global.prod.js 只暴露全局 Vue 对象，按需取出所需 API
  var VueNS = window.Vue;
  if (!VueNS) {
    console.error('[site] 未找到 Vue，请确认 vendor/vue.global.prod.js 已正确加载。');
    return;
  }
  var createApp = VueNS.createApp;
  var ref = VueNS.ref;
  var computed = VueNS.computed;
  var onMounted = VueNS.onMounted;
  var onUnmounted = VueNS.onUnmounted;

  var CONFIG = window.SITE_CONFIG;
  if (!CONFIG) {
    console.error('[site] 未找到 SITE_CONFIG，请确认 assets/js/data.js 已正确加载。');
    return;
  }

  var app = createApp({
    setup: function () {
      var meta = CONFIG.meta;

      /* ---------------- 滚动状态 ---------------- */
      var scrolled = ref(false);
      var showTop = ref(false);
      var activeSection = ref(CONFIG.nav[0].id);
      var menuOpen = ref(false);
      var draftHidden = ref(false);

      function onScroll() {
        var y = window.scrollY || document.documentElement.scrollTop;
        scrolled.value = y > 8;
        showTop.value = y > 640;
        if (menuOpen.value) menuOpen.value = false;
      }

      function jump(id) {
        menuOpen.value = false;
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      function toTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

      /* ---------------- 邮箱复制 ---------------- */
      var copied = ref(false);
      var copyTimer = null;
      function copyEmail() {
        var mail = meta.email;
        var done = function () {
          copied.value = true;
          clearTimeout(copyTimer);
          copyTimer = setTimeout(function () { copied.value = false; }, 1800);
        };
        // navigator.clipboard 在非 HTTPS 环境可能不可用，保留兜底方案
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(mail).then(done, fallback);
        } else {
          fallback();
        }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = mail;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* 静默失败 */ }
          document.body.removeChild(ta);
        }
      }

      /* ---------------- GitHub 实时数据 ---------------- */
      var gh = ref({ ready: false, ok: false, repos: 0, followers: 0, languages: [] });

      function readCache() {
        try {
          var raw = localStorage.getItem('site.gh.' + CONFIG.github.username);
          if (!raw) return null;
          var box = JSON.parse(raw);
          if (Date.now() - box.time > CONFIG.github.cacheMinutes * 60000) return null;
          return box.data;
        } catch (e) { return null; }
      }
      function writeCache(data) {
        try {
          localStorage.setItem('site.gh.' + CONFIG.github.username,
            JSON.stringify({ time: Date.now(), data: data }));
        } catch (e) { /* 隐私模式下忽略 */ }
      }

      async function loadGithub() {
        if (!CONFIG.github.enabled) { gh.value = Object.assign(gh.value, { ready: true }); return; }
        var cached = readCache();
        if (cached) { gh.value = Object.assign({ ready: true, ok: true }, cached); return; }
        var base = 'https://api.github.com/users/' + CONFIG.github.username;
        try {
          var ctrl = new AbortController();
          var timer = setTimeout(function () { ctrl.abort(); }, 7000);
          var userRes = await fetch(base, { signal: ctrl.signal });
          if (!userRes.ok) throw new Error('HTTP ' + userRes.status);
          var user = await userRes.json();
          var repoRes = await fetch(base + '/repos?per_page=100&sort=updated', { signal: ctrl.signal });
          var repos = repoRes.ok ? await repoRes.json() : [];
          clearTimeout(timer);

          // 统计语言占比（去重：每个仓库只计一次主语言）
          var tally = {}, total = 0;
          (Array.isArray(repos) ? repos : []).forEach(function (r) {
            if (!r.language) return;
            tally[r.language] = (tally[r.language] || 0) + 1;
            total += 1;
          });
          var languages = Object.keys(tally)
            .map(function (name) {
              return { name: name, percent: Math.round((tally[name] / total) * 100), count: tally[name] };
            })
            .sort(function (a, b) { return b.percent - a.percent; })
            .slice(0, 6);

          var data = { repos: user.public_repos, followers: user.followers, languages: languages };
          writeCache(data);
          gh.value = Object.assign({ ready: true, ok: true }, data);
        } catch (err) {
          // 网络异常 / 接口限流 → 使用 data.js 中的静态值，不影响页面
          console.info('[site] GitHub 数据拉取失败，已回退到静态数值：', err.message);
          gh.value = Object.assign(gh.value, { ready: true, ok: false, languages: [] });
        }
      }

      /* ---------------- 数据概览 ---------------- */
      var stats = computed(function () {
        return CONFIG.stats.map(function (s) {
          var v = (s.live && gh.value.ok && typeof gh.value[s.live] === 'number')
            ? gh.value[s.live]
            : s.value;
          return { label: s.label, suffix: s.suffix || '', live: !!s.live, target: v };
        });
      });
      var liveOnline = computed(function () { return gh.value.ok; });

      /* ---------------- 能力雷达图（SVG 坐标计算） ---------------- */
      var RADAR = { size: 300, cx: 150, cy: 150, r: 96 };

      var radar = computed(function () {
        var groups = CONFIG.skillGroups;
        var n = groups.length;
        if (n < 3) return null;
        var values = groups.map(function (g) {
          if (!g.skills.length) return 0;
          var sum = g.skills.reduce(function (a, s) { return a + s.level; }, 0);
          return Math.round(sum / g.skills.length);
        });

        function point(i, radius) {
          var angle = (-90 + (360 / n) * i) * (Math.PI / 180);
          return {
            x: RADAR.cx + Math.cos(angle) * radius,
            y: RADAR.cy + Math.sin(angle) * radius
          };
        }

        var axes = [], labels = [];
        for (var i = 0; i < n; i++) {
          var outer = point(i, RADAR.r);
          axes.push({ x1: RADAR.cx, y1: RADAR.cy, x2: outer.x, y2: outer.y });
          var labelPos = point(i, RADAR.r + 26);
          labels.push({
            x: labelPos.x,
            y: labelPos.y,
            text: groups[i].title,
            value: values[i],
            anchor: labelPos.x > RADAR.cx + 4 ? 'start' : (labelPos.x < RADAR.cx - 4 ? 'end' : 'middle')
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

        var dataPoints = values.map(function (v, idx) {
          var p = point(idx, RADAR.r * (v / 100));
          return p.x.toFixed(1) + ',' + p.y.toFixed(1);
        }).join(' ');

        return {
          size: RADAR.size,
          rings: [25, 50, 75, 100].map(polygonByLevel),
          axes: axes,
          labels: labels,
          dataPoints: dataPoints,
          dots: values.map(function (v, idx) { return point(idx, RADAR.r * (v / 100)); })
        };
      });

      /* ---------------- GitHub 语言条形图 ---------------- */
      var LANG_COLORS = {
        JavaScript: '#f7df1e', Python: '#3572A5', TypeScript: '#3178c6', Vue: '#41b883',
        HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Jupyter: '#da5b0b',
        Go: '#00ADD8', Rust: '#dea584', Java: '#b07219', C: '#555555', 'C++': '#f34b7d'
      };
      var languages = computed(function () {
        return (gh.value.languages || []).map(function (l) {
          return Object.assign({}, l, { color: LANG_COLORS[l.name] || '#64748b' });
        });
      });

      /* ---------------- 身份关键词轮换 ---------------- */
      var roleIndex = ref(0);
      var roleTimer = null;

      /* ---------------- 技能条颜色映射 ---------------- */
      var BAR_COLORS = {
        sky: { line: 'rgba(56,189,248,.9)', soft: 'rgba(56,189,248,.16)', text: 'text-sky-300' },
        indigo: { line: 'rgba(99,102,241,.9)', soft: 'rgba(99,102,241,.16)', text: 'text-indigo-300' },
        emerald: { line: 'rgba(52,211,153,.9)', soft: 'rgba(52,211,153,.16)', text: 'text-emerald-300' },
        amber: { line: 'rgba(251,191,36,.9)', soft: 'rgba(251,191,36,.16)', text: 'text-amber-300' },
        rose: { line: 'rgba(251,113,133,.9)', soft: 'rgba(251,113,133,.16)', text: 'text-rose-300' },
        violet: { line: 'rgba(167,139,250,.9)', soft: 'rgba(167,139,250,.16)', text: 'text-violet-300' }
      };
      function barColor(name) { return BAR_COLORS[name] || BAR_COLORS.sky; }

      /* ---------------- 示例内容提示条 ---------------- */
      var hasPlaceholder = computed(function () {
        return CONFIG.projects.some(function (p) { return p.placeholder; }) ||
               CONFIG.timeline.some(function (t) { return t.placeholder; }) ||
               CONFIG.posts.some(function (p) { return p.placeholder; });
      });

      function navActive(id) {
        return activeSection.value === id ? 'nav-link is-active' : 'nav-link';
      }

      var year = new Date().getFullYear();

      /* ---------------- 生命周期 ---------------- */
      var spyObserver = null;

      onMounted(function () {
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        loadGithub();

        if (meta.roles.length > 1) {
          roleTimer = setInterval(function () {
            roleIndex.value = (roleIndex.value + 1) % meta.roles.length;
          }, 2800);
        }

        // 导航高亮：当区块进入视口中部时切换
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
        clearTimeout(copyTimer);
        if (spyObserver) spyObserver.disconnect();
      });

      return {
        meta: meta, nav: CONFIG.nav, social: CONFIG.social,
        skillGroups: CONFIG.skillGroups, projects: CONFIG.projects,
        timeline: CONFIG.timeline, posts: CONFIG.posts,
        scrolled: scrolled, showTop: showTop, activeSection: activeSection,
        menuOpen: menuOpen, jump: jump, toTop: toTop, navActive: navActive,
        copyEmail: copyEmail, copied: copied,
        stats: stats, liveOnline: liveOnline, languages: languages,
        radar: radar, roleIndex: roleIndex, barColor: barColor,
        hasPlaceholder: hasPlaceholder, year: year
      };
    }
  });

  /* ================= 指令：滚动入场 ================= */
  var revealObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-visible');
          revealObserver.unobserve(e.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
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
        var target = binding.value, startTs = null, dur = 1100;
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
          run();
        });
      }, { threshold: 0.4 });
      io.observe(el);
    }
  });

  app.mount('#app');
})();
