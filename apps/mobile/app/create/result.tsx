import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { pixelsApi, type PixelGeneration } from '@/api';
import { copy } from '@/constants/copy';
import { haptics } from '@/lib/haptics';
import { layout, opacity, radius, spacing, useTheme } from '@/theme';
import { Button, Header, PixelCharacter, Screen, Text } from '@/ui';
import { useGenerationStore } from '@/features/generation/generationStore';
import { useTodayStatus } from '@/features/feed/useTodayFeed';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * Generation result.
 *
 * <p>Two shapes, depending on where the user is:
 *
 * - **First character.** The retry is free and offered explicitly, because the
 *   thing we most want to prevent is someone leaving because the very first AI
 *   result disappointed them. Once they've used it, both candidates are shown
 *   side by side and they pick — comparing is much easier than remembering.
 * - **Any later character.** No retry offered at all. A paid re-roll used to
 *   be offered here, spending a second credit on a result already paid for
 *   once — removed; keeping this one is the only path.
 */
export default function ResultRoute() {
  const router = useRouter();
  const { colors } = useTheme();

  const draft = useGenerationStore((state) => state.draft);
  const setGeneration = useGenerationStore((state) => state.setGeneration);
  const entitlements = useAuthStore((state) => state.user?.entitlements ?? null);
  const todayStatus = useTodayStatus();

  /**
   * Opened from the "완성됐어요" push, the in-memory draft is gone (the app was
   * closed while generating), so the generation is re-fetched by the id the
   * notification carries. Without this the screen reported a successful
   * generation as a failure and offered to pay for another one.
   */
  const { generationId } = useLocalSearchParams<{ generationId?: string }>();

  /**
   * The draft's generation only counts once it actually carries an image.
   * While the poll loop is running it holds the last *in-progress* snapshot,
   * whose `characterImageUrl` is still null — and the push fires the instant
   * the server finishes, up to a full poll interval before the app catches
   * up. Keying the fetch on "is there a generation" rather than "is there a
   * finished one" meant tapping that push landed on the stale snapshot,
   * skipped the fetch, and reported a succeeded generation as a failure.
   */
  const draftGeneration = draft?.generation ?? null;
  const usableDraft = draftGeneration?.characterImageUrl ? draftGeneration : null;
  const needsFetch = !usableDraft && !!generationId;
  const fetched = useQuery({
    queryKey: ['pixels', 'generation', generationId],
    queryFn: () => pixelsApi.generation(generationId!),
    enabled: needsFetch,
    retry: 2,
  });

  const generation = usableDraft ?? fetched.data ?? draftGeneration ?? null;

  /**
   * The original and its retries. Only meaningful in the first-character flow,
   * but asking always keeps this screen free of flow-specific branching.
   */
  const candidates = useQuery({
    queryKey: ['pixels', 'candidates', generation?.id ?? 'none'],
    queryFn: () => pixelsApi.candidates(generation!.id),
    enabled: !!generation && generation.status === 'COMPLETED',
    staleTime: 30_000,
  });

  const completed = useMemo(
    () =>
      (candidates.data ?? []).filter(
        (candidate) => candidate.characterImageUrl !== null,
      ),
    [candidates.data],
  );

  const comparing = completed.length > 1;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (!comparing) return generation;
    return (
      completed.find((candidate) => candidate.id === selectedId) ??
      // Default to the newest, which is what the user just watched appear.
      completed[completed.length - 1] ??
      generation
    );
  }, [comparing, completed, generation, selectedId]);

  const characterSize = useMemo(
    () =>
      Math.min(
        Dimensions.get('window').width - layout.gutter * 2 - spacing.xxl,
        300,
      ),
    [],
  );

  /**
   * The free retry belongs to the first PIXME, and only to it.
   *
   * <p>Reading it off the account-level flag alone was wrong twice over. The
   * master account's allowance reports both free slots as permanently
   * available, so every result there announced itself as "첫 PIXME가
   * 완성됐어요" and offered another free go, forever. And any account whose
   * flag happened to still be unconsumed got that same offer on a render it
   * had actually paid for. What this generation *cost* is recorded on the
   * generation itself — that is the honest signal, and it cannot go stale.
   */
  const isFirstGeneration = generation?.spendKind === 'FREE_FIRST';
  const freeRetryAvailable =
    isFirstGeneration &&
    (entitlements?.firstRetryAvailable ??
      todayStatus.data?.firstRetryAvailable ??
      false);

  /**
   * The only retry left is the free one on the first PIXME. A paid re-roll
   * used to be offered on every later result — spending a second credit on a
   * generation already paid for once, just to see a different render of the
   * same photo. Keeping it is now the only path once that free retry is
   * gone, so there is nothing left to gate behind a confirm dialog.
   */
  const onRetry = useCallback(() => {
    router.replace({ pathname: '/create/generating', params: { retry: '1' } });
  }, [router]);

  const onAccept = useCallback(() => {
    if (selected && selected.id !== generation?.id) {
      // Publish whichever candidate the user chose, not whichever was last.
      setGeneration(selected);
    }
    // The id goes along so publish survives the same missing/stale draft this
    // screen just had to work around — opened from the push there is no draft
    // for `setGeneration` to write into at all.
    const publishId = selected?.id ?? generation?.id;
    router.replace(
      publishId
        ? { pathname: '/create/publish', params: { generationId: publishId } }
        : '/create/publish',
    );
  }, [generation?.id, router, selected, setGeneration]);

  // Still loading the generation named by a notification — not a failure.
  if (needsFetch && fetched.isPending) {
    return (
      <Screen>
        <Header
          title={copy.generation.resultTitle}
          onBack={() => router.replace('/(tabs)')}
        />
        <View style={styles.center}>
          <Text variant="body" tone="secondary" align="center">
            {copy.common.loading}
          </Text>
        </View>
      </Screen>
    );
  }

  if (!generation || !generation.characterImageUrl) {
    return (
      <Screen>
        <Header
          title={copy.generation.resultTitle}
          onBack={() => router.replace('/(tabs)')}
        />
        <View style={styles.center}>
          <Text variant="body" tone="secondary" align="center">
            {copy.generation.failedTitle}
          </Text>
          {/*
            With a generation id in hand this is almost always a failed
            lookup, not a failed generation — so retry the lookup. Sending
            someone back to /create here offered to spend a second credit on
            a render the server had already produced.
          */}
          <Button
            label={copy.errors.retry}
            fullWidth={false}
            style={styles.retry}
            onPress={() => {
              if (generationId) {
                void fetched.refetch();
                return;
              }
              router.replace('/create');
            }}
          />
        </View>
      </Screen>
    );
  }

  const isFirstCharacter = freeRetryAvailable || comparing;

  // Opened from the push notification after the user already accepted this
  // exact result in-app (the draft is gone, so we can't tell any other way):
  // today's published character is already this generation's image.
  const alreadyAccepted =
    !!generation.characterImageUrl &&
    !!todayStatus.data?.myTodayStatus &&
    todayStatus.data.myTodayStatus.characterImageUrl ===
      generation.characterImageUrl;

  if (alreadyAccepted) {
    return (
      <Screen
        footer={
          <Button
            label={copy.common.confirm}
            onPress={() => router.replace('/(tabs)')}
          />
        }
      >
        <Header
          title={copy.generation.resultTitle}
          onBack={() => router.replace('/(tabs)')}
        />
        <View style={styles.body}>
          <View
            style={[
              styles.stage,
              { backgroundColor: colors.stage, borderColor: colors.border },
            ]}
          >
            <PixelCharacter
              uri={generation.characterImageUrl}
              size={characterSize}
              idle
              priority="high"
              accessibilityLabel={copy.a11y.freshPixel}
            />
          </View>
          <Text variant="title2" align="center" style={styles.title}>
            {copy.generation.alreadyAcceptedTitle}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        footer={
          <View>
            <Button label={copy.generation.accept} onPress={onAccept} />
            {/*
              Only ever shown for the genuine first PIXME — see
              `freeRetryAvailable`. Every later result goes straight to
              keeping it; there is no paid re-roll to offer instead.
            */}
            {freeRetryAvailable ? (
              <>
                <Button
                  label={copy.generation.freeRetry}
                  variant="ghost"
                  onPress={onRetry}
                  style={styles.ghost}
                />
                <Text
                  variant="micro"
                  tone="tertiary"
                  align="center"
                  style={styles.cost}
                >
                  {copy.generation.freeRetryHint}
                </Text>
              </>
            ) : null}
          </View>
        }
      >
        <Header
          title={copy.generation.resultTitle}
          onBack={() => router.replace('/(tabs)')}
        />

        {comparing ? (
          <View style={styles.body}>
            <Text variant="title2" align="center" style={styles.compareTitle}>
              {copy.generation.compareTitle}
            </Text>
            <Text
              variant="caption"
              tone="secondary"
              align="center"
              style={styles.compareHint}
            >
              {copy.generation.compareHint}
            </Text>

            <View style={styles.compareRow}>
              {completed.map((candidate, index) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  label={
                    index === 0
                      ? copy.generation.compareFirst
                      : copy.generation.compareSecond
                  }
                  selected={selected?.id === candidate.id}
                  onPress={() => {
                    haptics.selection();
                    setSelectedId(candidate.id);
                  }}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.body}>
            <View
              style={[
                styles.stage,
                { backgroundColor: colors.stage, borderColor: colors.border },
              ]}
            >
              <PixelCharacter
                uri={generation.characterImageUrl}
                size={characterSize}
                idle
                priority="high"
                accessibilityLabel={copy.a11y.freshPixel}
              />
            </View>

            <Text variant="title2" align="center" style={styles.title}>
              {isFirstCharacter
                ? copy.generation.firstResultTitle
                : copy.generation.readyTitle}
            </Text>

            {todayStatus.data?.myTodayStatus ? (
              <Text
                variant="caption"
                tone="secondary"
                align="center"
                style={styles.replaceNotice}
              >
                {copy.publish.collectionNotice}
              </Text>
            ) : null}
          </View>
        )}
      </Screen>
    </>
  );
}

function CandidateCard({
  candidate,
  label,
  selected,
  onPress,
}: {
  candidate: PixelGeneration;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.candidate,
        {
          backgroundColor: colors.stage,
          borderColor: selected ? colors.accent : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? opacity.pressed : 1,
        },
      ]}
    >
      <PixelCharacter
        uri={candidate.characterImageUrl}
        size={128}
        idle={selected}
        accessibilityLabel={label}
      />
      <Text
        variant="label"
        tone={selected ? 'accent' : 'secondary'}
        style={styles.candidateLabel}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: {
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { marginTop: spacing.xl },
  compareTitle: { marginBottom: spacing.sm },
  compareHint: { marginBottom: spacing.xl },
  compareRow: { flexDirection: 'row' },
  candidate: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.xs,
    borderRadius: radius.xl,
  },
  candidateLabel: { marginTop: spacing.md },
  replaceNotice: { marginTop: spacing.base, maxWidth: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { marginTop: spacing.lg, minWidth: 180, alignSelf: 'center' },
  ghost: { marginTop: spacing.xs },
  cost: { marginTop: spacing.xs },
});
