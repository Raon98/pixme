import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  notificationsApi,
  qk,
  usersApi,
  type AppNotification,
  type Page,
} from '@/api';
import { logger } from '@/lib/logger';
import { MOCK_MODE } from '@/lib/mock';
import { registerForPush, setBadgeCount } from '@/lib/push';
import { config } from '@/lib/config';
import { storage, StorageKey } from '@/lib/storage';
import { Platform } from 'react-native';

import { useAuthStore } from '../auth/authStore';

const log = logger('notifications');

export function useNotificationList() {
  return useInfiniteQuery<Page<AppNotification>, Error>({
    queryKey: qk.notifications.list(),
    queryFn: ({ pageParam }) =>
      notificationsApi.list(pageParam as string | null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}

export function useNotificationBadge() {
  const signedIn = useAuthStore((state) => state.sessionState === 'signed-in');

  return useQuery({
    queryKey: qk.notifications.badge(),
    queryFn: () => notificationsApi.badge(),
    enabled: signedIn,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.notifications.list() }),
        queryClient.invalidateQueries({ queryKey: qk.notifications.badge() }),
      ]);
    },
  });
}

/**
 * Registers the device push token and routes notification taps.
 *
 * We do not ask for permission at launch. `promptNow` is called after the user
 * publishes their first PIXME, when "someone reacted to your PIXME" is a
 * concrete thing they want rather than an abstract ask.
 */
export function usePushRegistration() {
  const sessionState = useAuthStore((state) => state.sessionState);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // No native push module reliably available in a browser preview, and
    // nothing server-side to register a token with anyway.
    if (MOCK_MODE || sessionState !== 'signed-in') return;

    void (async () => {
      const alreadySynced = await storage.getItem<string>(
        StorageKey.PushTokenSynced,
      );
      if (!alreadySynced) return; // wait for `promptNow`

      const token = await registerForPush();
      if (!token || token === alreadySynced) return;
      try {
        await usersApi.registerPushToken({
          token,
          platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          appVersion: config.appVersion,
        });
        await storage.setItem(StorageKey.PushTokenSynced, token);
      } catch (error) {
        log.warn('push token sync failed', error);
      }
    })();
  }, [sessionState]);

  /* Tap handling → deep link. Web has no system notification tray. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const deepLink = response.notification.request.content.data
          ?.deepLink as string | undefined;
        void queryClient.invalidateQueries({
          queryKey: qk.notifications.badge(),
        });
        if (deepLink) router.push(deepLink as never);
      },
    );
    return () => subscription.remove();
  }, [queryClient, router]);

  /* Foreground receipt → refresh the badge so tabs stay in sync. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({
        queryKey: qk.notifications.badge(),
      });
    });
    return () => subscription.remove();
  }, [queryClient]);

  const promptNow = async () => {
    if (MOCK_MODE) return false;
    const token = await registerForPush();
    if (!token) return false;
    try {
      await usersApi.registerPushToken({
        token,
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        appVersion: config.appVersion,
      });
      await storage.setItem(StorageKey.PushTokenSynced, token);
      return true;
    } catch (error) {
      log.warn('push registration failed', error);
      return false;
    }
  };

  return { promptNow };
}

/** Mirrors the unread count onto the app icon. */
export function useAppIconBadge() {
  const badge = useNotificationBadge();
  useEffect(() => {
    const total =
      (badge.data?.unreadMessages ?? 0) +
      (badge.data?.unreadNotifications ?? 0);
    void setBadgeCount(total);
  }, [badge.data]);
}
