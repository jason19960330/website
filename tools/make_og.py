#!/usr/bin/env python3
"""
生成社交分享卡片图（Open Graph / Twitter Card 用的 og-image.png，1200x630）。

只在需要更新分享图时手动跑一次：
    python3 tools/make_og.py

依赖：pillow（pip install pillow）。产物 assets/og-image.png 提交进仓库。
文案改这里即可，配色与站点主题保持一致。
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'og-image.png')
FONT_PATH = '/System/Library/Fonts/PingFang.ttc'

BG = (12, 17, 24)          # 与站点深色底接近
CARD = (20, 27, 38)
ACCENT = (14, 165, 233)    # 站点 accent 天蓝
INK = (240, 245, 250)
DIM = (150, 165, 185)


def font(size, weight='Regular'):
    # PingFang.ttc 里按索引取字重，找不到就退回默认
    idx = {'Regular': 0, 'Medium': 2, 'Semibold': 4, 'Light': 1}.get(weight, 0)
    try:
        return ImageFont.truetype(FONT_PATH, size, index=idx)
    except Exception:
        return ImageFont.truetype(FONT_PATH, size)


def main():
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)

    # 右上角装饰：几段渐变透明度的斜条，纯色块不用渐变
    for i in range(5):
        x = W - 60 - i * 74
        alpha = 0.10 + i * 0.05
        col = tuple(int(BG[c] + (ACCENT[c] - BG[c]) * alpha * 3.2) for c in range(3))
        d.polygon([(x, 0), (x + 46, 0), (x - 78, H), (x - 124, H)], fill=col)

    # 左侧强调竖条
    d.rectangle([96, 150, 102, 470], fill=ACCENT)

    d.text((140, 150), '李文涛', font=font(88, 'Semibold'), fill=INK)
    d.text((142, 262), 'IT 资产管理 / ITIL 技术支持', font=font(40, 'Medium'), fill=ACCENT)
    d.text((142, 336), '7 年企业级 IT 技术支持  ·  500+ 终端运营  ·  台账准确率 90%+',
           font=font(28), fill=DIM)
    d.text((142, 382), '晖致医药  ·  北京丰台',
           font=font(28), fill=DIM)

    # 底部三个标签
    tags = ['资产全生命周期管理', '盘点对账与库存控制', 'SOP 文档沉淀']
    x = 142
    for t in tags:
        tw = d.textlength(t, font=font(24))
        pad = 18
        d.rounded_rectangle([x, 452, x + tw + pad * 2, 452 + 52], radius=26,
                            outline=(60, 74, 92), width=2)
        d.text((x + pad, 466), t, font=font(24), fill=DIM)
        x += tw + pad * 2 + 16

    img.save(OUT, 'PNG', optimize=True)
    print('已生成', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
