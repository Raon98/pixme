import React from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { opacity, radius, shadow, spacing, useTheme } from '@/theme';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  padded?: boolean;
  elevation?: keyof typeof shadow;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  padded = true,
  elevation = 'xs',
  onPress,
  accessibilityLabel,
  style,
  ...rest
}: CardProps) {
  const { colors } = useTheme();

  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    padding: padded ? spacing.base : 0,
    ...shadow[elevation],
  };

  if (!onPress) {
    return (
      <View style={[base, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressed ? { opacity: opacity.pressed } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
