import React from 'react';
import {
  Modal,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { radius, spacing, useTheme, zIndex } from '@/theme';

import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Hides the X. Use for sheets that must be answered. */
  dismissible?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Bottom sheet. Built on `Modal` rather than a gesture-driven sheet library:
 * every sheet in PIXME is short and action-oriented, so a simple
 * tap-scrim-to-dismiss surface is more predictable (and far lighter) than a
 * draggable one.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  dismissible = true,
  contentStyle,
}: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
    >
      <View style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[styles.scrim, { backgroundColor: colors.overlay }]}
        >
          <Pressable
            style={styles.scrimPress}
            accessibilityRole="button"
            accessibilityLabel={copy.common.close}
            onPress={dismissible ? onClose : undefined}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.backgroundElevated,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
            contentStyle,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />

          {title ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="title3">{title}</Text>
                {subtitle ? (
                  <Text variant="caption" tone="secondary" style={styles.subtitle}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {dismissible ? (
                <IconButton label={copy.common.close} onPress={onClose} size={32}>
                  <Icon name="close" size={20} color={colors.textSecondary} />
                </IconButton>
              ) : null}
            </View>
          ) : null}

          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', zIndex: zIndex.sheet },
  scrim: { ...StyleSheet.absoluteFill },
  scrimPress: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: { flex: 1, paddingRight: spacing.sm },
  subtitle: { marginTop: spacing.xs },
  body: { marginTop: spacing.base },
});
