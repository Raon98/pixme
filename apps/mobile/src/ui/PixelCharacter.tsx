import { useEffect, useMemo, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { duration, radius, useTheme } from '@/theme';

import { Text } from './Text';

export interface PixelCharacterProps {
  /** Transparent-background PNG produced by the generation pipeline. */
  uri: string | null | undefined;
  size: number;
  /**
   * Idle bob. The variant offsets the phase so a crowd in the square doesn't
   * breathe in lockstep — the single biggest cue that it's a living space.
   */
  idle?: boolean;
  idleVariant?: number;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  /** Shown while loading and when `uri` is null. */
  placeholderLabel?: string;
  /** Disk+memory cache: characters are immutable once generated. */
  priority?: 'low' | 'normal' | 'high';
  accessibilityLabel?: string;
}

/**
 * Renders a PIXME character.
 *
 * Two things matter here and are easy to get wrong:
 *  1. `imageRendering: pixelated` — without nearest-neighbour upscaling the
 *     art turns to mush, which breaks the whole art direction.
 *  2. Transparent background — characters composite onto the feed card stage
 *     and onto the square scene, so the asset must never carry its own bg.
 */
export function PixelCharacter({
  uri,
  size,
  idle = false,
  idleVariant = 0,
  contentFit = 'contain',
  style,
  placeholderLabel = '👾',
  priority = 'normal',
  accessibilityLabel,
}: PixelCharacterProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const bob = useSharedValue(0);

  // 3 phase buckets keeps the crowd varied without looking random.
  const phase = useMemo(() => (idleVariant % 3) * 140, [idleVariant]);
  const period = useMemo(
    () => duration.pixelStep * (6 + (idleVariant % 3)),
    [idleVariant],
  );

  useEffect(() => {
    if (!idle) return;
    bob.value = withDelay(
      phase,
      withRepeat(
        withSequence(
          withTiming(-1, { duration: period, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: period, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      bob.value = 0;
    };
  }, [idle, phase, period, bob]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * Math.max(1, size * 0.018) }],
  }));

  if (!uri || failed) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            width: size,
            height: size,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radius.md,
          },
          style,
        ]}
        accessible
        accessibilityLabel={accessibilityLabel ?? 'PIXME 캐릭터'}
      >
        <Text style={{ fontSize: size * 0.34 }}>{placeholderLabel}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle, style]}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit={contentFit}
        // Nearest-neighbour upscale: non-negotiable for pixel art.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ imageRendering: 'pixelated' } as any)}
        transition={{ duration: duration.base, effect: 'cross-dissolve' }}
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={uri}
        onError={() => setFailed(true)}
        accessible
        accessibilityLabel={accessibilityLabel ?? 'PIXME 캐릭터'}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
