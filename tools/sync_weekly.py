#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 ruanyf/weekly 拉取内容，生成站点可直接消费的 JS 数据文件。

产出：
  assets/js/weekly-index.js   全量索引（期号 / 标题 / 年月），用于搜索
  assets/js/weekly-latest.js  最近 N 期的完整条目（分章节）

用法：
  python3 tools/sync_weekly.py            # 拉取并写入
  python3 tools/sync_weekly.py --issues 20
"""

import argparse
import json
import os
import re
import ssl
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

REPO = 'ruanyf/weekly'
BRANCH = 'master'
RAW = 'https://raw.githubusercontent.com/%s/%s' % (REPO, BRANCH)
UA = 'weekly-sync-script/1.0'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_INDEX = os.path.join(ROOT, 'assets', 'js', 'weekly-index.js')
OUT_LATEST = os.path.join(ROOT, 'assets', 'js', 'weekly-latest.js')

# 每一期的正文里，这几节是「条目清单」，用 N、[标题](链接) 的格式罗列
LIST_SECTIONS = ('科技动态', '文章', '工具', '资源', '图片', '文摘', '言论')
# 封面图已在上面单独抽过取了，这里跳过；往年回顾是回链，不进列表
SKIP_SECTIONS = ('封面图', '往年回顾')
BOILERPLATE = re.compile(r'^(这里记录每周|本杂志开源|欢迎投稿)')

NUM_ITEM = re.compile(r'^(\d+)、(.*)$')
LIST_LINE = re.compile(r'- 第 (\d+) 期：\[(.+?)\]\(docs/issue-(\d+)\.md\)')
LINK = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')


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
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=45, context=ctx) as r:
        return r.read().decode('utf-8', errors='replace')


def _fetch_curl(url):
    out = subprocess.run(
        ['curl', '-sSL', '--max-time', '60', '-H', 'User-Agent: ' + UA, url],
        capture_output=True, timeout=90)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.decode('utf-8', 'ignore')[:120])
    return out.stdout.decode('utf-8', errors='replace')


def parse_readme(text):
    """README 是唯一索引：## 年 → **月** → - 第 N 期：[标题](docs/issue-N.md)"""
    issues = []
    year = None
    month = None
    for line in text.split('\n'):
        line = line.strip()
        h2 = re.match(r'^##\s+(\d{4})\s*$', line)
        if h2:
            year = h2.group(1)
            continue
        m = re.match(r'^\*\*(.+?)\*\*$', line)
        if m and year:
            month = CN_MONTH.get(m.group(1))
            continue
        it = LIST_LINE.match(line)
        if it:
            num, title, link_num = int(it.group(1)), it.group(2), int(it.group(3))
            ym = '%s-%02d' % (year, month) if (year and month) else ''
            issues.append({
                'n': num,
                'title': title,
                'ym': ym,
                'file': 'docs/issue-%d.md' % link_num,
            })
    issues.sort(key=lambda x: x['n'], reverse=True)
    return issues


CN_MONTH = {'一月': 1, '二月': 2, '三月': 3, '四月': 4, '五月': 5, '六月': 6,
            '七月': 7, '八月': 8, '九月': 9, '十月': 10, '十一月': 11, '十二月': 12}


def plain(text):
    """去掉 Markdown 标记，只留纯文本"""
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)          # 图片
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)      # 链接留文字
    text = re.sub(r'[*`>#-]', '', text)
    return text.strip()


