import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { logger } from './logger';

const log = logger('push');

/**
 * Foreground presentation. PIXME is intentionally quiet: we show banners but
 * never play a sound for hearts — only for direct messages and connections.
 *
 * <p>Skipped entirely on web: `expo-notifications` reaches into native-module
 * internals at registration time that `react-native-web` doesn't shim in this
 * Expo/React Native combination, which crashes the whole bundle at startup
 * with "importing a module from 'react-native' instead of 'react-native-web'"
 * — before a single component has rendered. Web has no push notifications to
 * handle anyway.
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const type = notification.request.content.data?.type as string | undefined;
      const loud = type === 'MESSAGE' || type === 'CONNECTED';
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: loud,
        shouldSetBadge: true,
      };
    },
  });
}

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Requests permission and returns an Expo push token.
 *
 * We deliberately do NOT ask on first launch. The prompt appears after the
 * user publishes their first PIXME, when "someone reacted to your PIXME" is a
 * concrete, wanted thing rather than an abstract ask.
 */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    log.debug('skipping push registration on simulator');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      lightColor: '#7C6CF0',
    });
    await Notifications.setNotificationChannelAsync('message', {
      name: '메시지',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 160, 80, 160],
      lightColor: '#7C6CF0',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch (error) {
    log.warn('failed to obtain push token', error);
    return null;
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* non-fatal */
  }
}

export async function dismissAll(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    /* non-fatal */
  }
}
