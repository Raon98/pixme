import React from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { opacity, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Right-aligned value text, e.g. the app version. */
  value?: string;
  icon?: IconName;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The settings / list building block. */
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  left,
  right,
  onPress,
  showChevron,
  destructive = false,
  style,
}: ListRowProps) {
  const { colors } = useTheme();
  const chevron = showChevron ?? !!onPress;

  const body = (
    <View style={[styles.root, style]}>
      {left ??
        (icon ? (
          <View style={styles.icon}>
            <Icon
              name={icon}
              size={20}
              color={destructive ? colors.danger : colors.textSecondary}
            />
          </View>
        ) : null)}

      <View style={styles.text}>
        <Text variant="body" tone={destructive ? 'danger' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="micro" tone="tertiary" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text variant="caption" tone="tertiary" style={styles.value}>
          {value}
        </Text>
      ) : null}

      {right}

      {chevron ? (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : null)}
    >
      {body}
    </Pressable>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="label" tone="tertiary" style={styles.sectionHeader}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  icon: { width: 30 },
  text: { flex: 1 },
  subtitle: { marginTop: spacing.xxs },
  value: { marginRight: spacing.sm },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
});
