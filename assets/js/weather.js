/**
 * ============================================================================
 *  weather.js —— 全站顶栏「左上角天气控件」（Meteocons）
 * ============================================================================
 *  图标：Meteocons v2（@meteocons/svg，MIT © Bas Milius）
 *        经 jsDelivr CDN 加载 fill（含 SMIL 动画）版本：
 *        https://cdn.jsdelivr.net/npm/@meteocons/svg/fill/<icon>.svg
 *  数据：GeoJS（IP 定位，免密钥） + Open-Meteo（实时天气，免密钥，CORS 开放）
 *  行为：
 *    1. 定位到站点 header 左上角的 logo 链接，把天气胶囊插到它内部最前面；
 *    2. GeoJS 拿到城市/经纬度 → Open-Meteo 拿到温度/天气码/昼夜；
 *    3. 按 WMO 天气码映射 Meteocons 图标，昼夜自动区分；
 *    4. 结果缓存 localStorage 30 分钟，站内跳页不重复请求；
 *    5. 任何一步失败都静默隐藏，绝不影响页面本身。
 *  样式走站点主题 CSS 变量（--c-*），深浅色自动跟随。
 * ============================================================================
 */
(function () {
  'use strict';

  var CACHE_KEY = 'site.weather';
  var CACHE_TTL = 30 * 60 * 1000; // 30 分钟
  var ICON_BASE = 'https://cdn.jsdelivr.net/npm/@meteocons/svg/fill/';

  /* ---------- WMO weather_code → Meteocons 图标 + 中文 ---------- */
  function wmo(code, isDay) {
    var D = isDay ? 'day' : 'night';
    var map = [
      [0,  'clear-' + D,                       '晴'],
      [1,  'partly-cloudy-' + D,               '大致晴'],
      [2,  'partly-cloudy-' + D,               '多云'],
      [3,  'overcast-' + D,                    '阴'],
      [45, 'fog-' + D,                         '雾'],
      [48, 'fog-' + D,                         '冻雾'],
      [51, 'drizzle',                          '小毛毛雨'],
      [53, 'drizzle',                          '毛毛雨'],
      [55, 'drizzle',                          '大毛毛雨'],
      [56, 'sleet',                            '冻毛毛雨'],
      [57, 'sleet',                            '强冻毛毛雨'],
      [61, 'rain',                             '小雨'],
      [63, 'rain',                             '中雨'],
      [65, 'rain',                             '大雨'],
      [66, 'sleet',                            '冻雨'],
      [67, 'sleet',                            '强冻雨'],
      [71, 'snow',                             '小雪'],
      [73, 'snow',                             '中雪'],
      [75, 'snow',                             '大雪'],
      [77, 'snow',                             '雪粒'],
      [80, 'rain',                             '小阵雨'],
      [81, 'rain',                             '阵雨'],
      [82, 'rain',                             '强阵雨'],
      [85, 'snow',                             '小阵雪'],
      [86, 'snow',                             '阵雪'],
      [95, 'thunderstorms-' + D,               '雷阵雨'],
      [96, 'thunderstorms-hail',               '雷雨伴冰雹'],
      [99, 'thunderstorms-hail',               '强雷雨伴冰雹']
    ];
    for (var i = 0; i < map.length; i++) {
      if (map[i][0] === code) return { icon: map[i][1], text: map[i][2] };
    }
    return { icon: 'not-available', text: '未知' };
  }

  /* ---------- 样式（主题变量驱动，深浅色自动适配） ---------- */
  function injectStyle() {
    var css = ''
      + '.wx-pill{display:inline-flex;align-items:center;gap:.375rem;padding:.25rem .5rem .25rem .3125rem;'
      +   'border-radius:.625rem;border:1px solid rgb(var(--c-hair));background:rgb(var(--c-raise)/.6);'
      +   'font-size:.6875rem;line-height:1;color:rgb(var(--c-dim));text-decoration:none;'
      +   'transition:border-color .2s,color .2s,background-color .2s;white-space:nowrap;cursor:default;}'
      + '.wx-pill:hover{border-color:rgb(var(--c-accent)/.45);color:rgb(var(--c-ink));}'
      + '.wx-pill img.wx-icon{width:1.25rem;height:1.25rem;display:block;}'
      + '.wx-pill .wx-temp{font-weight:600;color:rgb(var(--c-ink));font-variant-numeric:tabular-nums;}'
      + '.wx-pill .wx-city{color:rgb(var(--c-faint));}'
      + '@media (max-width:640px){.wx-pill .wx-desc{display:none;}.wx-pill{padding:.25rem;}}'
      + '@media (prefers-reduced-motion:reduce){.wx-pill img.wx-icon{display:none;}.wx-pill .wx-static-icon{display:inline-block;width:1.25rem;height:1.25rem;}}';
    var s = document.createElement('style');
    s.id = 'wx-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- 把胶囊插进 header 左上角 logo 内部最前面 ---------- */
  function mount() {
    var logo = document.querySelector('.site-header a[href="index.html"]')
            || document.querySelector('.site-header a[href="#home"]');
    var host;
    if (logo) {
      host = logo;
    } else {
      // 兜底：header 容器第一个子元素（避免 justify-between 把胶囊挤到中间）
      var row = document.querySelector('.site-header > div');
      if (!row) return null;
      host = document.createElement('div');
      host.style.cssText = 'display:flex;align-items:center;gap:.625rem;';
      row.insertBefore(host, row.firstChild);
    }
    var pill = document.createElement('span');
    pill.className = 'wx-pill';
    pill.id = 'wx-pill';
    pill.setAttribute('role', 'img');
    pill.setAttribute('aria-label', '实时天气');
    pill.textContent = '天气…';
    // 插到 logo 内部最前：与「WT / 李文涛」共享 gap，天然左上角
    if (logo) logo.insertBefore(pill, logo.firstChild);
    else host.appendChild(pill);
    return pill;
  }

  function render(pill, data) {
    if (!pill) return;
    var t = Math.round(data.temp);
    pill.innerHTML = ''
      + '<img class="wx-icon" alt="' + data.text + '" src="' + ICON_BASE + data.icon + '.svg">'
      + '<span class="wx-desc">'
      +   '<span class="wx-temp">' + t + '°</span>'
      +   '<span class="wx-text"> ' + data.text + '</span>'
      +   (data.city ? '<span class="wx-city"> · ' + data.city + '</span>' : '')
      + '</span>';
    pill.title = data.city + ' · ' + data.text + ' ' + t + '°C'
      + '（体感 ' + Math.round(data.feels) + '°C，湿度 ' + data.humidity + '%，风速 '
      + Math.round(data.wind) + ' km/h）\n数据：Open-Meteo · 图标：Meteocons';
  }

  function fail(pill) {
    if (pill) pill.style.display = 'none'; // 静默退场
  }

  function cacheGet() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) return null;
      return obj;
    } catch (e) { return null; }
  }

  function cacheSet(obj) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function fetchJSON(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('timeout'));
      }, timeoutMs || 8000);
      fetch(url, ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (j) { clearTimeout(timer); resolve(j); })
        .catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function load(pill) {
    var hit = cacheGet();
    if (hit) { render(pill, hit.data); return; }

    // 1. IP 定位（GeoJS，免密钥）
    fetchJSON('https://get.geojs.io/v1/ip/geo.json', 6000)
      .then(function (geo) {
        var lat = parseFloat(geo.latitude), lon = parseFloat(geo.longitude);
        if (!isFinite(lat) || !isFinite(lon)) throw new Error('geo');
        var city = (geo.city && geo.city !== '' ? geo.city : geo.region) || '';
        // 2. 实时天气（Open-Meteo，免密钥）
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat
          + '&longitude=' + lon
          + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m'
          + '&timezone=auto';
        return fetchJSON(url, 8000).then(function (wx) {
          var cur = wx.current || {};
          var m = wmo(cur.weather_code | 0, (cur.is_day | 0) === 1);
          return {
            temp: cur.temperature_2m, feels: cur.apparent_temperature,
            humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
            icon: m.icon, text: m.text, city: city
          };
        });
      })
      .then(function (data) {
        if (typeof data.temp !== 'number') throw new Error('no temp');
        cacheSet({ ts: Date.now(), data: data });
        render(pill, data);
      })
      .catch(function () { fail(pill); });
  }

  /* ---------- 启动 ---------- */
  function start() {
    injectStyle();
    var pill = mount();
    if (!pill) return;
    load(pill);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
