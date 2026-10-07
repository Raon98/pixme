import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigation } from 'expo-router';

import type { PixelPost } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { layout, spacing, useTheme } from '@/theme';
import {
  Badge,
  EmptyState,
  ErrorState,
  FeedCardSkeleton,
  Header,
  Icon,
  IconButton,
  Screen,
  Text,
} from '@/ui';
import { FeedCard } from '@/features/feed/FeedCard';
import { flattenFeed, useTodayFeed, useTodayStatus } from '@/features/feed/useTodayFeed';
import { useNotificationBadge } from '@/features/notifications/useNotifications';

/**
 * 오늘 — the home tab.
 *
 * One person per page, vertically paged (Reels-like rather than Tinder-like).
 * Moving on is a neutral scroll: there is no reject gesture, no card stack and
 * no "out of people" dead end — reaching the end simply says "내일 또 새로운
 * 오늘이 올라와요".
 */
export default function TodayRoute() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();

  const feed = useTodayFeed();
  const todayStatus = useTodayStatus();
  const badge = useNotificationBadge();

  const listRef = useRef<FlashListRef<PixelPost>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const posts = flattenFeed(feed.data);

  /**
   * Page height = viewport minus the tab bar and the top inset, so one card is
   * exactly one page and paging never lands between two cards.
   */
  const [viewportHeight, setViewportHeight] = useState(0);
  const pageHeight = Math.max(0, viewportHeight);

  /* Re-tapping the active tab returns to the top of the feed. */
  React.useEffect(() => {
    const unsubscribe = navigation.addListener(
      // @ts-expect-error — `tabPress` is emitted by the custom tab bar.
      'tabPress',
      () => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      },
    );
    return unsubscribe;
  }, [navigation]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
        const post = posts[first.index];
        if (post) {
          analytics.track('FEED_CARD_VIEWED', {
            postId: post.id,
            position: first.index,
          });
        }
      }
    },
    [posts],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: PixelPost; index: number }) => (
      <FeedCard
        post={item}
        height={pageHeight}
        active={index === activeIndex}
      />
    ),
    [activeIndex, pageHeight],
  );

  const unreadNotifications = badge.data?.unreadNotifications ?? 0;

  const header = (
    <Header
      large
      title={copy.today.title}
      subtitle={
        todayStatus.data?.myTodayPost
          ? '오늘의 PIXME를 이미 남겼어요.'
          : copy.today.myPixelMissingTitle
      }
      right={
        <IconButton
          label={copy.notifications.title}
          onPress={() => router.push('/notifications')}
        >
          <View>
            <Icon name="bell" size={22} color={colors.text} />
            {unreadNotifications > 0 ? (
              <View style={styles.bellBadge}>
                <Badge count={unreadNotifications} />
              </View>
            ) : null}
          </View>
        </IconButton>
      }
    />
  );

  /* ------------------------------------------------------------ states */

  if (feed.isPending) {
    return (
      <Screen edges={['top']} gutter={false}>
        <View style={styles.headerWrap}>{header}</View>
        <FeedCardSkeleton />
      </Screen>
    );
  }

  if (feed.isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState
          title={copy.errors.feedLoad}
          error={feed.error}
          onRetry={() => void feed.refetch()}
        />
      </Screen>
    );
  }

  if (posts.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          glyph="👾"
          title={copy.today.emptyTitle}
          body={copy.today.emptyBody}
          actionLabel={copy.today.emptyCta}
          onAction={() => router.push('/create')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} gutter={false}>
      <View style={styles.headerWrap}>{header}</View>

      <View
        style={styles.listWrap}
        onLayout={(event) =>
          setViewportHeight(event.nativeEvent.layout.height)
        }
      >
        {pageHeight > 0 ? (
          <FlashList
            ref={listRef}
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            pagingEnabled
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            onEndReachedThreshold={1.5}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage) {
                void feed.fetchNextPage();
              }
            }}
            refreshControl={
              <RefreshControl
                refreshing={feed.isRefetching && !feed.isFetchingNextPage}
                onRefresh={() => void feed.refetch()}
                tintColor={colors.accent}
              />
            }
            ListFooterComponent={
              feed.hasNextPage ? null : (
                <View style={[styles.end, { height: pageHeight * 0.5 }]}>
                  <Text variant="title3" align="center">
                    {copy.today.endTitle}
                  </Text>
                  <Text
                    variant="caption"
                    tone="secondary"
                    align="center"
                    style={styles.endBody}
                  >
                    {copy.today.endBody}
                  </Text>
                </View>
              )
            }
            contentContainerStyle={{ paddingBottom: insets.bottom }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: layout.gutter },
  listWrap: { flex: 1 },
  bellBadge: { position: 'absolute', top: -4, right: -6 },
  end: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  endBody: { marginTop: spacing.sm },
});
