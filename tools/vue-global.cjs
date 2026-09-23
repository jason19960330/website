/**
 * ============================================================================
 *  vue-global.cjs —— 让第二个 bundle 复用页面已有的 Vue，而不是再打一份进去
 * ============================================================================
 *  arco-bundle.js 已经把 Vue 完整版打进去并挂到 window.Vue。
 *  v-calendar 的 bundle 若自己再 import 'vue'，会重复打包 100+ KB。
 *
 *  做法：build.mjs 打包日历时把 'vue' alias 到本文件。本文件是 CommonJS，
 *  esbuild 遇到 ESM 里的 `import { ref } from 'vue'` 会在运行时从
 *  module.exports（即 window.Vue）上取同名属性 —— 于是共享同一份 Vue。
 *
 *  前提：页面上必须先加载 vendor/arco-bundle.js（提供 window.Vue）。
 * ============================================================================
 */
module.exports = window.Vue;
