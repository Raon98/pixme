import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { SquareOccupant } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { layout, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Sheet,
  Skeleton,
  Text,
  useToast,
} from '@/ui';
import { CurationRail } from '@/features/square/CurationRail';
import { OccupantSheet } from '@/features/square/OccupantSheet';
import { SquareCanvas } from '@/features/square/SquareCanvas';
import { useSquare } from '@/features/square/useSquare';
import { NoCharacterGate } from '@/features/profile/NoCharacterGate';
import { useMe, useUpdateMe } from '@/features/profile/useProfile';

/**
 * Today's Square — a 2D space holding everyone who published today.
 *
 * It looks like Gather but is not a game: the user has no avatar to drive,
 * there is no realtime position sync, and the whole screen is a scroll view of
 * absolutely-positioned characters. That keeps it cheap on battery and lets
 * every character remain a normal, accessible, pressable element.
 */
export default function SquareRoute() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const square = useSquare();
  const me = useMe();
  const updateMe = useUpdateMe();

  /**
   * Nobody is placed in the square without saying yes first — `squareVisible`
   * defaults to false server-side. `squareOnboarded` records that the choice
   * was offered, so the sheet appears exactly once; declining still sets it
   * (by patching `squareVisible: false`), which is why `consentDecline` is a real
   * answer rather than a dismiss.
   */
  const squareVisible = me.data?.settings.squareVisible ?? false;
  const squareOnboarded = me.data?.settings.squareOnboarded ?? false;
  const askingConsent = !!me.data && !squareOnboarded;

  // Standing in the square follows from leaving a status, which is free.
  const hasCharacter = !!me.data?.representativeCharacterUrl;
  const emptyActionLabel = hasCharacter ? copy.today.statusCta : copy.today.emptyCta;
  const onEmptyAction = () => router.push(hasCharacter ? '/status-edit' : '/create');

  const setVisibility = useCallback(
    (next: boolean) => {
      updateMe.mutate(
        { settings: { squareVisible: next } },
        {
          onSuccess: () =>
            toast.show({
              message: next ? copy.square.nowVisible : copy.square.nowHidden,
              tone: next ? 'success' : 'neutral',
            }),
          onError: () => toast.show({ message: copy.errors.generic, tone: 'error' }),
        },
      );
    },
    [toast, updateMe],
  );
  const [selected, setSelected] = useState<
    Pick<
      SquareOccupant,
      'dailyStatusId' | 'userId' | 'nickname' | 'characterImageUrl' | 'mood'
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

  // Rendered in every branch, not just the populated one: square_visible is
  // off by default, so on a quiet day everybody takes an early return above —
  // and a square nobody is ever asked to join stays empty permanently.
  const consentSheet = (
    <Sheet
      visible={askingConsent}
      onClose={() => setVisibility(false)}
      title={copy.square.consentTitle}
    >
      <Text variant="body" tone="secondary" style={styles.consentBody}>
        {copy.square.consentBody}
      </Text>
      <Button
        label={copy.square.consentAccept}
        loading={updateMe.isPending}
        onPress={() => setVisibility(true)}
      />
      <Button
        label={copy.square.consentDecline}
        variant="ghost"
        onPress={() => setVisibility(false)}
        style={styles.consentDecline}
      />
    </Sheet>
  );

  // The square places *your* character among everyone else's; with none to
  // place, say so instead of showing an empty plaza the user cannot join.
  if (me.data && !me.data.representativeCharacterUrl) {
    return (
      <Screen edges={['top']}>
        {header}
        <NoCharacterGate />
      </Screen>
    );
  }

  if (square.isPending) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScrollView showsVerticalScrollIndicator={false}>
          <Skeleton height={76} style={styles.railSkeleton} />
          <Skeleton height={420} style={styles.canvasSkeleton} />
        </ScrollView>
        {consentSheet}
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
        {consentSheet}
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
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
        {consentSheet}
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} gutter={false}>
      <View style={styles.headerWrap}>{header}</View>

      {squareOnboarded && !squareVisible ? (
        <View
          style={[
            styles.hiddenBanner,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
          ]}
        >
          <Icon name="eye-off" size={16} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={styles.hiddenBannerText}>
            {copy.square.hiddenBanner}
          </Text>
          <Button
            label={copy.square.hiddenBannerCta}
            variant="secondary"
            size="sm"
            fullWidth={false}
            loading={updateMe.isPending}
            onPress={() => setVisibility(true)}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <SquareCanvas
          data={square.data}
          header={
            <View>
              {curations()}
              <Text variant="micro" tone="tertiary" style={styles.hint}>
                {copy.square.tapHint}
              </Text>
            </View>
          }
          onSelectOccupant={(occupant) => setSelected(occupant)}
          myUserId={me.data?.id ?? null}
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

      {consentSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: layout.gutter },
  body: { flex: 1, paddingHorizontal: layout.gutter },
  hint: { marginTop: spacing.base },
  hiddenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: layout.gutter,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hiddenBannerText: { flex: 1, marginLeft: spacing.sm },
  consentBody: { marginBottom: spacing.lg },
  consentDecline: { marginTop: spacing.xs },
  railSkeleton: { marginHorizontal: layout.gutter, marginTop: spacing.base },
  canvasSkeleton: { marginHorizontal: layout.gutter, marginTop: spacing.base },
});
