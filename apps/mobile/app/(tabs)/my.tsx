import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { interestLabel } from '@/constants/interests';
import { moodEmoji } from '@/constants/moods';
import { formatCount, formatPostDate } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Chip,
  Divider,
  EmptyState,
  Header,
  Icon,
  IconButton,
  PixelCharacter,
  ProfileSkeleton,
  Screen,
  Text,
} from '@/ui';
import { useMe } from '@/features/profile/useProfile';
import { useShareStatus } from '@/features/share/useShareStatus';
import { useMyHistory } from '@/features/dailyStatus/useDailyStatusHistory';
import { useTodayStatus } from '@/features/feed/useTodayFeed';
import { useCollection, useSetCurrentPixel } from '@/features/collection/useCollection';
import { CharacterSheet } from '@/features/collection/CharacterSheet';
import { DecoFrame } from '@/features/decorations/DecoFrame';
import { DecoratedBackground } from '@/features/decorations/DecoratedBackground';
import { NICKNAMES } from '@/features/decorations/catalog';
import { useDecorations } from '@/features/decorations/useDecorations';

/**
 * MY — a personal space, not a settings screen.
 *
 * The emotional job here is "내가 이런 옷도 입었구나": the representative
 * character and the recent record come first, counters are small, and settings
 * is a single quiet icon in the corner.
 */
