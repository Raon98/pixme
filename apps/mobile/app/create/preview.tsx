import { useCallback, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { cropImage } from '@/lib/image';
import { layout, radius, spacing, useTheme } from '@/theme';
import { Button, Header, Screen, Text } from '@/ui';
import { useGenerationStore } from '@/features/generation/generationStore';

/** Portrait 3:4 frame — tall enough for a full body, forgiving for a selfie. */
const FRAME_RATIO = 4 / 3;

/**
 * Photo preview and framing.
 *
 * The user drags the photo vertically inside a 3:4 frame; we crop to exactly
 * what they see. Framing is a *suggestion*, never a requirement — the product
 * explicitly accepts selfies, so there is no "full body required" gate here.
 */
export default function PreviewRoute() {
  const router = useRouter();
  const { colors } = useTheme();

  const draft = useGenerationStore((state) => state.draft);
  const startDraft = useGenerationStore((state) => state.startDraft);

  const [busy, setBusy] = useState(false);

  const frameWidth = Math.min(
    Dimensions.get('window').width - layout.gutter * 2,
    layout.maxContentWidth,
  );
  const frameHeight = frameWidth * FRAME_RATIO;

  const displayHeight = useMemo(() => {
    if (!draft) return frameHeight;
    return (frameWidth * draft.source.height) / draft.source.width;
  }, [draft, frameHeight, frameWidth]);

  /** Negative range: how far up the image may be dragged. */
  const minTranslate = Math.min(0, frameHeight - displayHeight);

  const translateY = useSharedValue(minTranslate / 2);
  const startY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          const next = startY.value + event.translationY;
          translateY.value = Math.min(0, Math.max(minTranslate, next));
        }),
    [minTranslate, startY, translateY],
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const onConfirm = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    try {
      // Map the on-screen frame back to source pixels.
      const scale = draft.source.height / displayHeight;
      const originY = Math.round(Math.max(0, -translateY.value) * scale);
      const cropHeight = Math.round(
        Math.min(draft.source.height - originY, frameHeight * scale),
      );

      const needsCrop =
        cropHeight > 0 && cropHeight < draft.source.height - 1;

      const image = needsCrop
        ? await cropImage(draft.source.uri, {
            originX: 0,
            originY,
            width: draft.source.width,
            height: cropHeight,
          })
        : draft.source;

      startDraft(image, draft.style);
      router.replace('/create/generating');
    } finally {
      setBusy(false);
    }
  }, [displayHeight, draft, frameHeight, router, startDraft, translateY]);

  if (!draft) {
    // Defensive: a cold start into this route has no photo to show.
    return (
      <Screen>
        <Header title={copy.create.previewTitle} />
        <View style={styles.center}>
          <Text variant="body" tone="secondary" align="center">
            사진을 다시 선택해주세요.
          </Text>
          <Button
            label={copy.create.retake}
            fullWidth={false}
            style={styles.retake}
            onPress={() => router.replace('/create')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View>
          <Button
            label={copy.create.previewCta}
            loading={busy}
            onPress={() => void onConfirm()}
          />
          <Button
            label={copy.create.retake}
            variant="ghost"
            onPress={() => router.replace('/create')}
            style={styles.ghost}
          />
        </View>
      }
    >
      <Header title={copy.create.previewTitle} onBack={() => router.back()} />

      <View style={styles.body}>
        <GestureDetector gesture={pan}>
          <View
            style={[
              styles.frame,
              {
                width: frameWidth,
                height: frameHeight,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSubtle,
              },
            ]}
          >
            <Animated.View style={imageStyle}>
              <Image
                source={{ uri: draft.source.uri }}
                style={{ width: frameWidth, height: displayHeight }}
                contentFit="cover"
                accessibilityLabel="선택한 사진"
              />
            </Animated.View>

            {/* Framing guide: head area and body area, hinted not enforced. */}
            <View pointerEvents="none" style={styles.guides}>
              <View
                style={[
                  styles.guideLine,
                  { borderColor: colors.borderStrong, top: frameHeight * 0.28 },
                ]}
              />
              <View
                style={[
                  styles.guideLine,
                  { borderColor: colors.borderStrong, top: frameHeight * 0.72 },
                ]}
              />
            </View>
          </View>
        </GestureDetector>

        <Text variant="caption" tone="secondary" align="center" style={styles.hint}>
          {copy.create.previewHint}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  guides: { ...StyleSheet.absoluteFill },
  guideLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    opacity: 0.4,
  },
  hint: { marginTop: spacing.lg, maxWidth: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retake: { marginTop: spacing.lg, minWidth: 180 },
  ghost: { marginTop: spacing.xs },
});
