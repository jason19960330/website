#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_wx_stack_patch.py —— 把顶栏天气控件从「横排」改成「上下两行」
  改动前： [天气胶囊]  [WT 李文涛]   （同一行）
  改动后： [天气胶囊]
           [WT 李文涛]              （胶囊在上、logo 在下，左对齐）
只改 assets/js/weather.js（样式 + 挂载逻辑），幂等可重复执行。
"""
import io, os, sys

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'js', 'weather.js')

OLD_CSS = (
    "      + '.wx-pill img.wx-icon{width:1.25rem;height:1.25rem;display:block;}'\n"
    "      + '.wx-pill .wx-temp{font-weight:600;color:rgb(var(--c-ink));font-variant-numeric:tabular-nums;}'\n"
    "      + '.wx-pill .wx-city{color:rgb(var(--c-faint));}'\n"
)
NEW_CSS = (
    "      + '.wx-pill img.wx-icon{width:1.25rem;height:1.25rem;display:block;}'\n"
    "      + '.wx-pill .wx-temp{font-weight:600;color:rgb(var(--c-ink));font-variant-numeric:tabular-nums;}'\n"
    "      + '.wx-pill .wx-city{color:rgb(var(--c-faint));}'\n"
    "      + '.wx-left{display:flex;flex-direction:column;align-items:flex-start;gap:.3125rem;}'\n"
    "      + '.wx-left .wx-pill{padding:.1875rem .5rem .1875rem .3125rem;font-size:.625rem;}'\n"
    "      + '.wx-left .wx-pill img.wx-icon{width:1.0625rem;height:1.0625rem;}'\n"
)

OLD_MOUNT = """    var pill = document.createElement('span');
    pill.className = 'wx-pill';
    pill.id = 'wx-pill';
    pill.setAttribute('role', 'img');
    pill.setAttribute('aria-label', '实时天气');
    pill.textContent = '天气…';
    // 插到 logo 内部最前：与「WT / 李文涛」共享 gap，天然左上角
    if (logo) logo.insertBefore(pill, logo.firstChild);
    else host.appendChild(pill);
    return pill;"""

NEW_MOUNT = """    var pill = document.createElement('span');
    pill.className = 'wx-pill';
    pill.id = 'wx-pill';
    pill.setAttribute('role', 'img');
    pill.setAttribute('aria-label', '实时天气');
    pill.textContent = '天气…';
    if (logo) {
      // 上下两行：logo 原有内容包成一行（brand），天气胶囊放在其上方
      var left = document.createElement('div');
      left.className = 'wx-left';
      var brand = document.createElement('div');
      brand.style.cssText = 'display:flex;align-items:center;gap:.625rem;';
      while (logo.firstChild) brand.appendChild(logo.firstChild);
      left.appendChild(pill);
      left.appendChild(brand);
      logo.appendChild(left);
    } else {
      host.appendChild(pill);
    }
    return pill;"""


def main():
    if not os.path.exists(TARGET):
        print('[FAIL] 找不到 %s' % TARGET)
        sys.exit(1)
    with io.open(TARGET, encoding='utf-8') as f:
        s = f.read()

    if '.wx-left{' in s and 'wx-left' in s and OLD_MOUNT not in s and NEW_MOUNT in s:
        print('[SKIP] 已应用过本补丁，无需重复执行')
        return

    changed = False
    if OLD_CSS in s:
        s = s.replace(OLD_CSS, NEW_CSS, 1)
        print('[OK] 样式：加入 .wx-left 上下两行布局')
        changed = True
    elif '.wx-left{' in s:
        print('[SKIP] 样式已存在')
    else:
        print('[FAIL] 未命中样式匹配串，文件可能已被改动')
        sys.exit(1)

    if OLD_MOUNT in s:
        s = s.replace(OLD_MOUNT, NEW_MOUNT, 1)
        print('[OK] 挂载：胶囊改为叠在 logo 上方')
        changed = True
    elif NEW_MOUNT in s:
        print('[SKIP] 挂载逻辑已是新版')
    else:
        print('[FAIL] 未命中挂载匹配串')
        sys.exit(1)

    if changed:
        with io.open(TARGET, 'w', encoding='utf-8') as f:
            f.write(s)
        print('[DONE] weather.js 已更新')
    print('完成！强刷浏览器（Cmd+Shift+R）即可看到上下两行效果。')


if __name__ == '__main__':
    main()
