import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { radius, spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app confirmation instead of `Alert.alert`, so destructive moments
 * (block, delete account, replace today's PIXME) carry our own typography and
 * copy rather than the OS default.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel = copy.common.confirm,
  cancelLabel = copy.common.cancel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={loading ? undefined : onCancel}
        />
        <Animated.View
          entering={ZoomIn.duration(200)}
          style={[styles.card, { backgroundColor: colors.backgroundElevated }]}
        >
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

          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              haptic={!destructive}
              onPress={onConfirm}
            />
            <Button
              label={cancelLabel}
              variant="ghost"
              disabled={loading}
              onPress={onCancel}
              style={styles.cancel}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  body: { marginTop: spacing.md },
  actions: { marginTop: spacing.xl },
  cancel: { marginTop: spacing.xs },
});
