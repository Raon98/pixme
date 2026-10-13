#!/usr/bin/env python3
"""
PIXME promo film — "픽셀이 모여 내가 된다".

    python3 apps/mobile/scripts/generate-promo-video.py

Three acts, one idea carried start to finish:

  1. A viewfinder flashes, and pixel blocks fly in and assemble into a real
     generated character — the product's promise performed literally.
  2. That character shrinks and flies INTO the phone, landing exactly on its
     own pixels inside a real MY-screen capture (the landing point is
     measured from the screenshot, not eyeballed). The phone then stays put
     while the screen inside it navigates — MY → 광장 → 오늘 — like someone
     actually using the app: a pan, a fingertip tap on the real
     친해지고 싶어요 button, the app's real toast, and the conversation
     bubble popping when both sides have said it.
  3. The wordmark itself assembles out of pixel blocks — the opening gag,
     returned as the signature.

Not an App Store "app preview" (Apple requires raw captures with no added
chrome); this is for the website, Instagram and ads. 1080×1920 @ 30fps.
Screens are real simulator captures in assets/mock/screen-*.png; the hero
sprite is a real generation (generated-character-cheol.png).
"""

from __future__ import annotations

import math
import random
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FPS = 30
OVERLAP = 12

PAPER = (255, 253, 248)
INK = (26, 24, 20)
VIOLET = (124, 108, 240)
SKYBLUE = (173, 197, 255)
PEACH = (255, 196, 170)
MUTED = (140, 134, 124)
BEZEL = (22, 21, 19)

ROOT = Path(__file__).resolve().parent.parent
MOCK = ROOT / "assets" / "mock"
OUT_DIR = ROOT / "build" / "promo-frames"
OUT_FILE = ROOT / "build" / "pixme-promo.mp4"
FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def font(size: int, heavy: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size, index=8 if heavy else 2)


# ------------------------------------------------------------------ easing

def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def ease_out(t: float) -> float:
    return 1 - (1 - t) ** 3


def ease_in_out(t: float) -> float:
    return 3 * t * t - 2 * t * t * t


def ease_out_back(t: float) -> float:
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def span(frame: float, start: float, length: float) -> float:
    return clamp01((frame - start) / length) if length else 1.0


def rise(offset: float, p: float) -> int:
    return round(offset * (1 - ease_out(p)))


# ------------------------------------------------------------- primitives

def text_on(layer, body, y, size, colour=INK, heavy=False, alpha=1.0,
            tracking=0, x_center=None):
    if alpha <= 0.01:
        return
    draw = ImageDraw.Draw(layer)
    face = font(size, heavy)
    fill = (*colour, round(255 * clamp01(alpha)))
    cx = W // 2 if x_center is None else x_center
    if tracking == 0:
        width = draw.textbbox((0, 0), body, font=face)[2]
        draw.text((cx - width / 2, y), body, font=face, fill=fill)
        return
    widths = [draw.textbbox((0, 0), ch, font=face)[2] for ch in body]
    total = sum(widths) + tracking * (len(body) - 1)
    x = cx - total / 2
    for ch, w in zip(body, widths):
        draw.text((x, y), ch, font=face, fill=fill)
        x += w + tracking


def star(draw, cx, cy, r, fill):
    pts = []
    for i in range(8):
        angle = math.pi / 4 * i - math.pi / 2
        radius = r if i % 2 == 0 else r * 0.38
        pts.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    draw.polygon(pts, fill=fill)


# ------------------------------------------------------------- background

_blob_cache: dict[tuple, Image.Image] = {}


def blob(colour, radius):
    key = (colour, radius)
    if key not in _blob_cache:
        size = radius * 2
        yy, xx = np.mgrid[0:size, 0:size]
        d = np.sqrt((xx - radius) ** 2 + (yy - radius) ** 2) / radius
        alpha = (np.clip(1 - d, 0, 1) ** 2 * 42).astype("uint8")
        arr = np.zeros((size, size, 4), dtype="uint8")
        arr[..., 0], arr[..., 1], arr[..., 2] = colour
        arr[..., 3] = alpha
        _blob_cache[key] = Image.fromarray(arr, "RGBA")
    return _blob_cache[key]


