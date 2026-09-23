/**
 * ============================================================================
 *  build.mjs —— 依赖产物构建（node tools/build.mjs）
 * ============================================================================
 *  产出两个文件，都是提交进仓库的静态产物，页面运行时不依赖任何构建工具：
 *
 *    1. vendor/arco-bundle.js  + vendor/arco-bundle.css
 *       只打包页面真正用到的 Arco 组件（见 tools/vendor-entry.js），
 *       并把 Vue 完整版一起打进去，暴露 window.Vue / window.ArcoVue。
 *       取代原来的 vendor/vue.global.prod.js + vendor/arco-vue.min.js + arco.min.css。
 *
 *    2. assets/css/tailwind.css
 *       Tailwind 预编译产物，取代 vendor/tailwind.play.js（浏览器端 JIT 编译器）。
 *
 *  改了 tools/vendor-entry.js 或 tools/tailwind.config.js 后必须重新执行本脚本。
 * ============================================================================
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// 用 CJS require 解析依赖：既支持项目本地 node_modules（`npm i` 后），
// 也支持外部 NODE_PATH 指向的共享目录。ESM 的 import 不认 NODE_PATH。
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function main() {
  /* ---------------- 1. Arco 按需 + Vue ---------------- */
  await build({
    entryPoints: [path.join(root, 'tools/vendor-entry.js')],
    bundle: true,
    format: 'iife',
    target: ['es2018'],
    minify: true,
    legalComments: 'none',
    // esbuild 默认不读 NODE_PATH，显式传进去，才能找到共享目录里的依赖
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    // 入口与 Arco 内部的 `import ... from 'vue'` 统一指向浏览器完整版
    // （含模板编译器；默认的 runtime-only 版本编译不了 in-DOM 模板）
    alias: { vue: 'vue/dist/vue.esm-browser.prod.js' },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: path.join(root, 'vendor/arco-bundle.js'),
    logLevel: 'warning'
  });
  console.log('[build] vendor/arco-bundle.js   ', kb(fs.statSync(path.join(root, 'vendor/arco-bundle.js')).size));
  console.log('[build] vendor/arco-bundle.css  ', kb(fs.statSync(path.join(root, 'vendor/arco-bundle.css')).size));

  /* ---------------- 1.5 v-calendar（仅首页日历用，滚动到才加载） ---------------- */
  // 单独打一个 bundle：resume.html / weekly.html 不加载它。
  // 'vue' 被 alias 到 tools/vue-global.cjs（运行时取 window.Vue），避免重复打包 Vue。
  await build({
    entryPoints: [path.join(root, 'tools/calendar-entry.js')],
    bundle: true,
    format: 'iife',
    target: ['es2018'],
    minify: true,
    legalComments: 'none',
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    alias: { vue: path.join(root, 'tools/vue-global.cjs') },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: path.join(root, 'vendor/calendar-bundle.js'),
    logLevel: 'warning'
  });
  console.log('[build] vendor/calendar-bundle.js', kb(fs.statSync(path.join(root, 'vendor/calendar-bundle.js')).size));
  console.log('[build] vendor/calendar-bundle.css', kb(fs.statSync(path.join(root, 'vendor/calendar-bundle.css')).size));

  /* ---------------- 2. Tailwind 预编译 ---------------- */
  // 用官方 CLI。tailwindcss 只作为 devDependency，产物是纯静态 CSS。
  const twBin = require.resolve('tailwindcss/lib/cli.js');
  execFileSync(process.execPath, [
    twBin,
    '-c', path.join(root, 'tools/tailwind.config.js'),
    '-i', path.join(root, 'tools/tailwind-input.css'),
    '-o', path.join(root, 'assets/css/tailwind.css'),
    '--minify'
  ], { cwd: root, stdio: 'inherit' });
  console.log('[build] assets/css/tailwind.css ', kb(fs.statSync(path.join(root, 'assets/css/tailwind.css')).size));

  /* ---------------- 3. 爬虫可见的静态快照 ---------------- */
  // 必须放在最后：要等前面的 CSS 就绪，jsdom 才能渲染出正确结构
  execFileSync(process.execPath, [path.join(root, 'tools/prerender.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
