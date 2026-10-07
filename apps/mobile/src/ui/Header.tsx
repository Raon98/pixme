import React from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { layout, spacing, useTheme } from '@/theme';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  /** Defaults to a back chevron when the stack can go back. */
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  /** Large left-aligned title used by the main tabs. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Header({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  large = false,
  style,
}: HeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleBack = onBack ?? (() => router.back());

  if (large) {
    return (
      <View style={[styles.large, style]}>
        <View style={styles.largeText}>
          {title ? <Text variant="title1">{title}</Text> : null}
          {subtitle ? (
            <Text variant="caption" tone="secondary" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <View style={styles.side}>
        {showBack ? (
          <IconButton label="뒤로" onPress={handleBack} size={36}>
            <Icon name="chevron-left" size={22} color={colors.text} />
          </IconButton>
        ) : null}
      </View>

      <View style={styles.center}>
        {title ? (
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="micro" tone="tertiary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: { minWidth: 48, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  largeText: { flex: 1 },
  subtitle: { marginTop: spacing.xxs },
});
