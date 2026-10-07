import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { MyPixelPost } from '@/api';
import { copy } from '@/constants/copy';
import { moodEmoji } from '@/constants/moods';
import { formatDayNumber } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  EmptyState,
  ErrorState,
  GridSkeleton,
  Header,
  Icon,
  IconButton,
  PixelCharacter,
  Screen,
  Text,
} from '@/ui';
import { groupByMonth, useMyPixels } from '@/features/history/useMyPixels';

type ViewMode = 'grid' | 'calendar';

/**
 * My pixel record.
 *
 * Grid is the default because the characters themselves are the content. The
 * calendar view exists for the other reading of the same data — "which days
 * did I actually show up?" — and both are driven by the same pages.
 */
export default function HistoryRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  const [mode, setMode] = useState<ViewMode>('grid');

  const history = useMyPixels();
  const sections = useMemo(() => groupByMonth(history.data), [history.data]);

  const header = (
    <Header
      title={copy.my.history}
      right={
        <IconButton
          label={mode === 'grid' ? '달력으로 보기' : '모아보기'}
          onPress={() => setMode(mode === 'grid' ? 'calendar' : 'grid')}
        >
          <Icon
            name={mode === 'grid' ? 'calendar' : 'grid'}
            size={20}
            color={colors.text}
          />
        </IconButton>
      }
    />
  );

  if (history.isPending) {
    return (
      <Screen edges={['top']}>
        {header}
        <GridSkeleton count={12} />
      </Screen>
    );
  }

  if (history.isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      </Screen>
    );
  }

  if (sections.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          glyph="👾"
          title={copy.profile.emptyHistoryTitle}
          body={copy.profile.emptyHistoryBody}
          actionLabel={copy.today.emptyCta}
          onAction={() => router.push('/create')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {header}

      <SectionList
        sections={sections.map((section) => ({
          ...section,
          // One row per month; the row renders the whole month's layout so the
          // grid/calendar switch doesn't need two separate list structures.
          data: [section.items],
        }))}
        keyExtractor={(_, index) => String(index)}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            onRefresh={() => void history.refetch()}
            tintColor={colors.accent}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) {
            void history.fetchNextPage();
          }
        }}
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="secondary" style={styles.monthTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) =>
          mode === 'grid' ? (
            <MonthGrid
              items={item}
              onSelect={(post) => router.push(`/pixel/${post.id}`)}
            />
          ) : (
            <MonthCalendar
              items={item}
              onSelect={(post) => router.push(`/pixel/${post.id}`)}
            />
          )
        }
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

function MonthGrid({
  items,
  onSelect,
}: {
  items: MyPixelPost[];
  onSelect: (post: MyPixelPost) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((post) => (
        <Pressable
          key={post.id}
          accessibilityRole="button"
          accessibilityLabel={`${post.postDate}의 PIXME`}
          onPress={() => onSelect(post)}
          style={({ pressed }) => [
            styles.gridItem,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              opacity: pressed ? opacity.pressed : 1,
            },
          ]}
        >
          <PixelCharacter uri={post.characterImageUrl} size={64} />
          <Text variant="micro" tone="tertiary">
            {post.postDate.slice(5).replace('-', '.')}
            {post.mood ? ` ${moodEmoji(post.mood)}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Calendar layout for a single month. Days without a PIXME are shown as empty
 * cells rather than hidden — the gaps are part of the record.
 */
function MonthCalendar({
  items,
  onSelect,
}: {
  items: MyPixelPost[];
  onSelect: (post: MyPixelPost) => void;
}) {
  const { colors } = useTheme();

  const first = items[0];
  if (!first) return null;

  const [yearText, monthText] = first.postDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = new Date(year, month - 1, 1).getDay();

  const byDay = new Map<number, MyPixelPost>();
  for (const post of items) {
    byDay.set(Number(formatDayNumber(post.postDate)), post);
  }

  const cells: (MyPixelPost | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => byDay.get(index + 1) ?? null,
    ),
  ];

  return (
    <View>
      <View style={styles.weekRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map((label) => (
          <Text key={label} variant="micro" tone="tertiary" style={styles.weekLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.calendar}>
        {cells.map((post, index) => (
          <Pressable
            key={index}
            accessibilityRole={post ? 'button' : undefined}
            accessibilityLabel={post ? `${post.postDate}의 PIXME` : undefined}
            disabled={!post}
            onPress={() => post && onSelect(post)}
            style={({ pressed }) => [
              styles.calendarCell,
              post
                ? {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  }
                : { borderColor: 'transparent' },
              pressed && post ? { opacity: opacity.pressed } : null,
            ]}
          >
            {post ? (
              <PixelCharacter uri={post.characterImageUrl} size={34} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  monthTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '31%',
    aspectRatio: 0.84,
    marginRight: '3.5%',
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekLabel: { flex: 1, textAlign: 'center' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
