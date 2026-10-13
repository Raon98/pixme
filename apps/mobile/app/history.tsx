import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { DailyStatusSummary } from '@/api';
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
import { groupByMonth, useMyHistory } from '@/features/dailyStatus/useDailyStatusHistory';

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

  const history = useMyHistory();
  const sections = useMemo(() => groupByMonth(history.data), [history.data]);

  const header = (
    <Header
      title={copy.my.history}
      right={
        <IconButton
          label={
            mode === 'grid'
              ? copy.historyView.calendarView
              : copy.historyView.gridView
          }
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
          icon="calendar"
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
              onSelect={(status) => router.push(`/daily-status/${status.id}`)}
            />
          ) : (
            <MonthCalendar
              items={item}
              onSelect={(status) => router.push(`/daily-status/${status.id}`)}
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
  items: DailyStatusSummary[];
  onSelect: (status: DailyStatusSummary) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((status) => (
        <Pressable
          key={status.id}
          accessibilityRole="button"
          accessibilityLabel={copy.a11y.dayPixel(status.statusDate)}
          onPress={() => onSelect(status)}
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
            {status.mood ? ` ${moodEmoji(status.mood)}` : ''}
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
  items: DailyStatusSummary[];
  onSelect: (status: DailyStatusSummary) => void;
}) {
  const { colors } = useTheme();

  const first = items[0];
  if (!first) return null;

  const [yearText, monthText] = first.statusDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = new Date(year, month - 1, 1).getDay();

  const byDay = new Map<number, DailyStatusSummary>();
  for (const status of items) {
    byDay.set(Number(formatDayNumber(status.statusDate)), status);
  }

  const cells: (DailyStatusSummary | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => byDay.get(index + 1) ?? null,
    ),
  ];

  return (
    <View>
      <View style={styles.weekRow}>
        {copy.historyView.weekdays.map((label) => (
          <Text key={label} variant="micro" tone="tertiary" style={styles.weekLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.calendar}>
        {cells.map((status, index) => (
          <Pressable
            key={index}
            accessibilityRole={status ? 'button' : undefined}
            accessibilityLabel={
              status ? copy.a11y.dayPixel(status.statusDate) : undefined
            }
            disabled={!status}
            onPress={() => status && onSelect(status)}
            style={({ pressed }) => [
              styles.calendarCell,
              status
                ? {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  }
                : { borderColor: 'transparent' },
              pressed && status ? { opacity: opacity.pressed } : null,
            ]}
          >
            {status ? (
              <PixelCharacter uri={status.characterImageUrl} size={34} />
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
  // `gap` rather than a percentage marginRight: a percentage margin is
  // part of the margin box, so `31% + 3.5%` × 3 came to 103.5% and wrapped
  // to two columns with a dead gutter on the right.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: {
    width: '31%',
    aspectRatio: 0.84,
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
