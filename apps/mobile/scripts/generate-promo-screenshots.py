#!/usr/bin/env python3
"""
App Store screenshots — designed, at Apple's exact required size.

    python3 apps/mobile/scripts/generate-promo-screenshots.py

Output is 1320×2868, the 6.9" iPhone bucket App Store Connect requires (and
the one it will scale down from for smaller devices), so these upload
without a size complaint.

Each is composed, not pasted: the brand's drifting colour-field background
(the same one the promo film uses), a headline and sub-line, then the real
capture inside a device bezel with a soft shadow. The capture itself is
unmodified app pixels — the bezel just gives the status bar and the
dynamic island somewhere to belong, instead of a black blob butting against
a caption band, which is what the first pass looked like.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# App Store Connect, 6.9" display (iPhone 16/17 Pro Max).
W, H = 1290, 2796

PAPER = (255, 253, 248)
INK = (26, 24, 20)
VIOLET = (124, 108, 240)
SKYBLUE = (173, 197, 255)
PEACH = (255, 196, 170)
MUTED = (132, 126, 117)
BEZEL = (22, 21, 19)

ROOT = Path(__file__).resolve().parent.parent
MOCK = ROOT / "assets" / "mock"
OUT_DIR = ROOT / "build" / "screenshots"
FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

# Phone geometry inside the 1320×2868 canvas.
FRAME_W = 919
BEZEL_W = 20
CORNER = 84
CONTENT_W = FRAME_W - 2 * BEZEL_W
HEAD_TOP = 147
FRAME_TOP = 606


def font(size: int, heavy: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size, index=8 if heavy else 2)


def centred(draw, body, y, size, colour, heavy=False):
    face = font(size, heavy)
    w = draw.textbbox((0, 0), body, font=face)[2]
    draw.text(((W - w) / 2, y), body, font=face, fill=colour)


def orb(colour, radius: int) -> Image.Image:
    size = radius * 2
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx - radius) ** 2 + (yy - radius) ** 2) / radius
    alpha = (np.clip(1 - d, 0, 1) ** 2 * 60).astype("uint8")
    arr = np.zeros((size, size, 4), dtype="uint8")
    arr[..., 0], arr[..., 1], arr[..., 2] = colour
    arr[..., 3] = alpha
    return Image.fromarray(arr, "RGBA")


def background(variant: int) -> Image.Image:
    """
    Same colour language as the film, nudged per screenshot so a row of five
    in the App Store reads as a set rather than five copies of one slide.
    """
    canvas = Image.new("RGBA", (W, H), (*PAPER, 255))
    layouts = [
        [(VIOLET, 520, 0.80, 0.14), (SKYBLUE, 560, 0.12, 0.72), (PEACH, 360, 0.18, 0.08)],
        [(SKYBLUE, 540, 0.84, 0.20), (VIOLET, 520, 0.10, 0.66), (PEACH, 340, 0.72, 0.88)],
        [(PEACH, 420, 0.16, 0.12), (VIOLET, 540, 0.86, 0.58), (SKYBLUE, 500, 0.20, 0.86)],
        [(VIOLET, 500, 0.14, 0.18), (PEACH, 380, 0.84, 0.30), (SKYBLUE, 540, 0.78, 0.84)],
        [(SKYBLUE, 520, 0.18, 0.16), (PEACH, 360, 0.80, 0.14), (VIOLET, 540, 0.84, 0.78)],
        [(VIOLET, 540, 0.22, 0.80), (SKYBLUE, 520, 0.80, 0.22), (PEACH, 380, 0.50, 0.06)],
    ]
    for colour, radius, bx, by in layouts[variant % len(layouts)]:
        canvas.alpha_composite(
            orb(colour, radius), (int(W * bx) - radius, int(H * by) - radius)
        )
    return canvas


def device(capture: Image.Image) -> Image.Image:
    """The capture, unmodified, inside a bezel."""
    content_h = round(CONTENT_W * capture.height / capture.width)
    content = capture.resize((CONTENT_W, content_h), Image.LANCZOS)

    frame_h = content_h + 2 * BEZEL_W
    frame = Image.new("RGBA", (FRAME_W, frame_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((0, 0, FRAME_W - 1, frame_h - 1), radius=CORNER, fill=BEZEL)

    mask = Image.new("L", (CONTENT_W, content_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, CONTENT_W - 1, content_h - 1), radius=CORNER - BEZEL_W, fill=255
    )
    frame.paste(content, (BEZEL_W, BEZEL_W), mask)
    return frame


def compose(capture_name: str, headline: list[str], sub: str,
            out_name: str, variant: int) -> None:
    capture = Image.open(MOCK / capture_name).convert("RGB")
    canvas = background(variant)
    draw = ImageDraw.Draw(canvas)

    y = HEAD_TOP
    for line in headline:
        centred(draw, line, y, 102, INK, heavy=True)
        y += 133
    centred(draw, sub, y + 14, 49, MUTED)

    frame = device(capture)
    x = (W - frame.width) // 2

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    blurred = frame.split()[3].filter(ImageFilter.GaussianBlur(40))
    shadow.paste(Image.new("RGBA", frame.size, (0, 0, 0, 90)), (x, FRAME_TOP + 34), blurred)
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(frame, (x, FRAME_TOP))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{out_name}.png"
    canvas.convert("RGB").save(out_path)
    print(f"wrote {out_path} ({canvas.width}x{canvas.height})")


SHOTS = [
    ("screen-create.png", ["사진 한 장이면", "충분해요"],
     "셀카든 전신이든, 오늘 찍은 걸로", "01-create"),
    ("screen-today.png", ["오늘의 내가", "픽셀 캐릭터로"],
     "기분과 한마디를 함께 남겨요", "02-today"),
    ("screen-square.png", ["지금 접속한 사람들이", "모이는 광장"],
     "캐릭터를 눌러 오늘의 한마디를 보세요", "03-square"),
    # The conversation *list* is deliberately not in the set: with one thread
    # it reads as an empty app. The thread itself says "대화" far better.
    ("screen-thread.png", ["서로 원할 때만", "열리는 대화"],
     "거절이라는 순간이 없어요", "04-chat"),
    ("screen-my.png", ["매일의 내가", "차곡차곡 쌓여요"],
     "지난 PIXME는 언제든 다시 꺼내 입어요", "05-my"),
]


def main() -> None:
    for i, (capture, headline, sub, out_name) in enumerate(SHOTS):
        compose(capture, headline, sub, out_name, i)


if __name__ == "__main__":
    main()
