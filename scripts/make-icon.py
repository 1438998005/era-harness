"""生成 era harness 扩展图标（512x512 PNG）——东方 Project 风格。

视觉语言取自东方：御札（符纸）+ 红白蝴蝶结 + 背后的魔法阵。
中央保留块状 E 字标作为 era 的字形锚点，保证缩到小尺寸仍可辨识。
"""

import math
import os

from PIL import Image, ImageDraw, ImageFilter

SS = 4
SIZE = 512
W = SIZE * SS
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icons", "icon.png")

BG_TOP = (26, 16, 48)
BG_BOTTOM = (46, 26, 78)
PAPER = (247, 241, 228)
PAPER_SHADE = (232, 223, 205)
RED = (200, 67, 75)
RED_LIGHT = (222, 84, 92)
INK = (29, 20, 48)
CREAM = (243, 233, 214)
SAKURA = (242, 168, 192)
GOLD = (232, 200, 150)


def u(v):
    """512 设计坐标 → 超采样坐标"""
    return v * W / 512


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def linear_gradient(size, top, bottom):
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    w, h = size
    for i in range(h):
        d.line([(0, i), (w, i)], fill=lerp(top, bottom, i / max(1, h - 1)))
    return img


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_magic_circle(layer, cx, cy):
    """背后的魔法阵：双环 + 12 道刻度 + 内接六芒星。"""
    d = ImageDraw.Draw(layer)
    r_out, r_in = u(206), u(188)

    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=GOLD + (60,), width=max(1, int(u(2.2))))
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=GOLD + (36,), width=max(1, int(u(1.4))))

    for i in range(12):
        a = math.radians(i * 30)
        x0, y0 = cx + math.cos(a) * r_in, cy + math.sin(a) * r_in
        x1, y1 = cx + math.cos(a) * r_out, cy + math.sin(a) * r_out
        d.line([(x0, y0), (x1, y1)], fill=GOLD + (46,), width=max(1, int(u(1.6))))

    # 六芒星（两枚三角），低透明度只作底纹
    tri_r = u(178)
    for offset in (90, 270):
        pts = [
            (
                cx + math.cos(math.radians(offset + i * 120)) * tri_r,
                cy + math.sin(math.radians(offset + i * 120)) * tri_r,
            )
            for i in range(3)
        ]
        d.polygon(pts, outline=GOLD + (30,))


def draw_petal(layer, cx, cy, rx, ry, angle, alpha=210):
    """单枚樱花瓣：画在临时层上旋转后合成。"""
    pad = int(max(rx, ry) * 2)
    tmp = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    td.ellipse([pad - rx, pad - ry, pad + rx, pad + ry], fill=SAKURA + (alpha,))
    # 花瓣尖端的缺口
    td.ellipse([pad - rx * 0.28, pad - ry * 1.15, pad + rx * 0.28, pad - ry * 0.35], fill=(0, 0, 0, 0))
    tmp = tmp.rotate(angle, resample=Image.BICUBIC, center=(pad, pad))
    layer.alpha_composite(tmp, (int(cx - pad), int(cy - pad)))


def draw_sparkle(layer, cx, cy, r, alpha=200):
    """四角星芒，东方符卡常见的点缀。"""
    d = ImageDraw.Draw(layer)
    d.polygon(
        [
            (cx, cy - r),
            (cx + r * 0.22, cy - r * 0.22),
            (cx + r, cy),
            (cx + r * 0.22, cy + r * 0.22),
            (cx, cy + r),
            (cx - r * 0.22, cy + r * 0.22),
            (cx - r, cy),
            (cx - r * 0.22, cy - r * 0.22),
        ],
        fill=GOLD + (alpha,),
    )


