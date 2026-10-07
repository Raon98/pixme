import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { interestLabel } from '@/constants/interests';
import { formatCount } from '@/lib/format';
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
import { useMyHistory } from '@/features/dailyStatus/useDailyStatusHistory';
import { useTodayStatus } from '@/features/feed/useTodayFeed';
import { useCollection, useSetCurrentPixel } from '@/features/collection/useCollection';

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

  const recent =
    history.data?.pages.flatMap((page) => page.items).slice(0, 8) ?? [];

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
            refreshing={me.isRefetching}
            onRefresh={() => {
              void me.refetch();
              void history.refetch();
              void todayStatus.refetch();
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
          <IconButton
            label={copy.settings.title}
            onPress={() => router.push('/settings')}
          >
            <Icon name="settings" size={22} color={colors.text} />
          </IconButton>
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
          <PixelCharacter
            uri={
              myToday?.characterImageUrl ??
              user.representativeCharacterUrl
            }
            size={140}
            idle
            accessibilityLabel="내 Current PIXME"
          />
        </View>

        <Text variant="title2" style={styles.nickname}>
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
                {myToday.mood ? `${myToday.mood} ` : ''}
                {myToday.message ?? ''}
              </Text>
            ) : null}
            <Button
              label="오늘 상태 바꾸기"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/status-edit')}
              style={styles.todayCta}
            />
          </View>
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
      </View>

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
          label="새 PIXME 만들기"
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
              accessibilityLabel={character.isCurrent ? '현재 사용 중인 PIXME' : '이 PIXME로 바꾸기'}
              disabled={character.isCurrent || setCurrentPixel.isPending}
              onPress={() => setCurrentPixel.mutate(character.id)}
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
                  현재
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Divider style={styles.divider} />

      {/* recent history */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.my.history}
        onPress={() => router.push('/history')}
        style={({ pressed }) => [
          styles.historyHeader,
          pressed ? { opacity: opacity.pressed } : null,
        ]}
      >
        <Text variant="title3">{copy.profile.recent}</Text>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>

      {recent.length === 0 ? (
        <EmptyState
          compact
          glyph="👾"
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
              accessibilityLabel={`${status.statusDate}의 PIXME`}
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

      <Button
        label={copy.my.history}
        variant="ghost"
        size="sm"
        onPress={() => router.push('/history')}
        style={styles.historyButton}
      />
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
  hero: { alignItems: 'center', paddingTop: spacing.base },
  heroStage: {
    width: 168,
    height: 168,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nickname: { marginTop: spacing.base },
  bio: { marginTop: spacing.xs, maxWidth: 280 },
  todayCta: { marginTop: spacing.base, minWidth: 180 },
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
    marginTop: spacing.base,
  },
  gridItem: {
    width: '23%',
    aspectRatio: 0.82,
    marginRight: '2.6%',
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButton: { marginTop: spacing.sm },
});
