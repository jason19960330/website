#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 NewsNow 公开接口拉取科技热点，生成站点可直接消费的 JS 数据文件。

产出：
  assets/js/hotnews.js   三个源的榜单（IT之家 / Hacker News / 少数派）

用法：
  python3 tools/sync_hotnews.py              # 拉取并写入
  python3 tools/sync_hotnews.py --limit 20   # 每个源最多保留多少条

说明：
  NewsNow 是开源项目（https://github.com/newsnext/newsnow，MIT），
  这里只是按期抓取它的公开聚合接口，内容版权归各原平台所有，页面只做链接跳转。
  该站点架在 Cloudflare 后面：非浏览器 UA 会直接 403，所以 UA 必须伪装成浏览器；
  且响应没有 CORS 头，前端无法直连，只能在构建/定时任务里抓。
"""

import argparse
import json
import os
import ssl
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

API = 'https://newsnow.busiyi.world/api/s?id=%s'
# Cloudflare 只认浏览器 UA，自定义 UA 一律 403
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

# 与站点定位（IT 资产管理 / ITIL 技术支持）贴合的三个科技源
SOURCES = [
    ('ithome',    'IT 之家',    'https://www.ithome.com/'),
    ('hackernews', 'Hacker News', 'https://news.ycombinator.com/'),
    ('sspai',     '少数派',      'https://sspai.com/'),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'js', 'hotnews.js')


def fetch(url, retries=3):
    """先走 urllib，失败逐次退避重试，再退回 curl（部分代理环境只认 curl）"""
    last = None
    for attempt in range(1, retries + 1):
        try:
            return _fetch_url(url)
        except Exception as e:
            last = e
            if attempt < retries:
                time.sleep(2 * attempt)
    try:
        return _fetch_curl(url)
    except Exception as e:
        raise RuntimeError('%s 拉取失败（已%d次重试+curl）：%s' % (url, retries, e))


def _fetch_url(url):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=45, context=ctx) as r:
        return r.read().decode('utf-8', errors='replace')


def _fetch_curl(url):
    out = subprocess.run(
        ['curl', '-sSL', '--max-time', '60', '-H', 'User-Agent: ' + UA,
         '-H', 'Accept: application/json', url],
        capture_output=True, timeout=90)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.decode('utf-8', 'ignore')[:120])
    return out.stdout.decode('utf-8', errors='replace')


def pull(sid, name, home, limit):
    """抓单个源，整理成 {id, name, home, updatedTime, items:[{t,u}]}"""
    raw = fetch(API % sid)
    try:
        data = json.loads(raw)
    except ValueError:
        raise RuntimeError('返回不是 JSON（可能被反爬拦截）：%s' % raw[:120])

    if data.get('error'):
        raise RuntimeError('接口返回错误：%s' % json.dumps(data, ensure_ascii=False)[:120])

    items = []
    for it in (data.get('items') or [])[:limit]:
        title = (it.get('title') or '').strip()
        url = it.get('url') or it.get('mobileUrl') or ''
        if not title or not url:
            continue
        items.append({'t': title, 'u': url})

    return {
        'id': sid,
        'name': name,
        'home': home,
        'updatedTime': data.get('updatedTime') or 0,
        'items': items,
    }


def write_js(payload):
    body = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    js = '/* 自动生成，请勿手动修改：由 tools/sync_hotnews.py 写入 */\nwindow.HOTNEWS=%s;\n' % body
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(js)
    os.replace(tmp, OUT)
    return len(js.encode('utf-8'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=20, help='每个源最多保留多少条')
    args = ap.parse_args()

    sources = []
    for sid, name, home in SOURCES:
        try:
            got = pull(sid, name, home, args.limit)
            sources.append(got)
            print('  ✓ %-12s %2d 条' % (name, len(got['items'])))
        except Exception as e:
            print('  ✗ %-12s 抓取失败：%s' % (name, e))

    if not sources:
        raise SystemExit('三个源全部失败，保留上一次的数据文件不动')

    stamp = datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M')
    size = write_js({
        'updated': stamp,
        'source': 'https://github.com/newsnext/newsnow',
        'sources': sources,
    })
    print('\n写入 %s（%.1f KB）' % (os.path.relpath(OUT, ROOT), size / 1024))


if __name__ == '__main__':
    main()
