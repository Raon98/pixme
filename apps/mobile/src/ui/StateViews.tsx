import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { copy } from '@/constants/copy';
import { errorMessage, toApiError } from '@/api/errors';
import { spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Empty and error states are first-class screens in PIXME, not afterthoughts:
 * a new user's first five minutes are almost entirely empty states, so each
 * one names the situation and offers the single next action.
 */
export interface EmptyStateProps {
  title: string;
  body?: string;
  /** Large pixel glyph. */
  glyph?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function EmptyState({
  title,
  body,
  glyph,
  icon,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  style,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.root,
        compact ? styles.compact : styles.full,
        style,
      ]}
      accessibilityRole="summary"
    >
      {glyph ? (
        <Text style={styles.glyph}>{glyph}</Text>
      ) : icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSubtle }]}>
          <Icon name={icon} size={28} color={colors.textTertiary} />
        </View>
      ) : null}

      <Text variant="title3" align="center">
        {title}
      </Text>

      {body ? (
        <Text
          variant="caption"
          tone="secondary"
          align="center"
          style={styles.body}
        >
          {body}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="md"
          fullWidth={false}
          style={styles.action}
        />
      ) : null}

      {secondaryLabel && onSecondary ? (
        <Button
          label={secondaryLabel}
          onPress={onSecondary}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  error,
  title,
  onRetry,
  compact = false,
  style,
}: ErrorStateProps) {
  const apiError = error ? toApiError(error) : null;
  const message = error ? errorMessage(error) : copy.errors.generic;

  return (
    <EmptyState
      title={title ?? message}
      body={
        title && title !== message
          ? message
          : apiError?.traceId
            ? undefined
            : undefined
      }
      icon="alert"
      actionLabel={onRetry ? copy.errors.retry : undefined}
      onAction={onRetry}
      compact={compact}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl },
  compact: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  glyph: { fontSize: 44, marginBottom: spacing.base },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  body: { marginTop: spacing.sm, maxWidth: 280 },
  action: { marginTop: spacing.lg, minWidth: 160 },
});
