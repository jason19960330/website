#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_weather_patch.py —— 全站接入「左上角天气控件」（Meteocons）

因会话沙箱只能新建文件，请手动运行本脚本：

    cd /Users/apple/Desktop/AI/website && python3 apply_weather_patch.py

做的事（幂等，重复跑不会重复插入）：
  在全部 9 个带顶栏的页面里，于 vendor/arco-bundle.js 之前插入：
      <script src="assets/js/weather.js?v=202610051"></script>
  weather.js 会自动把 Meteocons 天气胶囊插到顶栏左上角 logo 内部最前面：
      [动画天气图标] [温度] [天气 · 城市]
  数据源：GeoJS IP 定位（免密钥） + Open-Meteo 实时天气（免密钥），结果缓存 30 分钟。
运行后本地刷新 http://localhost:8133/ 即可看到（Cmd+Shift+R 强刷）。
"""
import glob
import io
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

ANCHOR = '<script src="vendor/arco-bundle.js?v=20260923"></script>'
SCRIPT_TAG = '<script src="assets/js/weather.js?v=202610051"></script>\n  '

changed, skipped, missing = [], [], []
for path in sorted(glob.glob('*.html')):
    with io.open(path, encoding='utf-8') as f:
        s = f.read()
    if SCRIPT_TAG.strip() in s:
        skipped.append(path)
        continue
    if ANCHOR not in s:
        missing.append(path)
        continue
    s = s.replace(ANCHOR, SCRIPT_TAG + ANCHOR)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    changed.append(path)

print('已插入：', ', '.join(changed) if changed else '（无）')
print('已存在（跳过）：', ', '.join(skipped) if skipped else '（无）')
if missing:
    print('未找到锚点（需人工检查）：', ', '.join(missing))
print('\n完成。本地刷新 http://localhost:8133/ （Cmd+Shift+R 强刷）即可在顶栏左上角看到天气胶囊。')
print('确认效果后提交推送：')
print('  git add -A && git commit -m "feat: 顶栏左上角接入 Meteocons 实时天气控件" && git push origin main')
