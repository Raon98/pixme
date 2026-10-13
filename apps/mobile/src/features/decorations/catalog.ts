import type { DecorationSlot } from '@/api';
import { copy } from '@/constants/copy';

/**
 * How each unlock code actually draws.
 *
 * <p>The server owns *what* a user may apply; this owns *how it looks*. They
 * are deliberately separate: adding a background to the catalog is a data
 * change on the server, but it only renders once it has an entry here, so a
 * half-shipped client can never draw something it doesn't understand — it
 * falls back to the plain card instead.
 */

export interface BackgroundStyle {
  /** Gradient stops, top to bottom. Three stops give the sky real depth. */
  colors: readonly [string, string, ...string[]];
  /** Falling pixel particles layered over the gradient. */
  weather?: 'rain' | 'snow';
  /** Pixel star field — small squares, a couple of bright crosses. */
  stars?: boolean;
  /** One glowing disc: the sun sinking at dusk, the moon on a clear night. */
  orb?: {
    color: string;
    halo: string;
    /** Centre, as fractions of the card. */
    x: number;
    y: number;
    size: number;
  };
}

/**
 * These are sold for money, so each one has to read as a *scene*, not a tint:
 * a sunset has a sun, a starry night has stars and a moon. Everything is
 * still flat colour — no image assets — so they stay weightless and recolour
 * cleanly across card sizes.
 */
export const BACKGROUNDS: Record<string, BackgroundStyle> = {
  BG_SUNSET: {
    colors: ['#FFE2B0', '#FFB38C', '#E98BA4'],
    orb: { color: '#FFF2D5', halo: '#FFD9A066', x: 0.72, y: 0.68, size: 0.34 },
  },
  BG_STARRY: {
    colors: ['#2C2868', '#1B1840', '#100E24'],
    stars: true,
    orb: { color: '#F4EFD9', halo: '#F4EFD933', x: 0.78, y: 0.2, size: 0.16 },
  },
  BG_ANIMATED_RAIN: {
    colors: ['#B3C2D6', '#93A7C0', '#7D90A8'],
    weather: 'rain',
  },
  BG_ANIMATED_SNOW: {
    colors: ['#F1F5FB', '#DCE6F2', '#C3D2E4'],
    weather: 'snow',
  },
};

/** Backgrounds dark enough that caption text has to flip to a light colour. */
export const DARK_BACKGROUNDS = new Set(['BG_STARRY', 'BG_ANIMATED_RAIN']);

export interface FrameStyle {
  /** Outer border ink. */
  color: string;
  width: number;
  /** Inner inset line — the double-stroke that makes it read as a frame. */
  inset: string;
  /** Corner blocks, the pixel-art signature. */
  cornerColor: string;
}

export const FRAMES: Record<string, FrameStyle> = {
  FRAME_PIXEL: {
    color: '#2E2B26',
    width: 3,
    inset: '#FFFDF8',
    cornerColor: '#2E2B26',
  },
  FRAME_GOLD: {
    color: '#C9A227',
    width: 2.5,
    inset: '#FFF6D8',
    cornerColor: '#E3C254',
  },
  FRAME_TAPE: {
    // Reads as masking tape: no continuous border, just the four corners.
    color: 'transparent',
    width: 0,
    inset: 'transparent',
    cornerColor: '#E8C9A0',
  },
};

export interface NicknameStyle {
  /** Halo colour behind the letters. */
  glow: string;
  radius: number;
  /** Overrides the inherited text colour when the effect needs one. */
  color?: string;
}

/**
 * Nickname treatments. Deliberately a text *shadow* rather than a background
 * chip: the nickname sits on a card the owner also chose the background for,
 * and a filled chip would fight it.
 */
export const NICKNAMES: Record<string, NicknameStyle> = {
  NICKNAME_GLOW: { glow: '#F9AE2B', radius: 10 },
  // No `color` override: the nickname sits directly on the page background
  // (paper, not the decorated card), and a near-white neon tint meant for a
  // dark backdrop went nearly invisible there. The glow alone still reads as
  // neon; the ink stays whatever the surrounding text already is.
  NICKNAME_NEON: { glow: '#5BC8F5', radius: 12 },
};

/** @deprecated Prefer `NICKNAMES`; kept for the one legacy comparison. */
export const NICKNAME_GLOW_CODE = 'NICKNAME_GLOW';
export const HEART_PARTICLE_CODE = 'PARTICLE_HEART';
export const STAR_PARTICLE_CODE = 'PARTICLE_STAR';

export interface HeartParticle {
  dx: number;
  dy: number;
  delay: number;
  size: number;
  rotate: number;
}

