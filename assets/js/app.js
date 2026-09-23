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

  /* ================= 日历：v-calendar 按需加载 =================
     日历 bundle 有 140KB，没必要跟着首屏下载。等页面滚近 #calendar 板块
     才插 script，注册完组件再把 calReady 置 true，模板随即渲染。
     注意 'vue' 在打包时被 alias 成取 window.Vue，所以 arco-bundle 必须先加载完。 */
  var calReady = ref(false);
  var calFailed = ref(false);
  var calLoading = false;

  function loadCalendar() {
    if (calReady.value || calFailed.value || calLoading) return;
    // v-calendar 内部用 ResizeObserver 做尺寸自适应；老内核（Safari < 13.1）
    // 与 jsdom 都没有，缺了会直接抛 ReferenceError，这里兜一个空实现
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = function () {
        this.observe = function () {};
        this.unobserve = function () {};
        this.disconnect = function () {};
      };
    }
    calLoading = true;
    if (!document.querySelector('link[data-cal-css]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'vendor/calendar-bundle.css';
      link.setAttribute('data-cal-css', '1');
      document.head.appendChild(link);
    }
    var s = document.createElement('script');
    s.src = 'vendor/calendar-bundle.js';
    s.onload = function () {
      var VC = window.VCalendar;
      var Comp = VC && (VC.Calendar || (VC.default && VC.default.Calendar));
      if (Comp) {
        app.component('VCalendar', Comp);
        app.component('v-calendar', Comp);   // in-DOM 模板里写的是 kebab
        calReady.value = true;
      } else {
        calFailed.value = true;
      }
      calLoading = false;
    };
    s.onerror = function () { calFailed.value = true; calLoading = false; };
    document.body.appendChild(s);
  }

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
        if (!el) return;
        // scrollIntoView 在个别环境（jsdom / 老内核）不存在，降级为 scrollTo，避免抛错
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: el.getBoundingClientRect().top + (window.scrollY || 0) - 8, behavior: 'smooth' });
        }
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

      /* ---------------- 日历板块 ---------------- */
      var calToday = new Date();
      calToday.setHours(0, 0, 0, 0);
      var calPage = ref({ month: calToday.getMonth() + 1, year: calToday.getFullYear() });
      // v-calendar 的 title 用 date-fns 的 token；weekdays 是它自定义的 W/WW/WWWW。
      // 周起始日：v-calendar 的 firstDayOfWeek 值域是 1~7，且 1 = 周日，所以周一要写 2
      var calLocale = { id: 'zh-CN', firstDayOfWeek: 2, masks: { title: 'YYYY 年 M 月', weekdays: 'WW' } };
      var calMinDate = new Date(calToday.getFullYear() - 3, 0, 1);
      var calMaxDate = new Date(calToday.getFullYear() + 1, 11, 31);

      function pad2(n) { return String(n).padStart(2, '0'); }
      function ymKey(date) { return date.getFullYear() + '-' + pad2(date.getMonth() + 1); }
      function ymdKey(date) { return ymKey(date) + '-' + pad2(date.getDate()); }

      // 周刊按月聚合：'2026-09' -> [issue, ...]
      var calMonthMap = {};
      if (weeklyReady) {
        WEEKLY.issues.forEach(function (it) {
          if (!it.ym) return;
          (calMonthMap[it.ym] = calMonthMap[it.ym] || []).push(it);
        });
      }

      // 可约面时间：从 7 天后起 8 周内的工作日（周一至周五）
      var interviewDates = (function () {
        var out = [];
        for (var i = 7; i <= 62; i++) {
          var d = new Date(calToday);
          d.setDate(calToday.getDate() + i);
          var w = d.getDay();
          if (w >= 1 && w <= 5) out.push(d);
        }
        return out;
      })();
      function isInterviewDate(date) {
        var t = new Date(date);
        t.setHours(0, 0, 0, 0);
        var key = t.getTime();
        return interviewDates.some(function (d) { return d.getTime() === key; });
      }

      var calAttrs = computed(function () {
        var list = [{
          key: 'interview',
          highlight: { color: 'green', fillMode: 'light' },
          dates: interviewDates,
          popover: { label: '工作日 · 可约面，点击发邮件', visibility: 'hover' }
        }];
        Object.keys(calMonthMap).forEach(function (ym) {
          var parts = ym.split('-');
          var y = parseInt(parts[0], 10);
          var m = parseInt(parts[1], 10);
          var count = calMonthMap[ym].length;
          list.push({
            key: 'weekly-' + ym,
            dot: { color: 'blue' },
            dates: new Date(y, m - 1, 1),
            popover: { label: y + ' 年 ' + m + ' 月发布 ' + count + ' 期', visibility: 'hover' }
          });
        });
        return list;
      });

      var calMonthIssues = computed(function () {
        return calMonthMap[calPage.value.year + '-' + pad2(calPage.value.month)] || [];
      });
      var calMonthLabel = computed(function () {
        return calPage.value.year + ' 年 ' + calPage.value.month + ' 月';
      });
      var calMonthSummary = computed(function () {
        var n = calMonthIssues.value.length;
        return n ? '本月发布 ' + n + ' 期周刊' : '本月没有周刊发布记录';
      });

      // 翻月：payload 是 pages 数组，取第一个
      function onCalPages(pages) {
        var p = Array.isArray(pages) ? pages[0] : pages;
        if (p && p.year) calPage.value = { month: p.month, year: p.year };
      }

      function onDayClick(day) {
        var raw = day && day.date ? day.date : day;
        var d = raw instanceof Date ? raw : (raw ? new Date(raw) : null);
        if (!d || isNaN(d.getTime())) return;
        if (isInterviewDate(d)) {
          var dateText = ymdKey(d);
          var subject = encodeURIComponent('面试邀约 · ' + dateText);
          var body = encodeURIComponent(
            '你好 ' + meta.name + '，\n\n希望约在 ' + dateText + ' 沟通，方便的时间段是：\n\n'
          );
          window.location.href = 'mailto:' + meta.email + '?subject=' + subject + '&body=' + body;
          toast('已打开邮件客户端，日期：' + dateText);
          return;
        }
        var n = calMonthIssues.value.length;
        toast(n ? ymKey(d) + ' 共发布 ' + n + ' 期周刊' : ymKey(d) + ' 暂无记录');
      }

      /* ---------------- 全站搜索 ---------------- */
      // 索引来源：站点板块 / 经历 / 项目 / 技能 / 教育 / 证书 + 页级入口 + 全部周刊标题。
      // 全部在浏览器内存里检索，无需后端；周刊索引由 tools/sync_weekly.py 每日更新。
      var SECTION_DESC = {
        home:      '个人概览 · 求职意向 · 联系方式速览',
        about:     '自我介绍 · 核心数据 · 核心优势',
        skills:    '技能矩阵 · 能力雷达图 · 工具栈',
        timeline:  '晖致医药 IT 技术支持 · 工作经历明细',
        projects:  '资产台账规范化 · 终端资产运营 · 新零售交付',
        education: '中国农业大学 · 华北理工大学迁安学院 · 证书荣誉',
        calendar:  '更新日历 · 周刊发布节奏 · 可约面工作日',
        contact:   '邮箱 · 电话 · 社交链接'
      };

      // 同类结果之间的排序倾向：板块 / 页面 > 经历 > 项目 > 技能 / 教育 / 关于
      // （分值之外的加权，避免「技能」这类词被大量技能条目压过导航入口）
      var GROUP_WEIGHT = { '本站': 6, '页面': 6, '经历': 3, '项目': 1, '技能': 1, '教育': 1, '关于': 1, '周刊': 0 };

      var searchDocs = (function () {
        var list = [];
        function add(d) {
          if (!d.title) return;
          d.hay = (d.title + ' ' + (d.desc || '') + ' ' + (d.kw || '')).toLowerCase();
          d.w = GROUP_WEIGHT[d.group] || 0;
          list.push(d);
        }

        // 1) 板块快捷入口（空关键词时作为默认推荐，命中后滚动到对应板块）
        CONFIG.nav.forEach(function (n) {
          add({ kind: 'section', group: '本站', badge: '板块', title: n.label, desc: SECTION_DESC[n.id] || '', section: n.id });
        });
        // 2) 独立页面
        add({ kind: 'page', group: '页面', badge: '页面', title: '个人简历（完整版）', desc: '一页式简历 · 支持打印 / 导出 PDF · 与首页同源', href: 'resume.html' });
        add({ kind: 'page', group: '页面', badge: '页面', title: '科技爱好者周刊归档',
              desc: '最近 20 期完整条目，支持全量 ' + weeklyTotal + ' 期按标题与期号检索', href: 'weekly.html' });

        // 3) 内容条目：命中后跳到所属板块
        CONFIG.timeline.forEach(function (t) {
          add({ kind: 'site', group: '经历', badge: t.org, title: t.role + ' · ' + t.org,
                desc: t.summary + ' ' + t.points.join(' '), section: 'timeline' });
        });
        CONFIG.projects.forEach(function (p) {
          add({ kind: 'site', group: '项目', badge: p.period, title: p.name,
                desc: p.summary + ' ' + p.details.join(' '), section: 'projects' });
        });
        CONFIG.skillGroups.forEach(function (g) {
          g.skills.forEach(function (s) {
            add({ kind: 'site', group: '技能', badge: g.title, title: s.name,
                  desc: g.title + ' · ' + g.desc + ' · ' + levelLabel(s.level), section: 'skills' });
          });
        });
        CONFIG.toolStack.forEach(function (cat) {
          cat.items.forEach(function (item) {
            add({ kind: 'site', group: '技能', badge: '工具栈', title: item, desc: cat.title + ' · 日常在用工具', section: 'skills' });
          });
        });
        CONFIG.strengths.forEach(function (s) {
          add({ kind: 'site', group: '关于', badge: '核心优势', title: s.title, desc: s.desc, section: 'about' });
        });
        CONFIG.education.forEach(function (e) {
          add({ kind: 'site', group: '教育', badge: e.degree, title: e.school,
                desc: e.major + ' · ' + e.degree + (e.note ? ' · ' + e.note : '') + ' · ' + e.period, section: 'education' });
        });
        CONFIG.honors.forEach(function (h) {
          add({ kind: 'site', group: '教育', badge: '证书荣誉', title: h, desc: '证书与荣誉', section: 'education' });
        });

        // 4) 周刊：期号 + 标题
        if (weeklyReady) {
          WEEKLY.issues.forEach(function (it) {
            add({ kind: 'weekly', group: '周刊', badge: '#' + it.n, n: it.n,
                  title: (it.title || '').replace(/^第?\s*\d+\s*期[：:·\-\s]*/, '') || ('第 ' + it.n + ' 期'),
                  desc: '科技爱好者周刊 · ' + it.ym + ' · 第 ' + it.n + ' 期',
                  kw: 'weekly 科技爱好者周刊 ruanyf issue-' + it.n + ' ' + it.n,
                  href: ghIssue(it.n), external: true });
          });
        }
        return list;
      })();

      // 空关键词时展示的快捷入口（板块 + 独立页面）
      var quickLinks = searchDocs.filter(function (d) { return d.kind === 'section' || d.kind === 'page'; });

      function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
      function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
      }
      // 先转义再高亮，避免 weekly 标题里的特殊字符破坏结构
      function hl(text, terms) {
        var out = escapeHtml(text);
        if (!terms.length) return out;
        try {
          return out.replace(new RegExp('(' + terms.map(escRe).join('|') + ')', 'gi'), '<mark class="search-mark">$1</mark>');
        } catch (e) { return out; }
      }
      // 摘要：从命中位置附近截一段，前后加省略号
      function snippet(text, terms) {
        if (!text) return '';
        var low = text.toLowerCase(), pos = -1;
        terms.forEach(function (t) {
          var p = low.indexOf(t);
          if (p >= 0 && (pos < 0 || p < pos)) pos = p;
        });
        var start = pos > 24 ? pos - 24 : 0;
        var cut = text.slice(start, start + 96);
        if (start > 0) cut = '…' + cut;
        if (start + 96 < text.length) cut = cut + '…';
        return hl(cut, terms);
      }
      function scoreOf(doc, terms) {
        var title = doc.title.toLowerCase(), desc = (doc.desc || '').toLowerCase(), total = 0;
        for (var i = 0; i < terms.length; i++) {
          var t = terms[i], ti = title.indexOf(t), di = desc.indexOf(t), kw = (doc.kw || '').indexOf(t);
          if (ti < 0 && di < 0 && kw < 0) return 0;             // 有一个词没命中就整条淘汰（AND）
          if (ti === 0) total += 14; else if (ti > 0) total += 7;
          if (di >= 0) total += 2;
          if (kw >= 0) total += 3;
        }
        return total + (doc.w || 0);
      }

      var query = ref('');
      var searchOpen = ref(false);
      var activeIndex = ref(0);
      var searchBox = ref(null);
      var searchInput = ref(null);
      var mobileInput = ref(null);

      var searchState = computed(function () {
        var terms = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        var empty = { terms: [], site: [], weekly: [], flat: [], weeklyTotal: 0 };
        if (!terms.length) return empty;

        var scored = [];
        searchDocs.forEach(function (d) {
          var s = scoreOf(d, terms);
          if (s > 0) scored.push({ doc: d, score: s });
        });
        scored.sort(function (a, b) { return b.score - a.score || a.doc.title.length - b.doc.title.length; });

        function decorate(item) {
          var d = item.doc;
          return {
            key: d.kind + ':' + (d.href || d.title),
            titleHtml: hl(d.title, terms),
            descHtml: snippet(d.desc, terms),
            badge: d.badge || '',
            doc: d
          };
        }
        // 分组配额：下拉最多各 8 条，避免周刊 400+ 条把本站结果全挤掉
        var site = [], weekly = [], weeklyTotal = 0;
        scored.forEach(function (it) {
          if (it.doc.kind === 'weekly') {
            weeklyTotal++;
            if (weekly.length < 8) weekly.push(decorate(it));
          } else if (site.length < 8) {
            site.push(decorate(it));
          }
        });
        return { terms: terms, site: site, weekly: weekly, flat: site.concat(weekly), weeklyTotal: weeklyTotal };
      });

      function openSearch() {
        searchOpen.value = true;
        activeIndex.value = 0;
        VueNS.nextTick(function () {
          var isNarrow = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
          var el = (isNarrow && mobileInput.value) ? mobileInput.value : searchInput.value;
          if (el && el.offsetParent !== null) el.focus();
        });
      }
      function closeSearch() { searchOpen.value = false; }
      function onQueryInput() { activeIndex.value = 0; searchOpen.value = true; }
      function openResult(r) {
        if (!r) return;
        var d = r.doc;
        closeSearch();
        if (d.href) {
          if (d.external) window.open(d.href, '_blank', 'noopener');
          else window.location.href = d.href;
          return;
        }
        if (d.section) { jump(d.section); flashSection(d.section); }
      }
      // 跳转后让目标板块闪一下，告诉用户「你被带到这里了」
      function flashSection(id) {
        setTimeout(function () {
          var el = document.getElementById(id);
          if (!el) return;
          el.classList.remove('section-flash');
          void el.offsetWidth;                 // 强制回流，保证动画能重复触发
          el.classList.add('section-flash');
          setTimeout(function () { el.classList.remove('section-flash'); }, 2000);
        }, 420);
      }
      function onSearchKey(e) {
        var flat = searchState.value.flat;
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = flat.length ? (activeIndex.value + 1) % flat.length : 0; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = flat.length ? (activeIndex.value - 1 + flat.length) % flat.length : 0; }
        else if (e.key === 'Enter') { if (flat[activeIndex.value]) { e.preventDefault(); openResult(flat[activeIndex.value]); } }
        else if (e.key === 'Escape') { closeSearch(); if (searchInput.value) searchInput.value.blur(); }
      }
      function onDocDown(e) {
        if (!searchOpen.value) return;
        if (searchBox.value && !searchBox.value.contains(e.target)) closeSearch();
      }
      function onGlobalKey(e) {
        var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
        var typing = tag === 'input' || tag === 'textarea';
        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(); return; }
        if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); }
      }
      function activeOf(r) { return searchState.value.flat.indexOf(r) === activeIndex.value; }

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
      var calIo = null;      // 日历 bundle 的懒加载观察器
      var year = new Date().getFullYear();

      onMounted(function () {
        applyTheme(theme.value);
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('pointerdown', onDocDown);
        document.addEventListener('keydown', onGlobalKey);
        onScroll();
        if (meta.roles.length > 1) {
          roleTimer = setInterval(function () {
            roleIndex.value = (roleIndex.value + 1) % meta.roles.length;
          }, 3000);
        }
        // 日历：滚到附近才下载 140KB 的 v-calendar（不支持 IO 就直接加载）
        var calEl = document.getElementById('calendar');
        if (calEl) {
          if ('IntersectionObserver' in window) {
            calIo = new IntersectionObserver(function (entries) {
              entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                loadCalendar();
                      });
            }, { rootMargin: '400px' });
            calIo.observe(calEl);
          } else {
            loadCalendar();
          }
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
        document.removeEventListener('pointerdown', onDocDown);
        document.removeEventListener('keydown', onGlobalKey);
        clearInterval(roleTimer);
        if (spyObserver) spyObserver.disconnect();
        if (calIo) calIo.disconnect();
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
        /* 日历（v-calendar，滚到才加载） */
        calReady: calReady, calFailed: calFailed, calAttrs: calAttrs, calLocale: calLocale,
        calPage: calPage, calMinDate: calMinDate, calMaxDate: calMaxDate,
        calMonthIssues: calMonthIssues, calMonthLabel: calMonthLabel, calMonthSummary: calMonthSummary,
        onCalPages: onCalPages, onDayClick: onDayClick,
        radar: radar, roleIndex: roleIndex, year: year,
        /* 搜索 */
        query: query, searchOpen: searchOpen, activeIndex: activeIndex,
        searchBox: searchBox, searchInput: searchInput, mobileInput: mobileInput,
        searchState: searchState, quickLinks: quickLinks,
        openSearch: openSearch, closeSearch: closeSearch, onQueryInput: onQueryInput,
        openResult: openResult, onSearchKey: onSearchKey, activeOf: activeOf
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
