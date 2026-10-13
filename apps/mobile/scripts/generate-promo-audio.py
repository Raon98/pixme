#!/usr/bin/env python3
"""
Synthesizes the PIXME promo film's score and sound effects from scratch —
every waveform here is generated math, not a licensed or downloaded sample,
so there is no rights question to track.

    python3 apps/mobile/scripts/generate-promo-audio.py

Timed against the exact frame numbers in generate-promo-video.py (converted
to seconds at 30fps) so the beats actually land on the picture: the shutter
on the viewfinder flash, a rising shimmer while the pixels assemble, a tap
click under each fingertip ripple, a chime on the toast, and the score's one
real swell under the "둘이 연결됐어요" bubble — the film's one emotional
beat, so it's the only moment that gets a full chord hit rather than a
one-shot.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
AUDIO_FILE = BUILD / "pixme-promo-audio.wav"

# Mirrors the video script's own timeline math (see generate-promo-video.py)
# — kept in sync by construction rather than re-measured by hand.
FPS = 30
OVERLAP = 12
LENGTHS = [150, 330, 140]
STARTS = [0, 150 - OVERLAP, 150 - OVERLAP + 330 - OVERLAP]
TOTAL_FRAMES = STARTS[-1] + LENGTHS[-1]
DURATION = TOTAL_FRAMES / FPS


def g(local: int, act: int) -> float:
    """Local frame in a given act (0-indexed) → seconds on the final timeline."""
    return (STARTS[act] + local) / FPS


# -------------------------------------------------------------- synthesis

def t_axis(dur: float) -> np.ndarray:
    return np.linspace(0, dur, max(1, round(dur * SR)), endpoint=False)


def env_ad(n: int, attack: float, decay: float) -> np.ndarray:
    """Attack/exponential-decay envelope, `attack`/`decay` in seconds."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = np.exp(-t / max(decay, 1e-4))
    return a * d


def tone(freq: float, dur: float, attack=0.01, decay=0.3, wave="sine", drift=0.0):
    t = t_axis(dur)
    phase = 2 * np.pi * freq * t
    if drift:
        phase += 2 * np.pi * drift * t * t / 2  # simple linear chirp
    if wave == "sine":
        y = np.sin(phase)
    elif wave == "triangle":
        y = 2 / np.pi * np.arcsin(np.sin(phase))
    elif wave == "square":
        y = np.sign(np.sin(phase)) * 0.5
    else:
        raise ValueError(wave)
    return y * env_ad(len(t), attack, decay)


def chord(freqs, dur, attack=0.02, decay=0.9, wave="triangle"):
    out = np.zeros(max(1, round(dur * SR)))
    for f in freqs:
        v = tone(f, dur, attack, decay, wave)
        out[: len(v)] += v / len(freqs)
    return out


def sweep(f0: float, f1: float, dur: float, attack=0.005, decay=None, wave="sine"):
    """A pitch glide from f0 to f1 — used for whooshes and the fly-in."""
    n = max(1, round(dur * SR))
    t = np.arange(n) / SR
    freq_t = f0 + (f1 - f0) * (t / dur)
    phase = 2 * np.pi * np.cumsum(freq_t) / SR
    y = np.sin(phase) if wave == "sine" else (2 / np.pi) * np.arcsin(np.sin(phase))
    return y * env_ad(n, attack, decay if decay is not None else dur * 0.6)


def noise_band(dur: float, low: float, high: float, attack=0.02, decay=0.3):
    n = max(1, round(dur * SR))
    x = np.random.default_rng(0).standard_normal(n)
    sos = butter(4, [low, high], btype="band", fs=SR, output="sos")
    y = sosfilt(sos, x)
    y = y / (np.max(np.abs(y)) + 1e-9)
    return y * env_ad(n, attack, decay)


def lowpass(y: np.ndarray, cutoff: float) -> np.ndarray:
    sos = butter(2, cutoff, btype="low", fs=SR, output="sos")
    return sosfilt(sos, y)


def place(bed: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0) -> None:
    start = round(at * SR)
    end = min(len(bed), start + len(sound))
    if start >= len(bed) or end <= start:
        return
    bed[start:end] += sound[: end - start] * gain


