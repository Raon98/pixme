#!/usr/bin/env python3
"""
Generates every PIXME launcher/notification/splash asset from the wordmark.

Run after editing WORDMARK, the palette, or the font:

    python3 apps/mobile/scripts/generate-icons.py

Seven assets are derived from one text render so they can never drift apart.
The PNGs are build input (Expo reads them via app.config.ts); this script is
the editable original.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WORDMARK = "PIXME"
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

PAPER = (255, 253, 248, 255)  # palette.paper[50]
INK = (46, 43, 38, 255)  # palette.paper[800]
VIOLET = (124, 108, 240, 255)  # palette.violet[500]
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

ASSETS = Path(__file__).resolve().parent.parent / "assets"


def text_layer(size, color, coverage=0.72):
    """WORDMARK centred on a transparent `size` square, filling `coverage` of
    the width. Font size is found by measuring, not guessed, so WORDMARK can
    change length without hand-tuning a point size."""
    canvas = Image.new("RGBA", (size, size), CLEAR)
    draw = ImageDraw.Draw(canvas)

    target_width = size * coverage
    font_size = 10
    font = ImageFont.truetype(FONT_PATH, font_size)
    while True:
        box = draw.textbbox((0, 0), WORDMARK, font=font)
        if box[2] - box[0] >= target_width:
            break
        font_size += 2
        font = ImageFont.truetype(FONT_PATH, font_size)

    box = draw.textbbox((0, 0), WORDMARK, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((size - w) / 2 - box[0], (size - h) / 2 - box[1]),
        WORDMARK,
        font=font,
        fill=color,
    )
    return canvas


def flat(size, bg, fg, coverage=0.72, rounded=False):
    canvas = Image.new("RGBA", (size, size), CLEAR)
    if rounded:
        ImageDraw.Draw(canvas).rounded_rectangle(
            (0, 0, size - 1, size - 1), radius=int(size * 0.225), fill=bg
        )
    else:
        canvas.paste(bg, (0, 0, size, size))
    text = text_layer(size, fg, coverage)
    canvas.paste(text, (0, 0), text)
    return canvas


def opaque(image):
    """Drops the alpha channel — an iOS app icon carrying one is rejected."""
    return image.convert("RGB")


def main():
    opaque(flat(1024, PAPER, INK)).save(ASSETS / "icon.png")
    opaque(flat(48, PAPER, INK)).save(ASSETS / "favicon.png")

    # Android adaptive: the system composites foreground over background then
    # masks the result, so the wordmark must stay inside the 66% safe zone or
    # a round mask will clip it.
    text_layer(512, INK, coverage=0.5).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (512, 512), PAPER).save(ASSETS / "android-icon-background.png")
    text_layer(512, WHITE, coverage=0.5).save(ASSETS / "android-icon-monochrome.png")

    # Android notifications: the system keeps only the alpha channel and
    # tints it, so this must be a flat white silhouette.
    text_layer(96, WHITE, coverage=0.78).save(ASSETS / "notification-icon.png")

    # Splash screen's own background is already the paper colour
    # (app.config.ts expo-splash-screen plugin), so this is text only, same
    # ink colour as the home-screen icon — not a second, differently-coloured
    # box on top of it. A filled violet square here (tried once) reads as a
    # loading glitch rather than part of the icon.
    text_layer(1024, INK, coverage=0.5).save(ASSETS / "splash-icon.png")

    for name in sorted(p.name for p in ASSETS.glob("*.png")):
        print("wrote", name)


if __name__ == "__main__":
    main()
