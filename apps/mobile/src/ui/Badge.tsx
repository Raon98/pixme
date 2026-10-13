import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { copy } from '@/constants/copy';
import { formatBadge } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

export interface BadgeProps {
  count?: number;
  /** Renders a 8pt dot instead of a number. */
  dot?: boolean;
  tone?: 'accent' | 'heart' | 'connection';
  style?: StyleProp<ViewStyle>;
}

export function Badge({ count, dot = false, tone = 'accent', style }: BadgeProps) {
  const { colors } = useTheme();
  if (!dot && (!count || count <= 0)) return null;

  const backgroundColor =
    tone === 'heart'
      ? colors.heart
      : tone === 'connection'
        ? colors.connection
        : colors.accent;

  if (dot) {
    return (
      <View
        style={[styles.dot, { backgroundColor }, style]}
        accessibilityLabel={copy.a11y.newActivity}
      />
    );
  }

  return (
    <View
      style={[styles.badge, { backgroundColor }, style]}
      accessibilityLabel={copy.a11y.badgeCount(count ?? 0)}
    >
      <Text variant="micro" tone="onAccent" weight="bold">
        {formatBadge(count ?? 0)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
