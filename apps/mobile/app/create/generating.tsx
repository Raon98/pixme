import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { spacing } from '@/theme';
import { Button, Header, Screen, Text } from '@/ui';
import { GenerationStages } from '@/features/generation/GenerationStages';
import { useGenerationFlow } from '@/features/generation/useGenerationFlow';

/**
 * Generation progress.
 *
 * Kicks off exactly once per mount (the `started` ref guards React's
 * double-invoked effects in dev) and routes forward on completion. Back
 * gestures are disabled for this screen in the root stack: leaving mid-flight
 * would abandon a generation the user has already paid for.
 */
export default function GeneratingRoute() {
  const router = useRouter();
  const { retry } = useLocalSearchParams<{ retry?: string }>();
  const { state, start, draft } = useGenerationFlow();
  const started = useRef(false);
  // Set from the route on arrival, and latched for in-screen "다시 시도" too.
  const isRetry = useRef(retry === '1');

  useEffect(() => {
    if (!draft) {
      router.replace('/create');
      return;
    }
    if (started.current) return;
    started.current = true;
    void start({ isRetry: isRetry.current });
  }, [draft, router, start]);

  useEffect(() => {
    if (state.phase === 'completed') {
      router.replace('/create/result');
    }
  }, [router, state.phase]);

  const failed =
    state.phase === 'failed' ||
    state.phase === 'unsafe' ||
    state.phase === 'timeout';

  if (failed) {
    const unsafe = state.phase === 'unsafe';
    const timedOut = state.phase === 'timeout';

    return (
      <Screen
        footer={
          <View>
            <Button
              label={unsafe ? copy.create.retake : copy.errors.retry}
              onPress={() => {
                if (unsafe) {
                  router.replace('/create');
                  return;
                }
                started.current = false;
                isRetry.current = true;
                void start({ isRetry: true });
              }}
            />
            <Button
              label={copy.common.close}
              variant="ghost"
              onPress={() => router.replace('/(tabs)')}
              style={styles.ghost}
            />
          </View>
        }
      >
        <Header
          title={copy.generation.resultTitle}
          onBack={() => router.replace('/(tabs)')}
        />
        <View style={styles.center}>
          <Text style={styles.glyph}>{unsafe ? '🙂' : '🧩'}</Text>
          <Text variant="title3" align="center">
            {unsafe
              ? copy.generation.unsafeTitle
              : timedOut
                ? copy.generation.timeoutTitle
                : copy.generation.failedTitle}
          </Text>
          <Text
            variant="caption"
            tone="secondary"
            align="center"
            style={styles.body}
          >
            {unsafe
              ? copy.generation.unsafeBody
              : timedOut
                ? copy.generation.timeoutBody
                : copy.generation.failedBody}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={copy.generation.resultTitle} showBack={false} />
      <View style={styles.center}>
        <GenerationStages progress={state.progress} />
      </View>
      <Text variant="micro" tone="tertiary" align="center" style={styles.footnote}>
        창을 닫아도 생성은 계속돼요. 완성되면 알림으로 알려드릴게요.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 52, marginBottom: spacing.lg },
  body: { marginTop: spacing.md, maxWidth: 280 },
  footnote: { paddingBottom: spacing.xl },
  ghost: { marginTop: spacing.xs },
});