def background(g: int) -> Image.Image:
    canvas = Image.new("RGBA", (W, H), (*PAPER, 255))
    t = g / FPS
    for colour, radius, bx, by, s1, s2, ph in (
        (VIOLET, 430, 0.74, 0.18, 0.31, 0.22, 0.0),
        (SKYBLUE, 500, 0.16, 0.84, 0.26, 0.19, 2.1),
        (PEACH, 300, 0.10, 0.10, 0.23, 0.29, 4.0),
    ):
        b = blob(colour, radius)
        x = int(W * bx + 85 * math.sin(t * s1 + ph)) - radius
        y = int(H * by + 70 * math.sin(t * s2 + ph + 1.1)) - radius
        canvas.alpha_composite(b, (x, y))
    return canvas


# -------------------------------------------------------- pixel assembly

def make_blocks(img: Image.Image, cell: int, seed: int,
                scatter: tuple[int, int], delay_max: int):
    """
    Decomposes an RGBA image into a grid of coloured blocks, each with its
    own flight plan (random direction, distance and delay). This is the
    film's signature move — the product turns photos into pixels, so the
    film builds its imagery out of pixels, literally.
    """
    rng = random.Random(seed)
    cols = max(1, img.width // cell)
    rows = max(1, img.height // cell)
    small = img.resize((cols, rows), Image.BOX)
    px = small.load()
    blocks = []
    for r in range(rows):
        for c in range(cols):
            col = px[c, r]
            if col[3] < 40:
                continue
            angle = rng.uniform(0, math.tau)
            dist = rng.uniform(*scatter)
            blocks.append({
                "x": c * cell, "y": r * cell,
                "colour": col[:3],
                "a": col[3],
                "dx": math.cos(angle) * dist,
                "dy": math.sin(angle) * dist,
                "delay": rng.uniform(0, delay_max),
            })
    return blocks, cell


def draw_assembly(layer, blocks_cell, origin, frame, start, dur_each, alpha=1.0):
    """Each block flies home on its own schedule; returns completion 0..1."""
    blocks, cell = blocks_cell
    draw = ImageDraw.Draw(layer)
    ox, oy = origin
    done = 0
    for b in blocks:
        p = span(frame, start + b["delay"], dur_each)
        if p <= 0:
            continue
        e = ease_out(p)
        done += p >= 1
        x = ox + b["x"] + b["dx"] * (1 - e)
        y = oy + b["y"] + b["dy"] * (1 - e)
        a = round(b["a"] * e * alpha)
        if a > 3:
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(*b["colour"], a))
    return done / max(1, len(blocks))


def burst(layer, cx, cy, frame, start, seed, n=14, colourset=(VIOLET, PEACH, SKYBLUE)):
    """A little puff of pixel confetti — used at the two celebration beats."""
    p = span(frame, start, 26)
    if p <= 0 or p >= 1:
        return
    rng = random.Random(seed)
    draw = ImageDraw.Draw(layer)
    for i in range(n):
        angle = rng.uniform(0, math.tau)
        speed = rng.uniform(90, 230)
        size = rng.choice((10, 14, 18))
        colour = colourset[i % len(colourset)]
        e = ease_out(p)
        x = cx + math.cos(angle) * speed * e
        y = cy + math.sin(angle) * speed * e + 150 * p * p  # gravity
        a = round(230 * (1 - p))
        draw.rectangle((x, y, x + size, y + size), fill=(*colour, a))


# ------------------------------------------------------------ device frame

FRAME_W = 560
CORNER = 52
BEZEL_W = 14
CONTENT_W = FRAME_W - 2 * BEZEL_W
SCREEN_AR = 2622 / 1206
CONTENT_H = round(CONTENT_W * SCREEN_AR)
FRAME_H = CONTENT_H + 2 * BEZEL_W
PHONE_X = (W - FRAME_W) // 2
PHONE_Y = 372
SCALE = CONTENT_W / 1206  # screenshot px → canvas px when zoom == 1

_screens: dict[str, Image.Image] = {}


def screen(name: str) -> Image.Image:
    if name not in _screens:
        _screens[name] = Image.open(MOCK / f"screen-{name}.png").convert("RGB")
    return _screens[name]


def content_image(name, zoom, center_y):
    img = screen(name)
    src_w = round(img.width / zoom)
    src_h = round(img.height / zoom)
    cy = round(img.height * center_y)
    top = max(0, min(img.height - src_h, cy - src_h // 2))
    left = (img.width - src_w) // 2
    crop_box = (left, top, src_w, src_h)
    content = img.crop((left, top, left + src_w, top + src_h)).resize(
        (CONTENT_W, CONTENT_H), Image.LANCZOS
    )
    return content, crop_box


_bezel_cache: list[Image.Image] = []


def bezel_wrap(content: Image.Image) -> Image.Image:
    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((0, 0, FRAME_W - 1, FRAME_H - 1), radius=CORNER, fill=BEZEL)
    mask = Image.new("L", (CONTENT_W, CONTENT_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, CONTENT_W - 1, CONTENT_H - 1), radius=CORNER - BEZEL_W, fill=255
    )
    frame.paste(content, (BEZEL_W, BEZEL_W), mask)
    pill_w, pill_h = round(FRAME_W * 0.26), 20
    draw.rounded_rectangle(
        ((FRAME_W - pill_w) / 2, BEZEL_W + 12, (FRAME_W + pill_w) / 2, BEZEL_W + 12 + pill_h),
        radius=pill_h // 2, fill=BEZEL,
    )
    return frame


def place_phone(layer, frame, x, y, alpha=1.0, tilt=0.0, dy=0):
    if alpha <= 0.01:
        return
    img, ox, oy = frame, x, y + dy
    if abs(tilt) > 0.05:
        img = frame.rotate(tilt, resample=Image.BICUBIC, expand=True)
        ox = x - (img.width - frame.width) // 2
        oy = y + dy - (img.height - frame.height) // 2
    silhouette = img.split()[3].filter(ImageFilter.GaussianBlur(26))
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    black = Image.new("RGBA", img.size, (0, 0, 0, round(85 * alpha)))
    shadow.paste(black, (ox, oy + 24), silhouette.point(lambda p: round(p * alpha)))
    layer.alpha_composite(shadow)
    if alpha < 0.995:
        r, g, b, a = img.split()
        img = Image.merge("RGBA", (r, g, b, a.point(lambda p: round(p * alpha))))
    layer.alpha_composite(img, (ox, oy))


def map_point(sx, sy, crop_box):
    left, top, src_w, src_h = crop_box
    if not (left <= sx <= left + src_w and top <= sy <= top + src_h):
        return None
    return (
        round(PHONE_X + BEZEL_W + (sx - left) / src_w * CONTENT_W),
        round(PHONE_Y + BEZEL_W + (sy - top) / src_h * CONTENT_H),
    )


def ripple(layer, cx, cy, p):
    if p <= 0 or p >= 1:
        return
    draw = ImageDraw.Draw(layer)
    press = span(p, 0.0, 0.3)
    lift = span(p, 0.45, 0.3)
    dot = 20 * ease_out(press) * (1 - lift)
    if dot > 1:
        draw.ellipse((cx - dot, cy - dot, cx + dot, cy + dot),
                     fill=(*VIOLET, round(200 * (1 - lift))))
    for delay in (0.18, 0.36):
        wp = span(p, delay, 0.64)
        if wp <= 0:
            continue
        r = 16 + 92 * ease_out(wp)
        a = round(190 * (1 - wp))
        if a > 3:
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(*VIOLET, a), width=5)


def toast(layer, body, cx, y, alpha):
    if alpha <= 0.01:
        return
    draw = ImageDraw.Draw(layer)
    face = font(30, True)
    tw = draw.textbbox((0, 0), body, font=face)[2]
    pw, ph = tw + 76, 74
    x0 = cx - pw // 2
    draw.rounded_rectangle((x0, y, x0 + pw, y + ph), radius=ph // 2,
                           fill=(*INK, round(235 * alpha)))
    draw.text((x0 + 38, y + 19), body, font=face,
              fill=(255, 255, 255, round(255 * alpha)))


def headline(layer, lines, p_in, p_out=0.0):
    a = ease_out(p_in) * (1 - ease_in_out(p_out))
    for i, line in enumerate(lines):
        text_on(layer, line, 170 + i * 76 + rise(30, p_in), 56, INK, True, a)


def caption(layer, body, p_in, p_out=0.0):
    a = ease_out(p_in) * (1 - ease_in_out(p_out))
    text_on(layer, body, PHONE_Y + FRAME_H + 56, 36, MUTED, False, a)


# ------------------------------------------------------------ hero sprite

HERO = Image.open(MOCK / "generated-character-cheol.png").convert("RGBA")
# Measured on screen-my.png: the character's own pixels sit at bbox
# (524,474)-(682,893) → centre (603, 683.5), height 419. The act-two landing
# flies the sprite onto exactly that spot, so the handoff from "character in
# the world" to "character in the app" happens on its own pixels.
MY_CHAR_CENTER = (603, 683.5)
MY_CHAR_H = 419

ASSEMBLY_H = 880
ASSEMBLY_W = round(HERO.width * ASSEMBLY_H / HERO.height)
ASSEMBLY_X = (W - ASSEMBLY_W) // 2
ASSEMBLY_Y = 440
HERO_BIG = HERO.resize((ASSEMBLY_W, ASSEMBLY_H), Image.NEAREST)
HERO_BLOCKS = make_blocks(HERO_BIG, 22, seed=7, scatter=(260, 720), delay_max=52)


def hero_at(height: int) -> Image.Image:
    w = round(HERO.width * height / HERO.height)
    return HERO.resize((w, height), Image.NEAREST)


# ----------------------------------------------------------------- act 1

def act_viewfinder(frame: int, length: int) -> Image.Image:
    """Corner brackets close in, flash — then the pixels fly home."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    headline(layer, ["사진 한 장이면 돼요"], span(frame, 2, 20))

    # Viewfinder brackets, borrowed from the app's own framing guides.
    vf = span(frame, 6, 22)
    flash_at = 34
    gone = span(frame, flash_at, 10)
    if vf > 0 and gone < 1:
        a = round(255 * ease_out(vf) * (1 - gone))
        inset = 120 + rise(70, vf)
        x0, y0 = ASSEMBLY_X - inset + ASSEMBLY_W // 2 - 220, ASSEMBLY_Y - 40
        x1, y1 = x0 + 440 + 2 * 0, ASSEMBLY_Y + ASSEMBLY_H + 40
        x0, x1 = W // 2 - 300 - rise(60, vf), W // 2 + 300 + rise(60, vf)
        br, wd = 64, 8
        for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            draw.line((cx, cy, cx + br * sx, cy), fill=(*VIOLET, a), width=wd)
            draw.line((cx, cy, cx, cy + br * sy), fill=(*VIOLET, a), width=wd)

    # The flash: one bright beat where the photo becomes raw material.
    fl = span(frame, flash_at, 8)
    if 0 < fl < 1:
        flash = Image.new("RGBA", (W, H), (255, 255, 255, round(190 * (1 - fl))))
        layer.alpha_composite(flash)

    # Blocks assemble from the flash onward.
    completion = 0.0
    sharpen = span(frame, flash_at + 2 + 52 + 20, 14)
    if frame >= flash_at:
        # The chunky blocks fade *out* as the crisp sprite fades in — leaving
        # them underneath let their quantised edges poke past the clean
        # silhouette and read as debris.
        completion = draw_assembly(layer, HERO_BLOCKS, (ASSEMBLY_X, ASSEMBLY_Y),
                                   frame, flash_at + 2, dur_each=26,
                                   alpha=1 - ease_out(sharpen))
    if sharpen > 0:
        sp = HERO_BIG.copy()
        r, g, b, a = sp.split()
        sp = Image.merge("RGBA", (r, g, b, a.point(lambda p: round(p * ease_out(sharpen)))))
        layer.alpha_composite(sp, (ASSEMBLY_X, ASSEMBLY_Y))
    if completion >= 0.999:
        burst(layer, W // 2, ASSEMBLY_Y + 60, frame, flash_at + 2 + 52 + 22, seed=11)

    caption(layer, "오늘의 내가 픽셀 캐릭터로", span(frame, flash_at + 60, 20))
    return layer


# ----------------------------------------------------------------- act 2

# Internal navigation timing (frames within the act).
NAV1_AT, NAV_LEN = 96, 16     # MY → 광장
NAV2_AT = 212                 # 광장 → 오늘
TAP_SQUARE = (813, 2019)      # 민주 in the square capture
TAP_WAVE = (603, 2176)        # 친해지고 싶어요 in the today capture


def tour_params(frame: int):
    """Which screenshot(s) the bezel is showing, and their camera params."""
    if frame < NAV1_AT:
        return ("my", 1.0, 0.5), None, 0.0
    if frame < NAV1_AT + NAV_LEN:
        t = ease_in_out((frame - NAV1_AT) / NAV_LEN)
        return ("my", 1.0, 0.5), ("square", 1.16, 0.34), t
    if frame < NAV2_AT:
        pan = span(frame, NAV1_AT + NAV_LEN, NAV2_AT - NAV1_AT - NAV_LEN)
        return ("square", 1.16, 0.34 + 0.26 * ease_in_out(pan)), None, 0.0
    if frame < NAV2_AT + NAV_LEN:
        t = ease_in_out((frame - NAV2_AT) / NAV_LEN)
        return ("square", 1.16, 0.60), ("today", 1.06, 0.40), t
    p = span(frame, NAV2_AT + NAV_LEN, 90)
    return ("today", 1.06 + 0.06 * ease_in_out(p), 0.40 + 0.05 * ease_in_out(p)), None, 0.0


def act_tour(frame: int, length: int) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    entry = span(frame, 0, 28)

    (name_a, zoom_a, c_a), nxt, t = tour_params(frame)
    content_a, crop_a = content_image(name_a, zoom_a, c_a)
    if nxt is None or t <= 0:
        content = content_a
        crop = crop_a
    else:
        name_b, zoom_b, c_b = nxt
        content_b, crop_b = content_image(name_b, zoom_b, c_b)
        content = Image.new("RGB", (CONTENT_W, CONTENT_H), PAPER)
        shift = round(CONTENT_W * t)
        content.paste(content_a, (-shift, 0))
        content.paste(content_b, (CONTENT_W - shift, 0))
        crop = crop_b
    frame_img = bezel_wrap(content)

    tilt = 5.0 * (1 - ease_out(entry))
    slide = round(90 * (1 - ease_out(entry)))
    place_phone(layer, frame_img, PHONE_X, PHONE_Y, ease_out(entry), tilt, dy=slide)

    # --- the hero flies into its own place in the MY screen --------------
    land = span(frame, 6, 34)
    hold = span(frame, 44, 10)
    if hold < 1:
        h0, h1 = ASSEMBLY_H, MY_CHAR_H * SCALE
        hgt = round(h0 + (h1 - h0) * ease_in_out(land))
        sp = hero_at(max(2, hgt))
        cx0, cy0 = W // 2, ASSEMBLY_Y + ASSEMBLY_H // 2
        cx1 = PHONE_X + BEZEL_W + MY_CHAR_CENTER[0] * SCALE
        cy1 = PHONE_Y + BEZEL_W + MY_CHAR_CENTER[1] * SCALE
        e = ease_in_out(land)
        cx = cx0 + (cx1 - cx0) * e
        cy = cy0 + (cy1 - cy0) * e
        a = 1 - ease_in_out(hold)
        if a > 0.01:
            r, g, b, al = sp.split()
            sp = Image.merge("RGBA", (r, g, b, al.point(lambda p: round(p * a))))
            layer.alpha_composite(sp, (round(cx - sp.width / 2), round(cy - sp.height / 2)))

    # --- copy beats, crossfading with the navigation ----------------------
    headline(layer, ["오늘의 나를 담는 곳"], span(frame, 2, 18), span(frame, NAV1_AT - 6, 14))
    caption(layer, "매일의 내가 차곡차곡 쌓여요", span(frame, 30, 18), span(frame, NAV1_AT - 6, 14))

    headline(layer, ["지금 접속한 사람들이", "모이는 광장"],
             span(frame, NAV1_AT + 8, 18), span(frame, NAV2_AT - 6, 14))
    caption(layer, "캐릭터를 눌러 오늘의 한마디를 보세요",
            span(frame, NAV1_AT + 30, 18), span(frame, NAV2_AT - 6, 14))

    # The headline steps aside just before the bubble lands in its place —
    # the bubble *is* the sentence's payoff, so they never fight for space.
    headline(layer, ["서로 눌렀을 때만", "대화가 열려요"],
             span(frame, NAV2_AT + 8, 18), span(frame, NAV2_AT + 76, 12))
    caption(layer, "거절이라는 순간이 없어요", span(frame, NAV2_AT + 100, 18))

    # --- interactions ------------------------------------------------------
    if nxt is None:
        tp = span(frame, 168, 24)           # tap 민주 in the square
        if 0 < tp < 1 and name_a == "square":
            pt = map_point(*TAP_SQUARE, crop_a)
            if pt:
                ripple(layer, pt[0], pt[1], tp)

        wp = span(frame, NAV2_AT + 40, 24)  # tap 친해지고 싶어요
        if 0 < wp < 1 and name_a == "today":
            pt = map_point(*TAP_WAVE, crop_a)
            if pt:
                ripple(layer, pt[0], pt[1], wp)

    tt = span(frame, NAV2_AT + 58, 18)
    if tt > 0:
        toast(layer, "마음을 전했어요", W // 2,
              PHONE_Y + FRAME_H - 170 + rise(26, tt), ease_out(tt))

    # The payoff: a chat bubble springs off the top of the phone.
    bp = span(frame, NAV2_AT + 86, 20)
    if bp > 0:
        pop = ease_out_back(bp)
        bw, bh = round(250 * pop), round(146 * pop)
        bx, by = W // 2 - bw // 2, 180 + rise(30, bp)
        bub = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bub)
        if bw > 12:
            bd.rounded_rectangle((bx, by, bx + bw, by + bh),
                                 radius=round(40 * pop), fill=(*VIOLET, 255))
            bd.polygon([(W // 2 - round(20 * pop), by + bh - 2),
                        (W // 2 + round(20 * pop), by + bh - 2),
                        (W // 2, by + bh + round(30 * pop))], fill=(*VIOLET, 255))
            for dx in (-52, 0, 52):
                r = round(12 * pop)
                bd.ellipse((W // 2 + dx * pop - r, by + bh / 2 - r,
                            W // 2 + dx * pop + r, by + bh / 2 + r),
                           fill=(255, 255, 255, 255))
        layer.alpha_composite(bub)
        burst(layer, W // 2, 250, frame, NAV2_AT + 92, seed=23)

    return layer


# ----------------------------------------------------------------- act 3

def _wordmark_blocks():
    face = font(170, True)
    probe = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(probe)
    tracking = 20
    widths = [d.textbbox((0, 0), ch, font=face)[2] for ch in "PIXME"]
    total = sum(widths) + tracking * 4
    img = Image.new("RGBA", (total + 40, 240), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    x = 20
    for ch, w in zip("PIXME", widths):
        draw.text((x, 20), ch, font=face, fill=(*INK, 255))
        x += w + tracking
    return img, make_blocks(img, 12, seed=31, scatter=(120, 340), delay_max=36)


WM_IMG, WM_BLOCKS = _wordmark_blocks()
WM_X = (W - WM_IMG.width) // 2
WM_Y = 560

CAST = [
    ("generated-character-minju.png", 310, 360),
    ("generated-character-cheol.png", 540, 420),
    ("generated-character-1.png", 788, 340),
]
_cast_cache: dict[str, Image.Image] = {}


def cast_sprite(name, h):
    key = f"{name}:{h}"
    if key not in _cast_cache:
        img = Image.open(MOCK / name).convert("RGBA")
        img = img.crop(img.getbbox())
        w = round(img.width * h / img.height)
        _cast_cache[key] = img.resize((w, h), Image.NEAREST)
    return _cast_cache[key]


def act_outro(frame: int, length: int) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # The wordmark assembles out of pixels — the opening, answered.
    sharpen = span(frame, 6 + 36 + 14, 12)
    completion = draw_assembly(layer, WM_BLOCKS, (WM_X, WM_Y), frame, 6,
                               dur_each=20, alpha=1 - ease_out(sharpen))
    if sharpen > 0:
        wm = WM_IMG.copy()
        r, g, b, a = wm.split()
        wm = Image.merge("RGBA", (r, g, b, a.point(lambda p: round(p * ease_out(sharpen)))))
        layer.alpha_composite(wm, (WM_X, WM_Y))

    text_on(layer, "하루 한 장, 오늘의 나를 픽셀로.", 830 + rise(22, span(frame, 56, 20)),
            42, MUTED, False, ease_out(span(frame, 56, 20)))

    bar = span(frame, 70, 20)
    if bar > 0:
        bw = round(120 * ease_out(bar))
        ImageDraw.Draw(layer).rounded_rectangle(
            ((W - bw) / 2, 918, (W + bw) / 2, 926), radius=4, fill=(*VIOLET, 255))

    # The cast walks in under the mark, breathing gently.
    t = frame / FPS
    baseline = 1480
    for i, (name, cx, h) in enumerate(CAST):
        p = span(frame, 34 + i * 10, 24)
        if p <= 0:
            continue
        sp = cast_sprite(name, h)
        bob = round(4 * math.sin(t * 2.2 + i * 1.7))
        a = ease_out(p)
        img = sp
        if a < 0.995:
            r, g, b, al = sp.split()
            img = Image.merge("RGBA", (r, g, b, al.point(lambda q: round(q * a))))
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse(
            (cx - sp.width // 3, baseline - 12, cx + sp.width // 3, baseline + 12),
            fill=(0, 0, 0, round(40 * a)))
        layer.alpha_composite(sh)
        layer.alpha_composite(img, (cx - sp.width // 2, baseline - sp.height + rise(40, p) + bob))

    return layer


TIMELINE = [
    (act_viewfinder, 150),
    (act_tour, 330),
    (act_outro, 140),
]


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)

    starts, g = [], 0
    for i, (_, length) in enumerate(TIMELINE):
        starts.append(g)
        g += length - (OVERLAP if i < len(TIMELINE) - 1 else 0)
    total = g

    def shifted(layer, dx, alpha):
        if alpha < 0.995:
            r, gg, b, a = layer.split()
            layer = Image.merge("RGBA", (r, gg, b, a.point(lambda p: round(p * alpha))))
        if dx == 0:
            return layer
        out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        out.alpha_composite(layer, (dx, 0))
        return out

    for g in range(total):
        canvas = background(g)
        for i, (fn, length) in enumerate(TIMELINE):
            local = g - starts[i]
            if local < 0 or local >= length:
                continue
            dx, alpha = 0, 1.0
            if i > 0 and local < OVERLAP:
                t = ease_in_out(local / OVERLAP)
                dx, alpha = round(90 * (1 - t)), t
            if i < len(TIMELINE) - 1 and local >= length - OVERLAP:
                t = ease_in_out((local - (length - OVERLAP)) / OVERLAP)
                dx, alpha = round(-90 * t), 1 - t
            canvas.alpha_composite(shifted(fn(local, length), dx, alpha))
        canvas.convert("RGB").save(OUT_DIR / f"{g:05d}.png")

    print(f"rendered {total} frames ({total / FPS:.1f}s)")

    subprocess.run(
        ["ffmpeg", "-y", "-framerate", str(FPS), "-i", str(OUT_DIR / "%05d.png"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-crf", "18", "-movflags", "+faststart", str(OUT_FILE)],
        check=True, capture_output=True,
    )
    print(f"wrote {OUT_FILE} ({OUT_FILE.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
