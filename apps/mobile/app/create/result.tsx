import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { pixelsApi, type PixelGeneration } from '@/api';
import { copy } from '@/constants/copy';
import { haptics } from '@/lib/haptics';
import { layout, opacity, radius, spacing, useTheme } from '@/theme';
import { Button, ConfirmDialog, Header, PixelCharacter, Screen, Text } from '@/ui';
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
 * - **Any later character.** The normal result, with the cost of another
 *   attempt stated *before* it is spent. If there is nothing left to spend, we
 *   offer the store rather than silently disabling the button.
 */
export default function ResultRoute() {
  const router = useRouter();
  const { colors } = useTheme();

  const draft = useGenerationStore((state) => state.draft);
  const setGeneration = useGenerationStore((state) => state.setGeneration);
  const entitlements = useAuthStore((state) => state.user?.entitlements ?? null);
  const todayStatus = useTodayStatus();

  const [retryPrompt, setRetryPrompt] = useState(false);

  const generation = draft?.generation ?? null;

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

  const freeRetryAvailable =
    entitlements?.firstRetryAvailable ??
    todayStatus.data?.firstRetryAvailable ??
    false;
  const bonusFree = entitlements?.bonusFreeCredits ?? 0;
  const credits = entitlements?.creditBalance ?? 0;

  const retryCostLabel = freeRetryAvailable
    ? copy.generation.freeRetryHint
    : bonusFree > 0
      ? copy.generation.bonusRemainingCount(bonusFree)
      : credits > 0
        ? copy.generation.retryCostCredit
        : copy.generation.retryNoCredit;

  const onRetry = useCallback(() => {
    if (!freeRetryAvailable && bonusFree <= 0 && credits <= 0) {
      router.push('/store');
      return;
    }
    // A free retry needs no confirmation — the whole point is that it costs
    // nothing and should feel effortless.
    if (freeRetryAvailable) {
      router.replace({ pathname: '/create/generating', params: { retry: '1' } });
      return;
    }
    setRetryPrompt(true);
  }, [bonusFree, credits, freeRetryAvailable, router]);

  const onAccept = useCallback(() => {
    if (selected && selected.id !== generation?.id) {
      // Publish whichever candidate the user chose, not whichever was last.
      setGeneration(selected);
    }
    router.replace('/create/publish');
  }, [generation?.id, router, selected, setGeneration]);

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
          <Button
            label={copy.errors.retry}
            fullWidth={false}
            style={styles.retry}
            onPress={() => router.replace('/create')}
          />
        </View>
      </Screen>
    );
  }

  const isFirstCharacter = freeRetryAvailable || comparing;

  return (
    <>
      <Screen
        footer={
          <View>
            <Button label={copy.generation.accept} onPress={onAccept} />
            <Button
              label={
                freeRetryAvailable
                  ? copy.generation.freeRetry
                  : copy.generation.retry
              }
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
              {retryCostLabel}
            </Text>
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
                accessibilityLabel="방금 만들어진 내 PIXME"
              />
            </View>

            <Text variant="title2" align="center" style={styles.title}>
              {isFirstCharacter
                ? copy.generation.firstResultTitle
                : copy.generation.resultTitle}
            </Text>

            {todayStatus.data?.myTodayStatus ? (
              <Text
                variant="caption"
                tone="secondary"
                align="center"
                style={styles.replaceNotice}
              >
                {copy.publish.replaceBody}
              </Text>
            ) : null}
          </View>
        )}
      </Screen>

      <ConfirmDialog
        visible={retryPrompt}
        title={copy.generation.retry}
        body={copy.generation.retryConsumesNotice}
        confirmLabel={copy.generation.retry}
        onConfirm={() => {
          setRetryPrompt(false);
          router.replace({
            pathname: '/create/generating',
            params: { retry: '1' },
          });
        }}
        onCancel={() => setRetryPrompt(false)}
      />
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
  retry: { marginTop: spacing.lg, minWidth: 180 },
  ghost: { marginTop: spacing.xs },
  cost: { marginTop: spacing.xs },
});
