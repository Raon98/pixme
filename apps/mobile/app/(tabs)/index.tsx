import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';

import type { DailyStatusEntry } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { layout, spacing, useTheme } from '@/theme';
import {
  Badge,
  Button,
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
import { useMe } from '@/features/profile/useProfile';

/**
 * Today — the home tab.
 *
 * One person per page, vertically paged (Reels-like rather than Tinder-like).
 * Moving on is a neutral scroll: there is no reject gesture, no card stack and
 * no "out of people" dead end — reaching the end simply says
 * `today.endBody`.
 */
export default function TodayRoute() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();

  const feed = useTodayFeed();
  const todayStatus = useTodayStatus();
  const badge = useNotificationBadge();
  const me = useMe();

  /**
   * Appearing on Today costs nothing — leaving a status does it. Generating a
   * new character is the paid, optional path. So the free action is offered
   * first, and the paid one only when it is genuinely the only way forward:
   * a status has to point at a character, so someone with none must generate.
   */
  /**
   * `me` is only re-fetched on explicit triggers (login, a decoration apply,
   * keeping a character) — there is no polling. A reserved-signup account's
   * first character is seeded asynchronously, after the login response has
   * already gone out, so the very first `me` fetch can genuinely race it and
   * cache `representativeCharacterUrl: null` with nothing left to ever
   * correct it. This gates a real money decision (free status vs. paid
   * generation), so Today refreshes it on every focus rather than trusting
   * however old the cache happens to be.
   *
   * <p>`refetch` is read through a ref, not closed over directly: the query
   * object gets a new identity on every fetch, and `useFocusEffect` re-runs
   * its setup whenever the memoised callback's identity changes *while still
   * focused* — depending on `me` directly would refetch, which changes `me`,
   * which reruns the effect, forever.
   */
  const refetchMe = useRef(me.refetch);
  useEffect(() => {
    refetchMe.current = me.refetch;
  });
  useFocusEffect(
    useCallback(() => {
      void refetchMe.current();
    }, []),
  );

  const hasCharacter = !!me.data?.representativeCharacterUrl;
  const hasTodayStatus = !!todayStatus.data?.myTodayStatus;
  const canLeaveStatus = hasCharacter && !hasTodayStatus;
  const primaryActionLabel = canLeaveStatus
    ? copy.today.statusCta
    : copy.today.emptyCta;
  const onPrimaryAction = () =>
    router.push(canLeaveStatus ? '/status-edit' : '/create');

  /**
   * An empty *feed* can mean two very different things: nobody including this
   * viewer has posted today, or this viewer already has and the feed (which
   * only ever shows other people) is simply quiet. The second case used to
   * fall through to the exact same "첫 번째로 남겨볼까요?" + "PIXME 만들기"
   * treatment as the first — telling someone who already left today's status
   * to go first, and nudging them toward paying for another generation with
   * nothing left to actually do today.
   */
  const feedQuietAfterPosting = hasTodayStatus;

  const listRef = useRef<FlashListRef<DailyStatusEntry>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const statuses = flattenFeed(feed.data);

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
        const status = statuses[first.index];
        if (status) {
          analytics.track('FEED_CARD_VIEWED', {
            dailyStatusId: status.id,
            position: first.index,
          });
        }
      }
    },
    [statuses],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DailyStatusEntry; index: number }) => (
      <FeedCard
        status={item}
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
        hasTodayStatus
          ? copy.today.statusDoneTitle
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

  if (statuses.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          icon="today"
          title={
            feedQuietAfterPosting
              ? copy.today.emptyAfterPostedTitle
              : copy.today.emptyTitle
          }
          body={
            feedQuietAfterPosting
              ? copy.today.emptyAfterPostedBody
              : copy.today.emptyBody
          }
          actionLabel={
            feedQuietAfterPosting ? copy.today.browseSquare : primaryActionLabel
          }
          onAction={
            feedQuietAfterPosting
              ? () => router.push('/(tabs)/square')
              : onPrimaryAction
          }
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} gutter={false}>
      <View style={styles.headerWrap}>
        {header}
        {/*
          The feed being full is exactly when the empty state can't carry this
          prompt — and it is the free action, so it must not be buried.
        */}
        {canLeaveStatus ? (
          <Button
            label={copy.today.statusCta}
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => router.push('/status-edit')}
            style={styles.statusPrompt}
          />
        ) : null}
      </View>

      <View
        style={styles.listWrap}
        onLayout={(event) =>
          setViewportHeight(event.nativeEvent.layout.height)
        }
      >
        {pageHeight > 0 ? (
          <FlashList
            ref={listRef}
            data={statuses}
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
  statusPrompt: { marginBottom: spacing.sm, alignSelf: 'flex-start' },
  listWrap: { flex: 1 },
  bellBadge: { position: 'absolute', top: -4, right: -6 },
  end: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  endBody: { marginTop: spacing.sm },
});
