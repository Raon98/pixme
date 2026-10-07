/**
 * PIXME Design Tokens
 *
 * Single source of truth for every raw design value in the app. Screens and
 * components must never hardcode a colour, radius or spacing value — they read
 * from the semantic theme (see `themes.ts`), which is built from these tokens.
 *
 * Art direction note: PIXME's hero is the pixel character. The UI palette is
 * intentionally quiet (warm paper neutrals + one soft violet accent) so the
 * characters stay the most saturated thing on screen.
 */

/* ------------------------------------------------------------------ palette */

export const palette = {
  /** Warm paper neutrals — the canvas the characters sit on. */
  paper: {
    0: '#FFFFFF',
    50: '#FFFDF8',
    100: '#FBF7EF',
    150: '#F5F0E6',
    200: '#EDE7DB',
    300: '#DCD5C7',
    400: '#B9B1A2',
    500: '#8E8778',
    600: '#6B6558',
    700: '#4C4740',
    800: '#2E2B26',
    900: '#1A1816',
    950: '#0F0E0D',
  },

  /** Brand accent — soft violet. Used sparingly: CTA, active tab, links. */
  violet: {
    50: '#F3F1FE',
    100: '#E6E2FD',
    200: '#CFC8FB',
    300: '#B0A5F7',
    400: '#9183F2',
    500: '#7C6CF0',
    600: '#6453DD',
    700: '#5243B4',
    800: '#3F348A',
    900: '#2C2561',
  },

  /** Heart / reaction pink. */
  rose: {
    50: '#FFF1F4',
    100: '#FFE0E7',
    200: '#FFC2CF',
    300: '#FF9BB1',
    400: '#FA7093',
    500: '#F04F79',
    600: '#D43462',
    700: '#A8264B',
  },

  /** "친해지고 싶어요" wave — warm amber, distinct from the heart. */
  amber: {
    50: '#FFF8EB',
    100: '#FFEDCC',
    200: '#FFDA99',
    300: '#FFC561',
    400: '#F9AE2B',
    500: '#E59412',
    600: '#BC770B',
    700: '#8E590A',
  },

  /** Connection / success mint. */
  mint: {
    50: '#EDFBF4',
    100: '#D3F5E4',
    200: '#A5EACA',
    300: '#6FD9AB',
    400: '#3FC08C',
    500: '#22A273',
    600: '#17805A',
    700: '#116145',
  },

  /** Destructive / error. */
  red: {
    50: '#FFF1F1',
    100: '#FFDEDE',
    200: '#FFBDBD',
    300: '#FF8E8E',
    400: '#F65D5D',
    500: '#E03B3B',
    600: '#B82A2A',
    700: '#8C2020',
  },

  /** Night square / dark surfaces. */
  night: {
    100: '#C8C6D8',
    200: '#9A96B4',
    300: '#6F6A8C',
    400: '#4A4664',
    500: '#332F49',
    600: '#242136',
    700: '#191728',
    800: '#11101C',
    900: '#0A0912',
  },

  transparent: 'transparent',
  black: '#000000',
  white: '#FFFFFF',
} as const;

/* ------------------------------------------------------------------ spacing */

/** 4pt base grid. Use `spacing.md` etc, never a bare number. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
  giant: 72,
} as const;

export type SpacingToken = keyof typeof spacing;

/* ------------------------------------------------------------------- radius */

export const radius = {
  none: 0,
  /** Pixel-art friendly tiny corner. */
  pixel: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;

/* --------------------------------------------------------------- typography */

/**
 * Two families:
 *  - `sans`  : the reading face (system UI font — fast, localised, legible KR)
 *  - `pixel` : the brand face, used only for the wordmark, numbers and badges
 *
 * The pixel face is registered in `src/theme/fonts.ts`; if it fails to load we
 * fall back to the system font rather than blocking first paint.
 */
export const fontFamily = {
  sans: undefined as string | undefined, // platform default
  sansMedium: undefined as string | undefined,
  pixel: 'PixmePixel',
} as const;

export const fontSize = {
  xxs: 10,
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  xxxl: 32,
  display: 40,
} as const;

export const lineHeight = {
  xxs: 14,
  xs: 16,
  sm: 18,
  base: 22,
  md: 24,
  lg: 26,
  xl: 30,
  xxl: 34,
  xxxl: 40,
  display: 48,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const letterSpacing = {
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
} as const;

/* -------------------------------------------------------------- elevation */

export const shadow = {
  none: {
    shadowColor: palette.transparent,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  xs: {
    shadowColor: palette.paper[900],
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: palette.paper[900],
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  md: {
    shadowColor: palette.paper[900],
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: palette.paper[900],
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/* -------------------------------------------------------------- animation */

export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 380,
  lazy: 600,
  /** One frame step of the 8fps character idle loop. */
  pixelStep: 125,
} as const;

export const easing = {
  /** Standard ease-out for entrances. */
  out: [0.22, 1, 0.36, 1] as const,
  /** Snappy ease-in-out for state changes. */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Slight overshoot for the heart pop. */
  pop: [0.34, 1.56, 0.64, 1] as const,
};

/* ------------------------------------------------------------------ layout */

export const layout = {
  /** Horizontal page gutter. */
  gutter: spacing.lg,
  /** Minimum hit target (Apple HIG = 44). */
  hitSlop: 44,
  tabBarHeight: 56,
  /** The raised centre "create" button diameter. */
  createButtonSize: 58,
  headerHeight: 52,
  maxContentWidth: 520,
  /** Feed card aspect ratio (portrait-ish, character centred). */
  feedCardAspect: 0.78,
  /** Square (광장) virtual canvas the server places characters on. */
  squareCanvas: { width: 1000, height: 1400 },
} as const;

export const zIndex = {
  base: 0,
  card: 10,
  sticky: 100,
  header: 200,
  tabBar: 300,
  sheet: 400,
  toast: 500,
  overlay: 600,
} as const;

/** Opacity steps, used for pressed/disabled states. */
export const opacity = {
  disabled: 0.4,
  pressed: 0.65,
  muted: 0.6,
  scrim: 0.55,
} as const;