def parse_issue(num, title, ym, raw):
    """把一期的 Markdown 拆成：卷首语、长话题、条目清单"""
    lines = raw.split('\n')
    cover = ''
    lead = []
    topics = []          # 长话题：标题 + 段落
    sections = []        # 条目清单章节

    idx = [i for i, l in enumerate(lines) if l.startswith('## ')]
    head_start = idx[0] if idx else len(lines)

    # 封面图：优先取「封面图」小节里的第一张
    cover_pos = next((i for i in idx if lines[i][3:].strip() == '封面图'), None)
    if cover_pos is not None:
        cover_end = next((v for v in idx if v > cover_pos), len(lines))
        for line in lines[cover_pos + 1:cover_end]:
            img = re.search(r'!\[[^\]]*\]\((https?://[^)]+)\)', line)
            if img:
                cover = img.group(1)
                break

    # H1 之后到第一个 ## 之间，只保留真实的通知内容，滤掉每期都一样的套话
    for line in lines[1:head_start]:
        t = plain(line)
        if t and not BOILERPLATE.match(t) and len(t) > 6:
            lead.append(t)

    for pos, start in enumerate(idx):
        name = lines[start][3:].strip()
        end = idx[pos + 1] if pos + 1 < len(idx) else len(lines)
        body = lines[start + 1:end]

        if name in SKIP_SECTIONS:
            continue

        if name in LIST_SECTIONS:
            sections.append({'name': name, 'items': parse_items(body)})
        else:
            paras = [plain(l) for l in body if plain(l)]
            topics.append({'title': name, 'paras': paras[:6]})

    # 卷首语为空时，退回到第一个长话题的首段，比留白更有信息量
    if not lead and topics and topics[0]['paras']:
        lead = [topics[0]['paras'][0][:120]]

    return {
        'n': num,
        'title': title,
        'ym': ym,
        'cover': cover,
        'lead': lead[0] if lead else '',
        'topics': topics,
        'sections': [s for s in sections if s['items']],
        'url': 'https://github.com/%s/blob/%s/docs/issue-%d.md' % (REPO, BRANCH, num),
    }


def parse_items(body):
    """条目清单：N、[标题](链接) 起头，后面跟若干段描述"""
    items = []
    cur = None
    for line in body:
        line = line.strip()
        if not line:
            continue
        m = NUM_ITEM.match(line)
        if m:
            rest = m.group(2)
            link = LINK.search(rest)
            name = link.group(1) if link else plain(rest)
            url = link.group(2) if link else ''
            if url.startswith('docs/'):
                url = RAW + '/' + url
            cur = {'t': plain(name), 'u': url, 'd': ''}
            items.append(cur)
            continue
        if cur is None:
            continue
        if line.startswith('![') or line.startswith('>') or line.startswith('#'):
            continue
        t = plain(line)
        if not t or re.match(r'^\d+、', t):
            continue
        # 「言论」这类没有标题，直接用段落文字补位，出处落在描述里
        if not cur['t']:
            cur['t'] = t[:100]
            continue
        if not cur['d']:
            cur['d'] = t[:160]
    return items


def write_js(path, var, payload):
    body = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    js = '/* 自动生成，请勿手动修改：由 tools/sync_weekly.py 写入 */\nwindow.%s=%s;\n' % (var, body)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(js)
    os.replace(tmp, path)
    return len(js.encode('utf-8'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--issues', type=int, default=20, help='抓取最近多少期全文')
    args = ap.parse_args()

    print('拉取 README 索引 ...')
    readme = fetch(RAW + '/README.md')
    index = parse_readme(readme)
    print('  → 共 %d 期，最新为第 %d 期' % (len(index), index[0]['n']))

    targets = index[:args.issues]
    latest = []
    for it in targets:
        try:
            raw = fetch(RAW + '/' + it['file'])
            latest.append(parse_issue(it['n'], it['title'], it['ym'], raw))
            print('  ✓ #%d %s' % (it['n'], it['title']))
        except Exception as e:
            print('  ✗ #%d 抓取失败：%s' % (it['n'], e))

    stamp = datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M')
    s1 = write_js(OUT_INDEX, 'WEEKLY_INDEX',
                  {'updated': stamp, 'source': 'https://github.com/' + REPO, 'total': len(index), 'issues': index})
    s2 = write_js(OUT_LATEST, 'WEEKLY_LATEST',
                  {'updated': stamp, 'count': len(latest), 'issues': latest})

    print('\n写入完成：')
    print('  %-34s %6.1f KB' % (os.path.relpath(OUT_INDEX, ROOT), s1 / 1024))
    print('  %-34s %6.1f KB' % (os.path.relpath(OUT_LATEST, ROOT), s2 / 1024))


if __name__ == '__main__':
    main()
