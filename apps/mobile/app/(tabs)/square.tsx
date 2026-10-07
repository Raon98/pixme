import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { SquareOccupant } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { layout, spacing, useTheme } from '@/theme';
import {
  EmptyState,
  ErrorState,
  Header,
  Screen,
  Skeleton,
  Text,
} from '@/ui';
import { CurationRail } from '@/features/square/CurationRail';
import { OccupantSheet } from '@/features/square/OccupantSheet';
import { SquareCanvas } from '@/features/square/SquareCanvas';
import { useSquare } from '@/features/square/useSquare';

/**
 * 오늘의 광장 — a 2D space holding everyone who published today.
 *
 * It looks like Gather but is not a game: the user has no avatar to drive,
 * there is no realtime position sync, and the whole screen is a scroll view of
 * absolutely-positioned characters. That keeps it cheap on battery and lets
 * every character remain a normal, accessible, pressable element.
 */
export default function SquareRoute() {
  const { colors } = useTheme();
  const router = useRouter();
  const square = useSquare();
  const [selected, setSelected] = useState<
    Pick<
      SquareOccupant,
      'postId' | 'userId' | 'nickname' | 'characterImageUrl' | 'mood'
    > | null
  >(null);

  React.useEffect(() => {
    analytics.screen('square');
    analytics.track('SQUARE_OPENED');
  }, []);

  const header = (
    <Header
      large
      title={copy.square.title}
      subtitle={
        square.data ? square.data.scene.name : copy.square.subtitle
      }
    />
  );

  const curations = useCallback(() => {
    if (!square.data) return null;
    return (
      <View>
        {square.data.curations.map((curation) => (
          <CurationRail
            key={curation.code}
            curation={curation}
            onSelect={(entry) => setSelected(entry)}
          />
        ))}
      </View>
    );
  }, [square.data]);

  if (square.isPending) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScrollView showsVerticalScrollIndicator={false}>
          <Skeleton height={76} style={styles.railSkeleton} />
          <Skeleton height={420} style={styles.canvasSkeleton} />
        </ScrollView>
      </Screen>
    );
  }

  if (square.isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState
          title={copy.errors.feedLoad}
          error={square.error}
          onRetry={() => void square.refetch()}
        />
      </Screen>
    );
  }

  if (!square.data || square.data.occupants.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          glyph="🏙"
          title={copy.square.emptyTitle}
          body={copy.square.emptyBody}
          actionLabel={copy.today.emptyCta}
          onAction={() => router.push('/create')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} gutter={false}>
      <View style={styles.headerWrap}>{header}</View>

      <View style={styles.body}>
        <SquareCanvas
          data={square.data}
          header={
            <View>
              {curations()}
              <Text variant="micro" tone="tertiary" style={styles.hint}>
                캐릭터를 눌러 오늘의 한마디를 볼 수 있어요.
              </Text>
            </View>
          }
          onSelectOccupant={(occupant) => setSelected(occupant)}
          refreshControl={
            <RefreshControl
              refreshing={square.isRefetching}
              onRefresh={() => void square.refetch()}
              tintColor={colors.accent}
            />
          }
        />
      </View>

      <OccupantSheet occupant={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: layout.gutter },
  body: { flex: 1, paddingHorizontal: layout.gutter },
  hint: { marginTop: spacing.base },
  railSkeleton: { marginHorizontal: layout.gutter, marginTop: spacing.base },
  canvasSkeleton: { marginHorizontal: layout.gutter, marginTop: spacing.base },
});
