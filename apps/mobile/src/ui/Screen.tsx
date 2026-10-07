import React from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';

import { layout, spacing, useTheme } from '@/theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Which safe-area edges to pad. Feed/square screens pass `[]` to bleed. */
  edges?: readonly Edge[];
  /** Apply the standard horizontal page gutter. */
  gutter?: boolean;
  scroll?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'children'>;
  background?: 'default' | 'elevated' | 'stage';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned footer (primary CTA) that respects the bottom inset. */
  footer?: React.ReactNode;
}

/**
 * Every screen is wrapped in this so safe-area handling, status-bar style and
 * the page gutter are decided in exactly one place.
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  gutter = true,
  scroll = false,
  scrollProps,
  background = 'default',
  style,
  contentStyle,
  footer,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const backgroundColor =
    background === 'elevated'
      ? theme.colors.backgroundElevated
      : background === 'stage'
        ? theme.colors.stage
        : theme.colors.background;

  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') && !footer ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const inner: ViewStyle | undefined = gutter
    ? { paddingHorizontal: layout.gutter }
    : undefined;

  return (
    <View style={[styles.root, { backgroundColor }, padding, style]}>
      <StatusBar style={theme.statusBarStyle} />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[inner, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, contentStyle]}>{children}</View>
      )}

      {footer ? (
        <View
          style={[
            styles.footer,
            inner,
            {
              paddingBottom: Math.max(insets.bottom, spacing.base),
              backgroundColor,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === 'android' ? { elevation: 8 } : null),
  },
});