# ------------------------------------------------------------------- bed
# A four-chord lo-fi loop under the whole film — warm triangle-wave pad,
# soft low-passed so it sits behind the sound effects rather than competing.
# ~92 BPM, 4 beats/bar, one chord per bar.

BPM = 92
BEAT = 60 / BPM
BAR = BEAT * 4

# Dm9 – Bbmaj7 – F – C, voiced close so the pad stays soft rather than wide.
PROGRESSION = [
    [146.83, 174.61, 220.00, 261.63],   # D3 F3 A3 C4  (Dm9, 3rd omitted low)
    [116.54, 146.83, 174.61, 233.08],   # Bb2 D3 F3 Bb3
    [174.61, 220.00, 261.63, 349.23],   # F3 A3 C4 F4
    [130.81, 164.81, 196.00, 261.63],   # C3 E3 G3 C4
]


def build_bed(duration: float) -> np.ndarray:
    bed = np.zeros(round(duration * SR) + SR)
    beat_idx = 0
    tpos = 0.0
    while tpos < duration + BAR:
        bar_chord = PROGRESSION[beat_idx % len(PROGRESSION)]
        pad = chord(bar_chord, BAR * 1.08, attack=0.25, decay=BAR * 0.9, wave="triangle")
        pad = lowpass(pad, 1400)
        place(bed, pad, tpos, gain=0.17)
        # A soft brushed "kick" on beat 1 of every bar — just enough pulse to
        # feel like a track, never loud enough to read as percussion.
        kick = tone(58, 0.22, attack=0.002, decay=0.16, wave="sine") * 0.5
        place(bed, kick, tpos, gain=0.5)
        tpos += BAR
        beat_idx += 1

    # A thin vinyl-hiss bed — the one textural cliché that actually reads as
    # "lo-fi" rather than "silence with chords in it".
    hiss = np.random.default_rng(1).standard_normal(len(bed))
    hiss = sosfilt(butter(2, [800, 6000], btype="band", fs=SR, output="sos"), hiss)
    hiss = hiss / (np.max(np.abs(hiss)) + 1e-9)
    bed += hiss * 0.012
    return bed


# ------------------------------------------------------------------- sfx