export default function MyRoute() {
  const { colors } = useTheme();
  const router = useRouter();

  const me = useMe();
  const todayStatus = useTodayStatus();
  const history = useMyHistory();
  const collection = useCollection();
  const setCurrentPixel = useSetCurrentPixel();
  const [openedCharacterId, setOpenedCharacterId] = useState<string | null>(null);

  // Bound to the pull gesture only, not `me.isRefetching` — that flag also
  // flips on the background refetch below (and on any other screen's
  // invalidation of the same query), which showed the native pull spinner
  // animating in on its own, with no pull behind it, right after landing
  // here from the create flow.
  const [manualRefreshing, setManualRefreshing] = useState(false);

  /**
   * `representativeCharacterUrl` (and `myTodayStatus`) decide which CTA this
   * screen shows — "오늘 상태 남기기" vs "PIXME 만들기" — and a session left
   * open across several unrelated screens can be holding a `me` snapshot from
   * well before the character this account already has. Same fix as Today's,
   * for the same reason: refetch on arrival rather than trust however old the
   * cache is.
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

  /**
   * What the user actually bought, on the screen they bought it from. The
   * decorations used to render only on the Today feed card, so applying one
   * here changed nothing the owner could see — which read as the purchase
   * silently failing.
   */
  const decorations = useDecorations().data?.active ?? {};
  const nickname = decorations.NICKNAME ? NICKNAMES[decorations.NICKNAME] : undefined;
  const openedCharacter =
    collection.data?.find((item) => item.id === openedCharacterId) ?? null;

  const recent =
    history.data?.pages.flatMap((page) => page.items).slice(0, 8) ?? [];

  // Before the early returns below — hooks cannot be conditional. Today's
  // status is what makes a card worth sharing; without one it falls back to
  // the representative character on its own.
  const today = todayStatus.data?.myTodayStatus ?? null;
  const shareCard = useShareStatus({
    characterUrl:
      today?.characterImageUrl ?? me.data?.representativeCharacterUrl ?? null,
    mood: today?.mood ?? null,
    message: today?.message ?? null,
    dateLabel: today ? formatPostDate(today.statusDate) : '',
  });

  if (me.isPending && !me.data) {
    return (
      <Screen edges={['top']} scroll>
        <Header large title={copy.my.title} />
        <ProfileSkeleton />
      </Screen>
    );
  }

  const user = me.data;
  if (!user) {
    return (
      <Screen edges={['top']}>
        <Header large title={copy.my.title} />
        <EmptyState
          title={copy.errors.generic}
          actionLabel={copy.errors.retry}
          onAction={() => void me.refetch()}
        />
      </Screen>
    );
  }

  const myToday = todayStatus.data?.myTodayStatus ?? null;

  return (
    <Screen
      edges={['top']}
      scroll
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={manualRefreshing}
            onRefresh={async () => {
              setManualRefreshing(true);
              try {
                await Promise.all([
                  me.refetch(),
                  history.refetch(),
                  todayStatus.refetch(),
                ]);
              } finally {
                setManualRefreshing(false);
              }
            }}
            tintColor={colors.accent}
          />
        ),
      }}
      contentStyle={styles.content}
    >
      <Header
        large
        title={copy.my.title}
        right={
          <View style={styles.headerActions}>
            {user.representativeCharacterUrl ? (
              <IconButton
                label={copy.share.cta}
                onPress={() => void shareCard.share()}
              >
                <Icon name="share" size={22} color={colors.text} />
              </IconButton>
            ) : null}
            <IconButton
              label={copy.settings.title}
              onPress={() => router.push('/settings')}
            >
              <Icon name="settings" size={22} color={colors.text} />
            </IconButton>
          </View>
        }
      />

      {/* representative character */}
      <View style={styles.hero}>
        <View
          style={[
            styles.heroStage,
            { backgroundColor: colors.stage, borderColor: colors.border },
          ]}
        >
          <DecoratedBackground
            code={decorations.BACKGROUND}
            fallback={[colors.stageTop, colors.stageBottom]}
          />
          <DecoFrame code={decorations.FRAME} radius={radius.xl} />
          <PixelCharacter
            uri={
              myToday?.characterImageUrl ??
              user.representativeCharacterUrl
            }
            size={140}
            idle
            accessibilityLabel={copy.a11y.myCurrentPixel}
          />
        </View>

        <Text
          variant="title2"
          style={[
            styles.nickname,
            nickname
              ? {
                  textShadowColor: nickname.glow,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: nickname.radius,
                  ...(nickname.color ? { color: nickname.color } : null),
                }
              : null,
          ]}
        >
          {user.nickname}
        </Text>
        {user.bio ? (
          <Text variant="caption" tone="secondary" align="center" style={styles.bio}>
            {user.bio}
          </Text>
        ) : null}

        {myToday ? (
          <View style={styles.todayStatusRow}>
            {myToday.mood || myToday.message ? (
              <Text variant="caption" tone="secondary" align="center" style={styles.todayStatusText}>
                {myToday.mood ? `${moodEmoji(myToday.mood)} ` : ''}
                {myToday.message ?? ''}
              </Text>
            ) : null}
            <Button
              label={copy.today.statusCta}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/status-edit')}
              style={styles.todayCta}
            />
          </View>
        ) : user.representativeCharacterUrl ? (
          // Has a PIXME already — leaving today's status is free, so offer
          // that rather than pushing another paid generation.
          <Button
            label={copy.today.statusCta}
            size="md"
            fullWidth={false}
            onPress={() => router.push('/status-edit')}
            style={styles.todayCta}
          />
        ) : (
          <Button
            label={copy.today.myPixelMissingCta}
            size="md"
            fullWidth={false}
            onPress={() => router.push('/create')}
            style={styles.todayCta}
          />
        )}
      </View>

      {/* counters */}
      <View style={[styles.stats, { borderColor: colors.border }]}>
        <Stat
          label={copy.profile.receivedHearts}
          value={formatCount(user.stats.receivedHeartCount)}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <Stat
          label={copy.profile.connections}
          value={formatCount(user.stats.connectionCount)}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <Stat label="PIXME" value={formatCount(user.stats.pixelCount)} />
        {/*
          Only once there is a streak to show. A prominent "0일" would read as
          a scolding on day one, and the streak counts free daily activity, so
          it must never look like something to be bought back.
        */}
        {user.stats.streakDays > 0 ? (
          <>
            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />
            <Stat
              label={copy.profile.streak}
              value={copy.profile.streakDays(user.stats.streakDays)}
            />
          </>
        ) : null}
      </View>

      {/* credit balance — always visible, always one tap from buying more */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.a11y.buyCredits}
        onPress={() => router.push('/store')}
        style={({ pressed }) => [
          styles.creditCard,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.border,
            opacity: pressed ? opacity.pressed : 1,
          },
        ]}
      >
        <Icon name="sparkle" size={18} color={colors.accent} />
        <View style={styles.creditCardText}>
          <Text variant="bodyStrong">
            {copy.generation.balance(user.entitlements.creditBalance)}
          </Text>
          <Text variant="micro" tone="tertiary">
            {user.entitlements.firstGenerationAvailable
              ? copy.my.firstPixelFree
              : user.entitlements.firstRetryAvailable
                ? copy.my.firstRetryLeft
                : copy.my.tapForMore}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>

      {/* Decorations — owned items are useless without a way in to apply them */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.store.decorSection}
        onPress={() => router.push('/decorations')}
        style={({ pressed }) => [
          styles.creditCard,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.border,
            opacity: pressed ? opacity.pressed : 1,
          },
        ]}
      >
        <Icon name="crown" size={18} color={colors.accent} />
        <View style={styles.creditCardText}>
          <Text variant="bodyStrong">{copy.store.decorSection}</Text>
          <Text variant="micro" tone="tertiary">
            {user.entitlements.plusActive
              ? copy.my.decorPlus
              : copy.my.decorHint}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>

      {/* interests */}
      {user.interests.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label" tone="secondary">
            {copy.profile.interests}
          </Text>
          <View style={styles.chips}>
            {user.interests.map((code) => (
              <Chip
                key={code}
                label={interestLabel(code)}
                size="sm"
                selected
                tone="default"
                style={styles.chip}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* actions */}
      <View style={styles.actions}>
        <Button
          label={copy.my.editProfile}
          variant="secondary"
          size="md"
          onPress={() => router.push('/profile-edit')}
          style={styles.actionButton}
        />
        <Button
          label={user.entitlements.plusActive ? copy.plus.manage : copy.my.plus}
          variant={user.entitlements.plusActive ? 'outline' : 'primary'}
          size="md"
          onPress={() => router.push('/store/plus')}
          style={styles.actionButton}
          icon={
            <Icon
              name="crown"
              size={16}
              color={
                user.entitlements.plusActive
                  ? colors.text
                  : colors.textOnAccent
              }
            />
          }
        />
      </View>

      <Divider style={styles.divider} />

      {/* PIXME Collection */}
      <View style={styles.collectionHeader}>
        <Text variant="title3">PIXME Collection</Text>
        <Button
          label={copy.collection.createCta}
          variant="ghost"
          size="sm"
          onPress={() => router.push('/create')}
        />
      </View>

      {collection.data && collection.data.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.collectionRow}
        >
          {collection.data.map((character) => (
            <Pressable
              key={character.id}
              accessibilityRole="button"
              accessibilityLabel={
                character.isCurrent
                  ? copy.collection.current
                  : copy.a11y.collectionSwitch
              }
              accessibilityHint={copy.a11y.collectionHint}
              disabled={setCurrentPixel.isPending}
              onPress={() =>
                character.isCurrent
                  ? setOpenedCharacterId(character.id)
                  : setCurrentPixel.mutate(character.id)
              }
              onLongPress={() => setOpenedCharacterId(character.id)}
              style={({ pressed }) => [
                styles.collectionItem,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: character.isCurrent ? colors.accent : colors.border,
                  borderWidth: character.isCurrent ? 2 : StyleSheet.hairlineWidth,
                  opacity: pressed ? opacity.pressed : 1,
                },
              ]}
            >
              <PixelCharacter uri={character.characterImageUrl} size={72} />
              {character.isCurrent ? (
                <Text variant="micro" tone="accent" style={styles.collectionLabel}>
                  {copy.collection.currentShort}
                </Text>
              ) : (
                // Without this, a non-current card is a plain thumbnail with
                // no visible hint that tapping it switches Current PIXME —
                // the tap handler above already does that, but nothing on
                // screen said so.
                <Text variant="micro" tone="tertiary" style={styles.collectionLabel}>
                  {copy.collection.tapToSwitch}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Divider style={styles.divider} />

      {/*
        One entry point into /history, not two. This used to be headed
        "최근의 나" with a separate "내 픽셀 기록" button below the preview grid
        — same destination, two different names, which read as two unrelated
        features. Now the preview itself is titled like the page it opens.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.my.history}
        onPress={() => router.push('/history')}
        style={({ pressed }) => [
          styles.historyHeader,
          pressed ? { opacity: opacity.pressed } : null,
        ]}
      >
        <Text variant="title3">{copy.my.history}</Text>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>

      {recent.length === 0 ? (
        <EmptyState
          compact
          icon="calendar"
          title={copy.profile.emptyHistoryTitle}
          body={copy.profile.emptyHistoryBody}
          actionLabel={copy.today.emptyCta}
          onAction={() => router.push('/create')}
        />
      ) : (
        <View style={styles.grid}>
          {recent.map((status) => (
            <Pressable
              key={status.id}
              accessibilityRole="button"
              accessibilityLabel={copy.a11y.dayPixel(status.statusDate)}
              onPress={() => router.push(`/daily-status/${status.id}`)}
              style={({ pressed }) => [
                styles.gridItem,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  opacity: pressed ? opacity.pressed : 1,
                },
              ]}
            >
              <PixelCharacter uri={status.characterImageUrl} size={64} />
              <Text variant="micro" tone="tertiary">
                {status.statusDate.slice(5).replace('-', '.')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <CharacterSheet
        character={openedCharacter}
        onClose={() => setOpenedCharacterId(null)}
      />

      {shareCard.sheet}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title3">{value}</Text>
      <Text variant="micro" tone="tertiary" style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.giant },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  hero: { alignItems: 'center', paddingTop: spacing.base },
  heroStage: {
    width: 168,
    height: 168,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nicknameGlow: {
    textShadowColor: '#F9AE2B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  nickname: { marginTop: spacing.base },
  bio: { marginTop: spacing.xs, maxWidth: 280 },
  todayCta: { marginTop: spacing.base, minWidth: 180, alignSelf: 'center' },
  todayStatusRow: { alignItems: 'center' },
  todayStatusText: { marginTop: spacing.sm, maxWidth: 280 },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  collectionRow: { paddingTop: spacing.base, paddingRight: spacing.lg },
  collectionItem: {
    width: 96,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.md,
  },
  collectionLabel: { marginTop: spacing.xxs },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { marginTop: spacing.xxs },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  creditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  creditCardText: { flex: 1, marginLeft: spacing.sm },
  section: { marginTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  actions: { flexDirection: 'row', marginTop: spacing.xl },
  actionButton: { flex: 1, marginHorizontal: spacing.xs },
  divider: { marginTop: spacing.xl },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // 23% + 2.6% margin × 4 = 102.4%, which wrapped the 4-up grid to 3.
    gap: spacing.xs,
    marginTop: spacing.base,
  },
  gridItem: {
    width: '23%',
    aspectRatio: 0.82,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
