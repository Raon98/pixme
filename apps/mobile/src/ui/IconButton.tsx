import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { haptics } from '@/lib/haptics';
import { layout, opacity, radius, useTheme } from '@/theme';

export interface IconButtonProps
  extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  /** Visual diameter; the hit target is always ≥44pt via hitSlop. */
  size?: number;
  variant?: 'plain' | 'surface' | 'overlay';
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  children,
  size = 40,
  variant = 'plain',
  label,
  style,
  onPress,
  disabled,
  ...rest
}: IconButtonProps) {
  const { colors } = useTheme();
  const slop = Math.max(0, (layout.hitSlop - size) / 2);

  const backgroundColor =
    variant === 'surface'
      ? colors.surfaceSubtle
      : variant === 'overlay'
        ? colors.overlay
        : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={slop}
      disabled={disabled}
      onPress={(event) => {
        haptics.tap();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor,
          opacity: disabled
            ? opacity.disabled
            : pressed
              ? opacity.pressed
              : 1,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
