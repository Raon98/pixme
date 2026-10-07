import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are a brand detail in PIXME: a heart should feel like a tiny tap,
 * a connection like a soft celebration. All calls are fire-and-forget and
 * silently no-op on web.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn: () => Promise<void>) {
  if (!enabled) return;
  void fn().catch(() => undefined);
}

export const haptics = {
  /** Generic button press. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heart sent. */
  heart: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Wave ("친해지고 싶어요") sent. */
  wave: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** Mutual connection established. */
  celebrate: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
  error: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
  selection: () => run(() => Haptics.selectionAsync()),
};
