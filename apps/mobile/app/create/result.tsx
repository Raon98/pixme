import { useCallback, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { layout, radius, spacing, useTheme } from '@/theme';
import { Button, ConfirmDialog, Header, PixelCharacter, Screen, Text } from '@/ui';
import { useGenerationStore } from '@/features/generation/generationStore';
import { useTodayStatus } from '@/features/feed/useTodayFeed';
import { useAuthStore } from '@/features/auth/authStore';

/**
 * Generation result.
 *
 * The first generation of the day is free; "다시 만들어보기" costs a credit,
 * and we say so *before* spending it. If the user has no credit we offer the
 * store rather than silently disabling the button, so the cost is always
 * legible and never a surprise charge.
 */
export default function ResultRoute() {
  const router = useRouter();
  const { colors } = useTheme();

  const draft = useGenerationStore((state) => state.draft);
  const entitlements = useAuthStore((state) => state.user?.entitlements ?? null);
  const todayStatus = useTodayStatus();

  const [retryPrompt, setRetryPrompt] = useState(false);

  const generation = draft?.generation ?? null;

  const characterSize = useMemo(
    () =>
      Math.min(
        Dimensions.get('window').width - layout.gutter * 2 - spacing.xxl,
        300,
      ),
    [],
  );

  const freeAvailable = entitlements?.freeGenerationAvailable ?? false;
  const credits = entitlements?.creditBalance ?? 0;

  const retryCostLabel = freeAvailable
    ? copy.generation.retryCostFree
    : credits > 0
      ? copy.generation.retryCostCredit
      : copy.generation.retryNoCredit;

  const onRetry = useCallback(() => {
    if (!freeAvailable && credits <= 0) {
      router.push('/store');
      return;
    }
    setRetryPrompt(true);
  }, [credits, freeAvailable, router]);

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

  return (
    <>
      <Screen
        footer={
          <View>
            <Button
              label={copy.generation.accept}
              onPress={() => router.replace('/create/publish')}
            />
            <Button
              label={copy.generation.retry}
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
            {copy.generation.resultTitle}
          </Text>

          {draft && draft.candidates.length > 1 ? (
            <Text
              variant="micro"
              tone="tertiary"
              align="center"
              style={styles.candidates}
            >
              오늘 만든 후보 {draft.candidates.length}개 중 마지막 모습이에요.
            </Text>
          ) : null}

          {todayStatus.data?.myTodayPost ? (
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
      </Screen>

      <ConfirmDialog
        visible={retryPrompt}
        title={copy.generation.retry}
        body={
          freeAvailable
            ? copy.generation.retryCostFree
            : copy.generation.retryCostCredit
        }
        confirmLabel={copy.generation.retry}
        onConfirm={() => {
          setRetryPrompt(false);
          // `retry=1` tells the generating screen to re-render the stored
          // analysis rather than replay the upload, which is single-use.
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

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: {
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { marginTop: spacing.xl },
  candidates: { marginTop: spacing.sm },
  replaceNotice: { marginTop: spacing.base, maxWidth: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { marginTop: spacing.lg, minWidth: 180 },
  ghost: { marginTop: spacing.xs },
  cost: { marginTop: spacing.xs },
});
