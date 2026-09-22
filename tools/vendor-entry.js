/**
 * ============================================================================
 *  vendor-entry.js —— 依赖打包入口（由 tools/build.mjs 用 esbuild 打包）
 * ============================================================================
 *  目的：把「全量 Arco UMD（1.0MB）+ Vue global」换成按需打包的小体积产物。
 *  页面只用到了下面这些组件，其余组件（Table / Form / DatePicker …）全部不进包。
 *
 *  打包后暴露两个全局，与原来的加载方式完全一致，页面代码无需改动：
 *    window.Vue     —— Vue 3 完整版（含模板编译器，in-DOM 模板必需）
 *    window.ArcoVue —— { Button, Tag, … , install() }
 *
 *  新增组件时：在这里加 import + 加入 comps 表 + 补一行 style/css.js，
 *  然后重新执行 `npm run build` 即可。
 * ============================================================================
 */

// 写 'vue'，由 build.mjs 的 alias 指向含模板编译器的版本
// （直接写 vue/dist/vue.esm-browser.prod.js 会被 alias 前缀替换搞成重复路径）
import * as Vue from 'vue';

import * as ButtonNS from '@arco-design/web-vue/es/button';
import * as TagNS from '@arco-design/web-vue/es/tag';
import * as TooltipNS from '@arco-design/web-vue/es/tooltip';
import * as TimelineNS from '@arco-design/web-vue/es/timeline';
import * as CollapseNS from '@arco-design/web-vue/es/collapse';
import * as DrawerNS from '@arco-design/web-vue/es/drawer';
import * as AvatarNS from '@arco-design/web-vue/es/avatar';
import * as DividerNS from '@arco-design/web-vue/es/divider';
import * as MessageNS from '@arco-design/web-vue/es/message';

// 各组件样式按需引入（css.js 是编译后的产物，不像 index.js 那样会拉 less 依赖）
import '@arco-design/web-vue/es/button/style/css.js';
import '@arco-design/web-vue/es/tag/style/css.js';
import '@arco-design/web-vue/es/tooltip/style/css.js';
import '@arco-design/web-vue/es/timeline/style/css.js';
import '@arco-design/web-vue/es/collapse/style/css.js';
import '@arco-design/web-vue/es/drawer/style/css.js';
import '@arco-design/web-vue/es/avatar/style/css.js';
import '@arco-design/web-vue/es/divider/style/css.js';
import '@arco-design/web-vue/es/message/style/css.js';

// 各组件 index.js 的导出形态不统一（有 default、有命名），统一兜底取
function pick(mod, name) {
  return mod[name] || mod.default;
}

var comps = {
  Button: pick(ButtonNS, 'Button'),
  Tag: pick(TagNS, 'Tag'),
  Tooltip: pick(TooltipNS, 'Tooltip'),
  Timeline: pick(TimelineNS, 'Timeline'),
  TimelineItem: pick(TimelineNS, 'TimelineItem'),
  Collapse: pick(CollapseNS, 'Collapse'),
  CollapseItem: pick(CollapseNS, 'CollapseItem'),
  Drawer: pick(DrawerNS, 'Drawer'),
  Avatar: pick(AvatarNS, 'Avatar'),
  Divider: pick(DividerNS, 'Divider')
};

var Message = pick(MessageNS, 'Message');

var ArcoVue = Object.assign({}, comps, {
  Message: Message,
  // app.use(ArcoVue) 会调这个方法；UMD 版注册的是 PascalCase 名，
  // kebab 别名（a-button 等）由 app.js 里的 aliasMap 补注册
  install: function (app) {
    Object.keys(comps).forEach(function (name) {
      if (comps[name]) app.component(name, comps[name]);
    });
  }
});

window.Vue = Vue;
window.ArcoVue = ArcoVue;
