#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_weather_stack.py —— 顶栏天气控件「李文涛在上 / 天气胶囊在下」的上下两行布局
  布局： [WT 李文涛]
         [天气胶囊]
  只改 assets/js/weather.js，幂等、可重复执行；无论当前是原始版还是旧版都会修正为「logo 在上」。
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

# 原始版：胶囊插在 logo 最前（横排）
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

# 目标版：logo 在上、天气胶囊在下
NEW_MOUNT = """    var pill = document.createElement('span');
    pill.className = 'wx-pill';
    pill.id = 'wx-pill';
    pill.setAttribute('role', 'img');
    pill.setAttribute('aria-label', '实时天气');
    pill.textContent = '天气…';
    if (logo) {
      // 上下两行：李文涛（brand）在上，天气胶囊在下
      var left = document.createElement('div');
      left.className = 'wx-left';
      var brand = document.createElement('div');
      brand.style.cssText = 'display:flex;align-items:center;gap:.625rem;';
      while (logo.firstChild) brand.appendChild(logo.firstChild);
      left.appendChild(brand);
      left.appendChild(pill);
      logo.appendChild(left);
    } else {
      host.appendChild(pill);
    }
    return pill;"""

# 旧版补丁（胶囊在上）的挂载片段，用于翻转顺序
OLD_FLIP = "      left.appendChild(pill);\n      left.appendChild(brand);\n"
NEW_FLIP = "      left.appendChild(brand);\n      left.appendChild(pill);\n"


def main():
    if not os.path.exists(TARGET):
        print('[FAIL] 找不到 %s' % TARGET)
        sys.exit(1)
    with io.open(TARGET, encoding='utf-8') as f:
        s = f.read()

    if NEW_MOUNT in s and '.wx-left{' in s:
        print('[SKIP] 已是「李文涛在上 / 天气在下」的布局，无需重复执行')
        return

    changed = False

    # 1) 样式：确保存在 .wx-left
    if OLD_CSS in s:
        s = s.replace(OLD_CSS, NEW_CSS, 1)
        print('[OK] 样式：加入 .wx-left 上下两行布局')
        changed = True
    elif '.wx-left{' in s:
        print('[SKIP] 样式已存在')
    else:
        print('[FAIL] 未命中样式匹配串，文件可能已被改动')
        sys.exit(1)

    # 2) 挂载：三种现状 → 目标版
    if OLD_MOUNT in s:
        s = s.replace(OLD_MOUNT, NEW_MOUNT, 1)
        print('[OK] 挂载：李文涛在上、天气在下')
        changed = True
    elif OLD_FLIP in s:
        s = s.replace(OLD_FLIP, NEW_FLIP, 1)
        print('[OK] 挂载：翻转顺序为「李文涛在上、天气在下」')
        changed = True
    else:
        print('[FAIL] 未命中挂载匹配串')
        sys.exit(1)

    if changed:
        with io.open(TARGET, 'w', encoding='utf-8') as f:
            f.write(s)
        print('[DONE] weather.js 已更新')
    print('完成！强刷浏览器（Cmd+Shift+R）即可看到效果。')


if __name__ == '__main__':
    main()
