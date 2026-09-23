/**
 * ============================================================================
 *  calendar-entry.js —— v-calendar 打包入口（由 tools/build.mjs 用 esbuild 打包）
 * ============================================================================
 *  产出 vendor/calendar-bundle.js + vendor/calendar-bundle.css：
 *    window.VCalendar = { Calendar }
 *
 *  只取 Calendar（不要 DatePicker / Popover），尽量减小体积。
 *  'vue' 被 alias 到 tools/vue-global.cjs，复用 arco-bundle.js 里的同一份 Vue，
 *  因此本文件必须在 arco-bundle.js 之后加载。
 *
 *  页面用法（in-DOM 模板）：
 *    app.component('VCalendar', window.VCalendar.Calendar)
 *    <v-calendar :attributes="attrs" />
 * ============================================================================
 */
import { Calendar } from 'v-calendar';
import 'v-calendar/style.css';

window.VCalendar = { Calendar: Calendar };