def draw_bow(layer, cx, cy):
    """红白蝴蝶结：两个环 + 中心结，压在符纸顶端。"""
    def loop(dx, angle):
        pad = int(u(100))
        tmp = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
        td = ImageDraw.Draw(tmp)
        box = [pad - u(47), pad - u(31), pad + u(47), pad + u(31)]
        td.ellipse(box, fill=RED + (255,))
        # 内圈提亮，做出布料感
        td.ellipse(
            [pad - u(31), pad - u(18), pad + u(31), pad + u(18)],
            fill=RED_LIGHT + (255,),
        )
        tmp = tmp.rotate(angle, resample=Image.BICUBIC, center=(pad, pad))
        layer.alpha_composite(tmp, (int(cx + dx - pad), int(cy - pad)))

    loop(-u(44), -16)
    loop(u(44), 16)

    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(
        [cx - u(18), cy - u(21), cx + u(18), cy + u(21)],
        radius=u(8),
        fill=CREAM + (255,),
        outline=RED + (255,),
        width=max(1, int(u(3))),
    )


def main():
    # 底：夜紫渐变 + 圆角
    bg = linear_gradient((W, W), BG_TOP, BG_BOTTOM).convert("RGBA")
    bg.putalpha(rounded_mask((W, W), radius=int(W * 0.22)))

    # 顶部柔光，衬托符纸
    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W * 0.16, W * 0.04, W * 0.84, W * 0.72], fill=SAKURA + (30,))
    glow = glow.filter(ImageFilter.GaussianBlur(W * 0.1))
    bg = Image.alpha_composite(bg, Image.composite(glow, Image.new("RGBA", (W, W), (0, 0, 0, 0)), rounded_mask((W, W), int(W * 0.22))))

    cx = cy = W / 2

    # 魔法阵（最底层）
    circle_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    draw_magic_circle(circle_layer, cx, cy)
    bg = Image.alpha_composite(bg, circle_layer)

    # 樱花瓣
    petals = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    draw_petal(petals, u(96), u(120), u(15), u(9), 32, 200)
    draw_petal(petals, u(430), u(300), u(13), u(8), -24, 180)
    draw_petal(petals, u(112), u(392), u(12), u(7), 58, 165)
    draw_petal(petals, u(404), u(112), u(11), u(7), -52, 150)
    bg = Image.alpha_composite(bg, petals)

    # 星芒点缀
    sparkles = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    draw_sparkle(sparkles, u(126), u(214), u(13), 210)
    draw_sparkle(sparkles, u(392), u(232), u(10), 180)
    draw_sparkle(sparkles, u(360), u(410), u(8), 150)
    bg = Image.alpha_composite(bg, sparkles)

    # 符纸阴影
    shadow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [u(168), u(144), u(344), u(402)], radius=u(12), fill=(0, 0, 0, 110)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(u(12)))
    bg = Image.alpha_composite(bg, shadow)

    # 符纸本体
    paper = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    pd = ImageDraw.Draw(paper)
    pd.rounded_rectangle(
        [u(166), u(138), u(346), u(396)],
        radius=u(11),
        fill=PAPER + (255,),
        outline=RED + (255,),
        width=max(1, int(u(6))),
    )
    # 内细边
    pd.rounded_rectangle(
        [u(184), u(156), u(328), u(378)],
        radius=u(6),
        outline=RED + (90,),
        width=max(1, int(u(1.6))),
    )

    # 字标 E
    def ink_rect(x0, y0, x1, y1, r=u(5)):
        pd.rounded_rectangle([u(x0), u(y0), u(x1), u(y1)], radius=r, fill=INK + (255,))

    ink_rect(200, 196, 222, 344)   # 竖脊
    ink_rect(200, 196, 312, 218)   # 上横
    ink_rect(200, 259, 292, 281)   # 中横
    ink_rect(200, 322, 312, 344)   # 下横

    # 纸张下缘的淡淡压暗（独立图层合成，避免直接覆盖成实色块）
    shade = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rounded_rectangle([u(172), u(348), u(340), u(390)], radius=u(8), fill=PAPER_SHADE + (60,))
    shade = shade.filter(ImageFilter.GaussianBlur(u(6)))
    paper = Image.alpha_composite(paper, shade)

    bg = Image.alpha_composite(bg, paper)

    # 蝴蝶结压在符纸顶端
    bow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    draw_bow(bow, cx, u(150))
    bg = Image.alpha_composite(bg, bow)

    out = bg.resize((SIZE, SIZE), Image.LANCZOS)
    out.save(OUT, "PNG", optimize=True)
    print("written", os.path.abspath(OUT), out.size)


if __name__ == "__main__":
    main()
