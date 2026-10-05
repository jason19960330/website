#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_aihot_patch.py —— 一键补接「AIHOT 指南」入口（因会话沙箱只能建新文件，请手动运行本脚本）

用法：
    cd /Users/apple/Desktop/AI/website && python3 apply_aihot_patch.py && npm run build

做的事：
  1. 全站 7 个页面导航加「AIHOT 指南」入口（含 noscript SEO 快照同步更新）
  2. skill.html 在 Lieflat Charts 卡片下方新增 AIHOT 展示卡片（用户核心诉求）
  3. sitemap.xml 补 aihot.html / aihot-doc.html / story.html
  4. 删除误建的空文件 tools/.write_test_66540 与 .edit_test
运行完再执行 npm run build 可重新生成预渲染快照（本脚本已内置调用）。
"""
import io
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

NAV_FULL = '\n          <a href="aihot.html" class="hidden text-xs text-dim transition hover:text-accent sm:inline">AIHOT 指南</a>'
NAV_SHORT = '\n          <a href="aihot.html" class="hidden text-xs text-dim transition hover:text-accent sm:inline">AIHOT</a>'

errors = []


def patch(path, subs):
    try:
        with io.open(path, encoding='utf-8') as f:
            s = f.read()
    except FileNotFoundError:
        errors.append(f'[缺失] {path} 不存在，跳过')
        return
    orig = s
    for old, new in subs:
        if old not in s:
            errors.append(f'[未匹配] {path}: {old[:70]!r}...')
            continue
        s = s.replace(old, new)  # 全部替换：正文 header + noscript 快照一次搞定
    if s != orig:
        with io.open(path, 'w', encoding='utf-8') as f:
            f.write(s)
        print(f'[OK] {path}')
    else:
        print(f'[无变化] {path}')


# ---------- 1. skill.html：导航 + AIHOT 展示卡片 ----------
AIHOT_CARD = '''

        <!-- AIHOT 开源框架指南入口卡 -->
        <div class="wl-hero card mt-6">
          <span class="wl-hero-bar" aria-hidden="true"></span>
          <div class="p-6 sm:p-8">
            <div class="mt-4 flex flex-wrap items-start justify-between gap-5">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-accent">开源框架 · 使用指南</p>
                <h2 class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">AIHOT 开源框架 使用指南</h2>
                <p class="mt-3 max-w-2xl text-sm leading-relaxed text-dim">
                  一套「自己找热点、自己写日报」的网站开源引擎：每天从一批信源里收资料，用大模型先筛一遍、再独立打两次分，
                  把不同来源说的同一件事聚成一个事件、按有多少人在说排出热点，每天出一份中文日报。
                  本站的「AI 速览」页正是用它搭建的。指南整理自其公开仓库。
                </p>
              </div>

              <a href="https://github.com/KKKKhazix/AIHOT" target="_blank" rel="noopener" class="wl-src">
                <svg class="h-4 w-4"><use href="#i-external"></use></svg>
                <span class="leading-tight">开源仓库<br>GitHub</span>
              </a>
            </div>

            <dl class="wl-stats">
              <div><dt>信源类型</dt><dd class="tnum">6</dd></div>
              <div><dt>入选评分</dt><dd class="tnum">2×</dd></div>
              <div><dt>报告类型</dt><dd class="tnum">日/周/月</dd></div>
              <div><dt>许可</dt><dd class="tnum">MIT</dd></div>
            </dl>

            <a href="aihot-doc.html" class="sk-entry-link">
              <span>阅读完整指南 · 8 篇详解一页读完</span>
              <svg class="h-4 w-4" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
            </a>
          </div>
        </div>
      </section>'''

SKILL_TAIL = '''<a href="skill-doc.html" class="sk-entry-link">
              <span>阅读完整指南 · 8 篇详解一页读完</span>
              <svg class="h-4 w-4" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
            </a>
          </div>
        </div>
      </section>'''

patch('skill.html', [
    ('<a href="skill.html" class="hidden text-xs font-semibold text-accent sm:inline">Skill 指南</a>',
     '<a href="skill.html" class="hidden text-xs font-semibold text-accent sm:inline">Skill 指南</a>' + NAV_FULL),
    (SKILL_TAIL, SKILL_TAIL.replace('</div>\n        </div>\n      </section>',
                                    '</div>\n        </div>' + AIHOT_CARD, 1)),
])

# ---------- 2. skill-doc.html：导航 ----------
patch('skill-doc.html', [
    ('<a href="skill.html" class="hidden text-xs font-semibold text-accent sm:inline">Skill 指南</a>',
     '<a href="skill.html" class="hidden text-xs font-semibold text-accent sm:inline">Skill 指南</a>' + NAV_FULL),
])

# ---------- 3. story / hotnews / weekly：短标签导航 ----------
for p in ['story.html', 'hotnews.html', 'weekly.html']:
    patch(p, [
        ('<a href="skill.html" class="hidden text-xs text-dim transition hover:text-accent sm:inline">Skill</a>',
         '<a href="skill.html" class="hidden text-xs text-dim transition hover:text-accent sm:inline">Skill</a>' + NAV_SHORT),
    ])

# ---------- 4. resume.html：顶部 + 抽屉 ----------
patch('resume.html', [
    ('<a href="skill.html" class="nav-link hidden sm:inline-block">Skill</a>',
     '<a href="skill.html" class="nav-link hidden sm:inline-block">Skill</a>\n          <a href="aihot.html" class="nav-link hidden sm:inline-block">AIHOT</a>'),
    ('<a href="skill.html" class="nav-link">Skill 指南</a>',
     '<a href="skill.html" class="nav-link">Skill 指南</a>\n        <a href="aihot.html" class="nav-link">AIHOT 指南</a>'),
])

# ---------- 5. index.html：顶部 + 抽屉 ----------
patch('index.html', [
    ('<a href="skill.html" class="nav-link">Skill</a>',
     '<a href="skill.html" class="nav-link">Skill</a>\n            <a href="aihot.html" class="nav-link">AIHOT</a>'),
    ('<a href="skill.html" class="rounded-lg px-3 py-2.5 text-left text-sm text-dim transition hover:bg-raise">Skill 指南</a>',
     '<a href="skill.html" class="rounded-lg px-3 py-2.5 text-left text-sm text-dim transition hover:bg-raise">Skill 指南</a>\n        <a href="aihot.html" class="rounded-lg px-3 py-2.5 text-left text-sm text-dim transition hover:bg-raise">AIHOT 指南</a>'),
])

# ---------- 6. sitemap.xml ----------
SITEMAP_TAIL = '''    <loc>https://jason19960330.github.io/website/skill-doc.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>'''
SITEMAP_NEW = '''    <loc>https://jason19960330.github.io/website/skill-doc.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://jason19960330.github.io/website/aihot.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://jason19960330.github.io/website/aihot-doc.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://jason19960330.github.io/website/story.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>'''
patch('sitemap.xml', [(SITEMAP_TAIL, SITEMAP_NEW)])

# ---------- 7. 清理误建文件 ----------
for junk in ['tools/.write_test_66540', '.edit_test']:
    if os.path.exists(junk):
        try:
            os.remove(junk)
            print(f'[清理] 已删除 {junk}')
        except OSError as e:
            errors.append(f'[清理失败] {junk}: {e}')
    else:
        print(f'[清理] {junk} 不存在（无需处理）')

# ---------- 8. 重新构建（重新生成 noscript 预渲染快照） ----------
if not errors:
    print('\n==> 正在运行 npm run build 重新生成预渲染快照…')
    try:
        r = subprocess.run(['npm', 'run', 'build'], check=False)
        if r.returncode != 0:
            errors.append('npm run build 失败，请手动执行')
    except FileNotFoundError:
        errors.append('找不到 npm，请手动执行 npm run build')

print('\n========== 结果 ==========')
if errors:
    print('以下条目需要人工检查：')
    for e in errors:
        print(' ', e)
    sys.exit(1)
print('全部成功。接下来执行：')
print('  git add -A && git commit -m "feat: 全站接入 AIHOT 指南入口，skill 页新增 AIHOT 展示卡片"')
print('  git push origin main')
