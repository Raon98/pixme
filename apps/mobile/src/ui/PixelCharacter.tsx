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

import { copy } from '@/constants/copy';
import { duration, radius, useTheme } from '@/theme';


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
  priority = 'normal',
  accessibilityLabel,
}: PixelCharacterProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);

  // 3 phase buckets keeps the crowd varied without looking random.
  const phase = useMemo(() => (idleVariant % 3) * 140, [idleVariant]);
  const period = useMemo(
    () => duration.pixelStep * (6 + (idleVariant % 3)),
    [idleVariant],
  );
  /**
   * The sway runs on a deliberately different period from the bob, and an
   * odd multiple so the two never resync into one mechanical motion. Without
   * it a crowd reads as a row of objects moving up and down rather than
   * people shifting their weight.
   */
  const swayPeriod = useMemo(
    () => duration.pixelStep * (11 + ((idleVariant * 2) % 5)),
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
    sway.value = withDelay(
      phase * 2,
      withRepeat(
        withSequence(
          withTiming(1, { duration: swayPeriod, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: swayPeriod, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      bob.value = 0;
      sway.value = 0;
    };
  }, [idle, phase, period, swayPeriod, bob, sway]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * Math.max(1, size * 0.018) },
      { translateX: sway.value * Math.max(0.5, size * 0.008) },
      // Pivot at the feet, so the weight shift looks like a person leaning
      // rather than a sprite spinning around its middle.
      { rotateZ: `${sway.value * 0.5}deg` },
    ],
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
        accessibilityLabel={accessibilityLabel ?? copy.a11y.pixelCharacter}
      >
        <PlaceholderFigure size={size} color={colors.textTertiary} />
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
        accessibilityLabel={accessibilityLabel ?? copy.a11y.pixelCharacter}
      />
    </Animated.View>
  );
}

/**
 * Stand-in for a character that is missing or still loading.
 *
 * <p>Two stacked blocks, not an emoji: a glossy multi-colour glyph was the
 * most saturated thing on an otherwise quiet screen, and it read as a
 * mascot the product does not have. This reads as "a character belongs
 * here" and then gets out of the way.
 */
function PlaceholderFigure({ size, color }: { size: number; color: string }) {
  const unit = size * 0.16;
  return (
    <View style={{ alignItems: 'center', opacity: 0.45 }}>
      <View
        style={{
          width: unit * 1.1,
          height: unit * 1.1,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: unit * 1.7,
          height: unit * 1.5,
          marginTop: unit * 0.3,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
