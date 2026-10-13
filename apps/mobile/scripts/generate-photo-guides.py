#!/usr/bin/env python3
"""
Generates the two "how to frame yourself" guides shown on the create sheet.

Run after editing:
    python3 apps/mobile/scripts/generate-photo-guides.py

Built by compositing the real generated characters into a viewfinder frame
rather than drawing abstract silhouettes. Two reasons: a flat shape says
nothing about how much of you should be in frame, and the app's entire
visual language is this pixel art — a generic grey figure looks like it
belongs to a different product.

Nearest-neighbour everywhere, same as every other character render: pixel
art smoothed by bilinear scaling looks broken.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

PAPER = (255, 253, 248, 255)
INK = (46, 43, 38, 255)
VIOLET = (124, 108, 240, 255)
SKY_TOP = (234, 242, 255, 255)
SKY_BOTTOM = (250, 243, 238, 255)

W, H = 480, 620
CORNER = 46
BRACKET = 54
BRACKET_WIDTH = 7

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "guides"
MOCK = ROOT / "assets" / "mock"


def backdrop() -> Image.Image:
    """Soft vertical wash, so the character doesn't float on flat white."""
    base = Image.new("RGBA", (W, H), SKY_TOP)
    draw = ImageDraw.Draw(base)
    for y in range(H):
        t = y / (H - 1)
        draw.line(
            [(0, y), (W, y)],
            fill=tuple(
                round(SKY_TOP[i] + (SKY_BOTTOM[i] - SKY_TOP[i]) * t) for i in range(4)
            ),
        )
    return base


def rounded_mask() -> Image.Image:
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), radius=CORNER, fill=255)
    return mask


def ground_shadow(canvas: Image.Image, cx: int, baseline: int, width: int) -> None:
    """The same contact shadow the square draws, so the figure stands."""
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        (cx - width // 2, baseline - 14, cx + width // 2, baseline + 14),
        fill=(0, 0, 0, 46),
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(7)))


def viewfinder(canvas: Image.Image) -> None:
    """Corner brackets — reads as a camera frame without a literal camera UI."""
    draw = ImageDraw.Draw(canvas)
    pad = 26
    for x_dir, y_dir, x0, y0 in (
        (1, 1, pad, pad),
        (-1, 1, W - pad, pad),
        (1, -1, pad, H - pad),
        (-1, -1, W - pad, H - pad),
    ):
        draw.line(
            [(x0, y0), (x0 + BRACKET * x_dir, y0)], fill=VIOLET, width=BRACKET_WIDTH
        )
        draw.line(
            [(x0, y0), (x0, y0 + BRACKET * y_dir)], fill=VIOLET, width=BRACKET_WIDTH
        )


def character(name: str) -> Image.Image:
    image = Image.open(MOCK / name).convert("RGBA")
    return image.crop(image.getbbox())


def scaled(sprite: Image.Image, target_height: int) -> Image.Image:
    ratio = target_height / sprite.height
    return sprite.resize(
        (max(1, round(sprite.width * ratio)), target_height), Image.NEAREST
    )


def compose(sprite: Image.Image, top: int, baseline: int | None) -> Image.Image:
    canvas = backdrop()
    cx = W // 2
    if baseline is not None:
        ground_shadow(canvas, cx, baseline, round(sprite.width * 0.62))
    canvas.alpha_composite(sprite, (cx - sprite.width // 2, top))

    canvas.putalpha(rounded_mask())
    framed = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    framed.alpha_composite(canvas)
    viewfinder(framed)

    border = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        (2, 2, W - 3, H - 3), radius=CORNER, outline=INK, width=5
    )
    framed.alpha_composite(border)
    return framed


def selfie_guide() -> Image.Image:
    """Head and shoulders, face filling the frame."""
    sprite = character("generated-character-minju.png")
    # These are chibi proportions — the head alone is about a third of the
    # body, so a "head and shoulders" crop has to reach down nearly half the
    # sprite. Cropping at a third (the realistic-proportions guess) cut the
    # face off at the lips.
    tall = scaled(sprite, round(H * 2.1))
    head = tall.crop((0, 0, tall.width, round(tall.height * 0.47)))
    head = scaled(head, round(H * 0.84))
    return compose(head, top=round(H * 0.09), baseline=None)


def ootd_guide() -> Image.Image:
    """Whole outfit, head to shoes, with room above and below."""
    sprite = scaled(character("generated-character-1.png"), round(H * 0.74))
    top = round(H * 0.11)
    return compose(sprite, top=top, baseline=top + sprite.height)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    selfie_guide().save(ASSETS / "selfie.png")
    ootd_guide().save(ASSETS / "ootd.png")
    print("wrote selfie.png, ootd.png")


if __name__ == "__main__":
    main()
