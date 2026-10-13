import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { AppNotification } from '@/api';
import { copy } from '@/constants/copy';
import { isSafeDeepLink } from '@/lib/deepLink';
import { formatRelative } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Divider,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  ListSkeleton,
  PixelCharacter,
  Screen,
  Text,
  type IconName,
} from '@/ui';
import {
  useMarkAllNotificationsRead,
  useNotificationList,
} from '@/features/notifications/useNotifications';
import { notificationsApi } from '@/api';

const TYPE_ICON: Record<AppNotification['type'], IconName> = {
  HEART: 'heart-filled',
  CONNECTION_REQUEST: 'wave',
  CONNECTED: 'sparkle',
  MESSAGE: 'chat',
  REACTION_SPIKE: 'flame',
  DAILY_REMINDER: 'today',
  GENERATION_COMPLETED: 'sparkle',
  SYSTEM: 'info',
};

/**
 * Notification centre.
 *
 * Also the one place where the daily reminder lives as a readable item rather
 * than only a push, so turning notifications off doesn't hide the app's own
 * nudge entirely.
 */
export default function NotificationsRoute() {
  const router = useRouter();
  const { colors } = useTheme();

  const list = useNotificationList();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  );

  const hasUnread = items.some((item) => item.readAt === null);

  const header = (
    <Header
      title={copy.notifications.title}
      right={
        hasUnread ? (
          <Text
            variant="label"
            tone="accent"
            onPress={() => markAllRead.mutate()}
            style={styles.markAll}
          >
            {copy.notifications.markAllRead}
          </Text>
        ) : null
      }
    />
  );

  if (list.isPending) {
    return (
      <Screen edges={['top']}>
        {header}
        <ListSkeleton />
      </Screen>
    );
  }

  if (list.isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          icon="bell"
          title={copy.notifications.emptyTitle}
          body={copy.notifications.emptyBody}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {header}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <Divider inset />}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => void list.refetch()}
            tintColor={colors.accent}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) {
            void list.fetchNextPage();
          }
        }}
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            onPress={() => {
              if (item.readAt === null) {
                void notificationsApi.markRead(item.id);
              }
              if (isSafeDeepLink(item.deepLink)) router.push(item.deepLink as never);
            }}
          />
        )}
      />
    </Screen>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const unread = notification.readAt === null;

  const tint =
    notification.type === 'HEART'
      ? colors.heart
      : notification.type === 'CONNECTION_REQUEST'
        ? colors.wave
        : notification.type === 'CONNECTED'
          ? colors.connection
          : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={notification.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread ? { backgroundColor: colors.accentSubtle } : null,
        pressed ? { opacity: opacity.pressed } : null,
      ]}
    >
      <View
        style={[
          styles.thumb,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
        ]}
      >
        {notification.imageUrl ? (
          <PixelCharacter uri={notification.imageUrl} size={38} />
        ) : (
          <Icon name={TYPE_ICON[notification.type]} size={20} color={tint} />
        )}
      </View>

      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {notification.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {notification.body}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text variant="micro" tone="tertiary">
          {formatRelative(notification.createdAt)}
        </Text>
        {unread ? (
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  markAll: { paddingHorizontal: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginHorizontal: spacing.md },
  meta: { alignItems: 'flex-end' },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: spacing.sm },
});