export interface BurstStyle {
  particles: HeartParticle[];
  /** Which mark flies out. */
  glyph: 'heart' | 'star';
  /** Null keeps the theme's heart colour. */
  color?: string;
}

/**
 * The reaction burst, keyed on the *card author's* unlock.
 *
 * <p>Author-based, not viewer-based: a decoration you paid for has to be
 * something other people see. It was briefly the other way round, which meant
 * the only person who ever saw the effect was the one who did not buy it.
 *
 * <p>The plain set stays deliberately restrained — the spec asks for "a small
 * pixel heart naturally popping out", not confetti. Paid sets are wider and
 * longer; the star set swaps the mark entirely.
 */
export const HEART_PARTICLES_PLAIN: HeartParticle[] = [
  { dx: 0, dy: -62, delay: 0, size: 26, rotate: 0 },
  { dx: -26, dy: -44, delay: 60, size: 16, rotate: -18 },
  { dx: 24, dy: -48, delay: 95, size: 18, rotate: 16 },
  { dx: -14, dy: -78, delay: 150, size: 12, rotate: -8 },
  { dx: 16, dy: -84, delay: 185, size: 13, rotate: 10 },
];

export const HEART_PARTICLES_PREMIUM: HeartParticle[] = [
  { dx: 0, dy: -72, delay: 0, size: 30, rotate: 0 },
  { dx: -34, dy: -52, delay: 45, size: 18, rotate: -22 },
  { dx: 32, dy: -56, delay: 80, size: 20, rotate: 20 },
  { dx: -18, dy: -92, delay: 125, size: 14, rotate: -10 },
  { dx: 20, dy: -98, delay: 160, size: 15, rotate: 12 },
  { dx: -48, dy: -74, delay: 205, size: 11, rotate: -30 },
  { dx: 46, dy: -80, delay: 240, size: 12, rotate: 28 },
  { dx: -8, dy: -112, delay: 285, size: 10, rotate: -6 },
  { dx: 10, dy: -118, delay: 320, size: 9, rotate: 8 },
];

export const STAR_PARTICLES: HeartParticle[] = [
  { dx: 0, dy: -78, delay: 0, size: 26, rotate: 0 },
  { dx: -38, dy: -48, delay: 50, size: 16, rotate: -24 },
  { dx: 36, dy: -54, delay: 85, size: 17, rotate: 22 },
  { dx: -20, dy: -96, delay: 130, size: 13, rotate: -12 },
  { dx: 22, dy: -102, delay: 165, size: 14, rotate: 14 },
  { dx: -54, dy: -70, delay: 210, size: 10, rotate: -34 },
  { dx: 52, dy: -76, delay: 245, size: 11, rotate: 32 },
  { dx: 0, dy: -124, delay: 290, size: 9, rotate: 0 },
];

const PLAIN_BURST: BurstStyle = {
  particles: HEART_PARTICLES_PLAIN,
  glyph: 'heart',
};

export function burstFor(unlockCode: string | null | undefined): BurstStyle {
  if (unlockCode === HEART_PARTICLE_CODE) {
    return { particles: HEART_PARTICLES_PREMIUM, glyph: 'heart' };
  }
  if (unlockCode === STAR_PARTICLE_CODE) {
    return { particles: STAR_PARTICLES, glyph: 'star', color: '#F2C14E' };
  }
  return PLAIN_BURST;
}

/** Which slot a decoration unlock code belongs to, for callers that only
 * have the code (e.g. offering to apply a purchase immediately). */
export function slotForUnlockCode(unlockCode: string): DecorationSlot | null {
  if (unlockCode in BACKGROUNDS) return 'BACKGROUND';
  if (unlockCode in FRAMES) return 'FRAME';
  if (unlockCode in NICKNAMES) return 'NICKNAME';
  if (unlockCode === HEART_PARTICLE_CODE || unlockCode === STAR_PARTICLE_CODE) {
    return 'PARTICLE';
  }
  return null;
}

/**
 * Slots the client can actually draw today. Others stay out of the picker —
 * THEME is retired (it recoloured the whole app, which never read as "mine"),
 * and POSE/EMOTION are not built yet. The server enum still carries them, so
 * old rows stay readable.
 */
export const RENDERABLE_SLOTS = [
  'BACKGROUND',
  'FRAME',
  'NICKNAME',
  'PARTICLE',
] as const satisfies readonly DecorationSlot[];

export const SLOT_LABELS: Record<(typeof RENDERABLE_SLOTS)[number], string> =
  copy.decorations.slots;