def build_sfx(duration: float) -> np.ndarray:
    sfx = np.zeros(round(duration * SR) + SR)

    # --- Act 1: viewfinder → flash → assembly → focus-pull → burst --------
    flash_at = g(34, 0)
    place(sfx, noise_band(0.05, 1500, 9000, attack=0.001, decay=0.03), flash_at - 0.05, 0.5)
    place(sfx, tone(1800, 0.05, attack=0.001, decay=0.02, wave="square"), flash_at, 0.35)

    # Rising granular shimmer while blocks fly home — many short high grains
    # with upward-drifting pitch, density increasing toward the landing.
    assembly_start, assembly_end = g(36, 0), g(36 + 52 + 26, 0)
    rng = np.random.default_rng(42)
    span = assembly_end - assembly_start
    n_grains = 90
    for i in range(n_grains):
        frac = i / n_grains
        at = assembly_start + frac * span + rng.uniform(-0.01, 0.01)
        freq = 1400 + frac * 2600 + rng.uniform(-80, 80)
        grain = tone(freq, 0.045, attack=0.002, decay=0.035, wave="sine")
        place(sfx, grain, at, gain=0.05 + 0.05 * frac)

    # Focus-pull settle + sparkle burst as the sprite sharpens.
    settle_at = g(108, 0)
    place(sfx, sweep(2200, 1100, 0.3, decay=0.25), settle_at, 0.3)
    burst_at = g(110, 0)
    place(sfx, chord([1046.5, 1318.5, 1568.0], 0.5, attack=0.003, decay=0.4, wave="sine"),
          burst_at, 0.28)

    # --- Act 2: phone entry, fly-in, landing, nav swipes, taps, payoff -----
    phone_in_at = g(0, 1)
    place(sfx, sweep(300, 900, 0.32, decay=0.22), phone_in_at, 0.22)

    fly_at = g(6, 1)
    place(sfx, sweep(2000, 500, 0.9, decay=0.7), fly_at, 0.22)
    land_at = g(44, 1)
    place(sfx, tone(500, 0.08, attack=0.001, decay=0.06, wave="triangle"), land_at, 0.3)
    place(sfx, noise_band(0.05, 300, 1200, attack=0.001, decay=0.04), land_at, 0.22)

    nav1_at = g(96, 1)
    place(sfx, sweep(600, 1600, 0.26, decay=0.2), nav1_at, 0.2)
    nav2_at = g(212, 1)
    place(sfx, sweep(600, 1600, 0.26, decay=0.2), nav2_at, 0.2)

    tap_square_at = g(168, 1)
    place(sfx, tone(900, 0.05, attack=0.001, decay=0.035, wave="sine"), tap_square_at, 0.3)
    tap_wave_at = g(212 + 40, 1)
    place(sfx, tone(900, 0.05, attack=0.001, decay=0.035, wave="sine"), tap_wave_at, 0.3)

    toast_at = g(212 + 58, 1)
    place(sfx, chord([1318.5, 1760.0], 0.25, attack=0.004, decay=0.2, wave="sine"), toast_at, 0.22)

    # The one real swell: the connection bubble. A bright major-add9 hit plus
    # the confetti burst's own shimmer — this is the film's payoff beat.
    bubble_at = g(212 + 86, 1)
    place(sfx, chord([523.25, 659.25, 783.99, 987.77], 1.1, attack=0.01, decay=0.9, wave="triangle"),
          bubble_at, 0.3)
    bconf = assembly_start, assembly_end
    for i in range(16):
        at = bubble_at + 0.02 + rng.uniform(0, 0.35)
        freq = rng.uniform(1600, 3200)
        place(sfx, tone(freq, 0.05, attack=0.001, decay=0.04, wave="sine"), at, 0.05)

    # --- Act 3: wordmark reassembles, underline, cast walk-in --------------
    wm_start, wm_end = g(6, 2), g(6 + 36 + 20, 2)
    span3 = wm_end - wm_start
    for i in range(50):
        frac = i / 50
        at = wm_start + frac * span3 + rng.uniform(-0.01, 0.01)
        freq = 900 + frac * 2000 + rng.uniform(-60, 60)
        place(sfx, tone(freq, 0.04, attack=0.002, decay=0.03, wave="sine"), at, 0.045)

    wm_settle_at = g(56, 2)
    place(sfx, chord([392.0, 493.88, 587.33], 0.6, attack=0.01, decay=0.5, wave="triangle"),
          wm_settle_at, 0.22)

    bar_at = g(70, 2)
    place(sfx, sweep(400, 1100, 0.3, decay=0.24), bar_at, 0.16)

    for i, local in enumerate((34, 44, 54)):
        at = g(local, 2)
        place(sfx, tone(260 + i * 40, 0.07, attack=0.002, decay=0.06, wave="triangle"), at, 0.14)

    return sfx


def main() -> None:
    bed = build_bed(DURATION)
    sfx = build_sfx(DURATION)
    n = max(len(bed), len(sfx))
    bed = np.pad(bed, (0, n - len(bed)))
    sfx = np.pad(sfx, (0, n - len(sfx)))
    mix = bed + sfx

    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.9  # headroom, no hard clipping

    # Trim/pad to exactly match the video's duration.
    target_n = round(DURATION * SR)
    if len(mix) < target_n:
        mix = np.pad(mix, (0, target_n - len(mix)))
    mix = mix[:target_n]

    stereo = np.stack([mix, mix], axis=1)
    pcm = np.clip(stereo * 32767, -32768, 32767).astype("<i2")

    import wave
    BUILD.mkdir(parents=True, exist_ok=True)
    with wave.open(str(AUDIO_FILE), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print(f"wrote {AUDIO_FILE} ({DURATION:.2f}s)")

    for name in ("pixme-promo.mp4", "pixme-promo-square.mp4", "pixme-promo-wide.mp4"):
        src = BUILD / name
        if not src.exists():
            continue
        dst = BUILD / name.replace(".mp4", "-sound.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), "-i", str(AUDIO_FILE),
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(dst)],
            check=True, capture_output=True,
        )
        print(f"wrote {dst}")


if __name__ == "__main__":
    main()
