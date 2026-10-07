import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { haptics } from '@/lib/haptics';
import { opacity, radius, spacing, useTheme } from '@/theme';
import type { ThemeColors } from '@/theme/themes';

import { Text, type TextTone } from './Text';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'heart'
  | 'wave';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Rendered left of the label. */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Light impact on press; disable for destructive confirmations. */
  haptic?: boolean;
}

const SIZES: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; radius: number }
> = {
  sm: { height: 36, paddingHorizontal: spacing.base, radius: radius.sm },
  md: { height: 46, paddingHorizontal: spacing.lg, radius: radius.md },
  lg: { height: 54, paddingHorizontal: spacing.xl, radius: radius.base },
};

function palette(
  variant: ButtonVariant,
  colors: ThemeColors,
): { bg: string; border: string; tone: TextTone } {
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, border: colors.accent, tone: 'onAccent' };
    case 'secondary':
      return {
        bg: colors.surfaceSubtle,
        border: colors.surfaceSubtle,
        tone: 'default',
      };
    case 'outline':
      return { bg: 'transparent', border: colors.borderStrong, tone: 'default' };
    case 'ghost':
      return { bg: 'transparent', border: 'transparent', tone: 'secondary' };
    case 'danger':
      return { bg: colors.danger, border: colors.danger, tone: 'onAccent' };
    case 'heart':
      return { bg: colors.heart, border: colors.heart, tone: 'onAccent' };
    case 'wave':
      return { bg: colors.wave, border: colors.wave, tone: 'onAccent' };
  }
}

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = true,
  icon,
  style,
  disabled,
  haptic = true,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const sizing = SIZES[size];
  const { bg, border, tone } = useMemo(
    () => palette(variant, colors),
    [variant, colors],
  );

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={(event) => {
        if (haptic) haptics.tap();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: sizing.height,
          paddingHorizontal: sizing.paddingHorizontal,
          borderRadius: sizing.radius,
          backgroundColor: bg,
          borderColor: border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled
            ? opacity.disabled
            : pressed
              ? opacity.pressed
              : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={tone === 'onAccent' ? colors.textOnAccent : colors.text}
        />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text
            variant={size === 'sm' ? 'label' : 'bodyStrong'}
            tone={tone}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: spacing.sm },
});
