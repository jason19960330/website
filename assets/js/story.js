/**
 * ============================================================================
 *  story.js —— 事件详情 / 条目详情页（story.html）逻辑层
 * ============================================================================
 *  两种进入方式：
 *    ?id=<publicId>    热点事件详情：拉公开只读接口的 /api/v1/stories/{id}，
 *                      拿 AI 综述、报道时间线与事件记录（匿名、免密钥、允许跨域）。
 *    ?item=<itemId>    精选条目详情：直接用本地数据文件里已同步的那一条，
 *                      展示中文摘要、推荐理由与同期相关内容。
 *
 *  两级兜底：
 *    1. 本地 assets/js/hot-data.js（仓库每 3 小时自动同步）用于标题/信源/原文链接
 *       的兜底，也保证 file:// 预渲染与无网络时页面不空白；
 *    2. 接口拉不到（离线、限流、事件已归档）时，退回本地热点榜那条记录展示。
 *
 *  合规：页面不出现数据源站名与 Logo；每条报道保留并展示原文链接与信源名。
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;
  if (!VueNS) { console.error('[story] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';
  var API_BASE = 'https://aihot.news';

  var CAT_LABEL = {
    'ai-models': '模型', 'model': '模型',
    'ai-products': '产品', 'product': '产品',
    'industry': '行业',
    'paper': '论文', 'research': '论文',
    'tip': '观点', 'opinion': '观点', 'tutorial': '教程'
  };

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function relTime(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '';
    var h = Math.floor(diff / 3600000);
    if (h < 1) return Math.max(1, Math.floor(diff / 60000)) + ' 分钟前';
    if (h < 24) return h + ' 小时前';
    return Math.floor(h / 24) + ' 天前';
  }
  function shortName(name) {
    if (!name) return '';
    return String(name).replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim().slice(0, 22);
  }

  function param(key) {
    try {
      var m = location.search.match(new RegExp('[?&]' + key + '=([^&#]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  var app = VueNS.createApp({
    setup: function () {
      var ref = VueNS.ref;
      var computed = VueNS.computed;

      /* ---------------- 主题 ---------------- */
      var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      document.body.setAttribute('arco-theme', theme.value);
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', theme.value === 'dark');
        document.body.setAttribute('arco-theme', theme.value);
        try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
      }

      /* ---------------- 入口参数 ---------------- */
      var storyId = param('id');
      var itemId = param('item');
      var mode = ref(storyId ? 'story' : (itemId ? 'item' : ''));

      /* ---------------- 本地数据 ---------------- */
      var raw = window.__HOT_DATA__ || null;
      var localItems = (raw && Array.isArray(raw.items)) ? raw.items : [];
      var localTopics = (raw && Array.isArray(raw.topics)) ? raw.topics : [];

      var item = ref(null);
      var topic = ref(null);

      if (mode.value === 'item') {
        for (var i = 0; i < localItems.length; i++) {
          if (localItems[i].id === itemId) { item.value = localItems[i]; break; }
        }
      } else if (mode.value === 'story') {
        for (var j = 0; j < localTopics.length; j++) {
          if (localTopics[j].storyId === storyId) { topic.value = localTopics[j]; break; }
        }
      }

      /* ---------------- 事件详情 ----------------
       * 主数据来自同步期写好的 assets/js/hot-stories.js（每 3 小时随仓库自动同步），
       * 这样详情页是纯静态的：无网络、被限流、事件归档都能正常打开，秒开。
       * 联网时再静默拉一次接口把内容刷新到最新，失败也不影响已渲染的内容。
       */
      var story = ref({
        status: '', sourceCount: 0, reportCount: 0,
        firstReportAt: null, latestAt: null, latest: '',
        digest: '', digestAt: '', reports: []
      });
      var loading = ref(false);
      var asc = ref(false);
      var stale = ref(false); // 本地数据偏旧时提示

      function applyStory(s) {
        if (!s) return false;
        story.value = {
          status: s.status || '',
          sourceCount: s.sourceCount || 0,
          reportCount: s.reportCount || (Array.isArray(s.reports) ? s.reports.length : 0),
          firstReportAt: s.firstReportAt || null,
          latestAt: s.latestAt || null,
          latest: s.latest || '',
          digest: s.digest || '',
          digestAt: relTime(s.digestUpdatedAt) ? relTime(s.digestUpdatedAt) + '更新' : '',
          reports: (Array.isArray(s.reports) ? s.reports : []).map(function (r) {
            return {
              id: r.id,
              title: r.title,
              summary: r.summary || '',
              sourceName: r.sourceName || (r.source && r.source.name) || '',
              firstParty: !!(r.source && r.source.firstParty),
              publishedAt: r.publishedAt || null,
              url: r.url || (r.links && r.links.original) || ''
            };
          })
        };
        return true;
      }

      var localStories = (window.__HOT_STORIES__ && window.__HOT_STORIES__.stories) || {};
      var localUpdated = (window.__HOT_STORIES__ && window.__HOT_STORIES__.updatedAt) || '';
      var hasLocal = mode.value === 'story' && applyStory(localStories[storyId]);

      if (mode.value === 'story') {
        if (!hasLocal) {
          // 本地没有（事件刚上榜、尚未同步）：现场拉一次，失败则用热点榜那条兜底
          loading.value = true;
        }
        if (location.protocol !== 'file:' && typeof fetch === 'function') {
          fetch(API_BASE + '/api/v1/stories/' + encodeURIComponent(storyId))
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
            .then(function (j) { if (j && j.story) applyStory(j.story); })
            .catch(function () { /* 离线或限流：保留本地已渲染内容 */ })
            .then(function () { loading.value = false; });
        } else {
          loading.value = false;
        }
        stale.value = !!(localUpdated && Date.now() - new Date(localUpdated).getTime() > 6 * 3600 * 1000);
      }

      /* ---------------- 派生数据 ---------------- */
      var found = computed(function () {
        if (!mode.value) return false;
        if (mode.value === 'item') return !!item.value;
        return !!topic.value || !!story.value.digest || story.value.reports.length > 0;
      });

      var title = computed(function () {
        if (mode.value === 'item' && item.value) return item.value.title;
        return (topic.value && topic.value.title) || '';
      });

      var sourceName = computed(function () {
        if (mode.value === 'item' && item.value) return item.value.sourceName;
        return (topic.value && topic.value.sourceName) || '';
      });

      var originUrl = computed(function () {
        if (mode.value === 'item' && item.value) return item.value.url;
        return (topic.value && topic.value.url) || '';
      });

      var reportCount = computed(function () {
        if (story.value.reportCount) return story.value.reportCount;
        return (topic.value && topic.value.sourceCount) || 0;
      });
      var sourceCount = computed(function () {
        if (story.value.sourceCount) return story.value.sourceCount;
        return (topic.value && topic.value.sourceCount) || 0;
      });

      var whenLabel = computed(function () {
        if (mode.value === 'item' && item.value) {
          var d = fmtDateTime(item.value.publishedAt);
          var r = relTime(item.value.publishedAt);
          return r ? d + ' · ' + r : d;
        }
        var t = story.value.latestAt || (topic.value && topic.value.latestAt);
        return t ? relTime(t) : '';
      });

      var digest = computed(function () {
        if (mode.value === 'item') return '';
        return story.value.digest || ((topic.value && topic.value.title) ? '' : '');
      });
      var digestAt = computed(function () { return story.value.digestAt; });

      var reports = computed(function () { return story.value.reports; });
      var sortedReports = computed(function () {
        var list = reports.value.slice();
        list.sort(function (a, b) {
          var ta = new Date(a.publishedAt || 0).getTime();
          var tb = new Date(b.publishedAt || 0).getTime();
          return asc.value ? ta - tb : tb - ta;
        });
        return list;
      });

      /* 同期相关：同分类、同日的其它精选条目，最多 6 条 */
      var related = computed(function () {
        if (!item.value) return [];
        var self = item.value;
        var dayKey = function (iso) {
          var d = new Date(iso);
          return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        };
        var sameDay = localItems.filter(function (x) {
          return x.id !== self.id && dayKey(x.publishedAt) === dayKey(self.publishedAt);
        });
        var pool = sameDay.length >= 4 ? sameDay : localItems.filter(function (x) {
          return x.id !== self.id && x.category === self.category;
        });
        return pool.slice(0, 6);
      });

      return {
        theme: theme, toggleTheme: toggleTheme,
        mode: mode, loading: loading, found: found, asc: asc, stale: stale,
        item: item, story: story, title: title, digest: digest, digestAt: digestAt,
        sourceName: sourceName, originUrl: originUrl,
        reportCount: reportCount, sourceCount: sourceCount, whenLabel: whenLabel,
        reports: reports, sortedReports: sortedReports, related: related,
        fmtDateTime: fmtDateTime, relTime: relTime, shortName: shortName,
        catLabel: function (k) { return CAT_LABEL[k] || '其它'; }
      };
    }
  });

  app.mount('#story-app');
})();
