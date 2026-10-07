import { useMemo } from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import {
  fontSize,
  fontWeight,
  letterSpacing as ls,
  lineHeight,
  useTheme,
} from '@/theme';
import type { ThemeColors } from '@/theme/themes';

/**
 * The only text primitive in the app. Variants encode the type scale so no
 * screen sets a raw fontSize.
 */
export type TextVariant =
  | 'display' // splash wordmark
  | 'title1' // screen title
  | 'title2' // section title
  | 'title3' // card title
  | 'body' // default reading size
  | 'bodyStrong'
  | 'callout' // feed caption
  | 'label' // buttons, chips
  | 'caption' // metadata
  | 'micro' // timestamps, counters
  | 'pixel'; // brand/pixel face

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'accent'
  | 'danger'
  | 'heart'
  | 'wave'
  | 'connection'
  | 'onAccent';

const VARIANTS: Record<TextVariant, TextStyle> = {
  display: {
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.bold,
    letterSpacing: ls.wider,
  },
  title1: {
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: ls.tight,
  },
  title2: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: ls.tight,
  },
  title3: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
  },
  body: { fontSize: fontSize.base, lineHeight: lineHeight.base },
  bodyStrong: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
  },
  callout: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: fontWeight.medium,
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  },
  caption: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  micro: { fontSize: fontSize.xs, lineHeight: lineHeight.xs },
  pixel: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: ls.wide,
  },
};

function toneColor(tone: TextTone, colors: ThemeColors): string {
  switch (tone) {
    case 'secondary':
      return colors.textSecondary;
    case 'tertiary':
      return colors.textTertiary;
    case 'inverse':
      return colors.textInverse;
    case 'accent':
      return colors.accent;
    case 'danger':
      return colors.danger;
    case 'heart':
      return colors.heart;
    case 'wave':
      return colors.wave;
    case 'connection':
      return colors.connection;
    case 'onAccent':
      return colors.textOnAccent;
    default:
      return colors.text;
  }
}

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  weight?: keyof typeof fontWeight;
  /** Caps dynamic-type growth so feed cards never break their layout. */
  maxScale?: number;
}

export function Text({
  variant = 'body',
  tone = 'default',
  align,
  weight,
  maxScale = 1.3,
  style,
  children,
  ...rest
}: TextProps) {
  const { colors } = useTheme();

  const composed = useMemo(
    () =>
      StyleSheet.flatten([
        VARIANTS[variant],
        { color: toneColor(tone, colors) },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: fontWeight[weight] } : null,
        style,
      ]),
    [variant, tone, colors, align, weight, style],
  );

  return (
    <RNText maxFontSizeMultiplier={maxScale} style={composed} {...rest}>
      {children}
    </RNText>
  );
}
