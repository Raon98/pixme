import { palette } from './tokens';

/**
 * Semantic colour contract. Every component consumes these names, never the
 * raw palette, so a new theme only needs to satisfy this interface.
 */
export interface ThemeColors {
  /* surfaces */
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceSubtle: string;
  surfacePressed: string;
  surfaceInverse: string;
  overlay: string;

  /* borders */
  border: string;
  borderStrong: string;
  borderFocus: string;

  /* text */
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textOnAccent: string;
  textDisabled: string;

  /* brand + intent */
  accent: string;
  accentPressed: string;
  accentSubtle: string;
  accentBorder: string;

  heart: string;
  heartSubtle: string;
  wave: string;
  waveSubtle: string;
  connection: string;
  connectionSubtle: string;
  danger: string;
  dangerSubtle: string;

  /* character stage — the backdrop a pixel character is composited onto */
  stage: string;
  stageTop: string;
  stageBottom: string;

  /* skeleton shimmer */
  skeleton: string;
  skeletonHighlight: string;

  /* tab bar */
  tabBar: string;
  tabBarBorder: string;
  tabIcon: string;
  tabIconActive: string;
}

export interface Theme {
  name: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  /** React Native `StatusBar` style that reads correctly on `background`. */
  statusBarStyle: 'light' | 'dark';
}

export const lightTheme: Theme = {
  name: 'light',
  isDark: false,
  statusBarStyle: 'dark',
  colors: {
    background: palette.paper[50],
    backgroundElevated: palette.paper[0],
    surface: palette.paper[0],
    surfaceSubtle: palette.paper[100],
    surfacePressed: palette.paper[150],
    surfaceInverse: palette.paper[800],
    overlay: 'rgba(26, 24, 22, 0.55)',

    border: palette.paper[200],
    borderStrong: palette.paper[300],
    borderFocus: palette.violet[400],

    text: palette.paper[900],
    textSecondary: palette.paper[600],
    textTertiary: palette.paper[500],
    textInverse: palette.paper[50],
    textOnAccent: palette.white,
    textDisabled: palette.paper[400],

    accent: palette.violet[500],
    accentPressed: palette.violet[600],
    accentSubtle: palette.violet[50],
    accentBorder: palette.violet[200],

    heart: palette.rose[500],
    heartSubtle: palette.rose[50],
    wave: palette.amber[500],
    waveSubtle: palette.amber[50],
    connection: palette.mint[500],
    connectionSubtle: palette.mint[50],
    danger: palette.red[500],
    dangerSubtle: palette.red[50],

    stage: palette.paper[100],
    stageTop: '#F7F2FF',
    stageBottom: '#FFF6EC',

    skeleton: palette.paper[150],
    skeletonHighlight: palette.paper[100],

    tabBar: 'rgba(255, 253, 248, 0.94)',
    tabBarBorder: palette.paper[200],
    tabIcon: palette.paper[500],
    tabIconActive: palette.paper[900],
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  isDark: true,
  statusBarStyle: 'light',
  colors: {
    background: palette.night[900],
    backgroundElevated: palette.night[800],
    surface: palette.night[700],
    surfaceSubtle: palette.night[600],
    surfacePressed: palette.night[500],
    surfaceInverse: palette.paper[100],
    overlay: 'rgba(5, 5, 9, 0.66)',

    border: palette.night[500],
    borderStrong: palette.night[400],
    borderFocus: palette.violet[400],

    text: palette.paper[50],
    textSecondary: palette.night[100],
    textTertiary: palette.night[200],
    textInverse: palette.paper[900],
    textOnAccent: palette.white,
    textDisabled: palette.night[300],

    accent: palette.violet[400],
    accentPressed: palette.violet[300],
    accentSubtle: 'rgba(124, 108, 240, 0.16)',
    accentBorder: palette.violet[700],

    heart: palette.rose[400],
    heartSubtle: 'rgba(240, 79, 121, 0.16)',
    wave: palette.amber[300],
    waveSubtle: 'rgba(249, 174, 43, 0.16)',
    connection: palette.mint[300],
    connectionSubtle: 'rgba(63, 192, 140, 0.16)',
    danger: palette.red[300],
    dangerSubtle: 'rgba(224, 59, 59, 0.18)',

    stage: palette.night[700],
    stageTop: '#1C1A2E',
    stageBottom: '#241F33',

    skeleton: palette.night[600],
    skeletonHighlight: palette.night[500],

    tabBar: 'rgba(10, 9, 18, 0.94)',
    tabBarBorder: palette.night[600],
    tabIcon: palette.night[200],
    tabIconActive: palette.paper[50],
  },
};

export const themes = { light: lightTheme, dark: darkTheme } as const;
