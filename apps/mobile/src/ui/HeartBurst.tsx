import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

export interface HeartBurstParticle {
  dx: number;
  dy: number;
  delay: number;
  size: number;
  rotate: number;
}

/** Deliberately restrained: "a small pixel heart popping out", not confetti. */
const DEFAULT_PARTICLES: HeartBurstParticle[] = [
  { dx: 0, dy: -62, delay: 0, size: 26, rotate: 0 },
  { dx: -26, dy: -44, delay: 60, size: 16, rotate: -18 },
  { dx: 24, dy: -48, delay: 95, size: 18, rotate: 16 },
  { dx: -14, dy: -78, delay: 150, size: 12, rotate: -8 },
  { dx: 16, dy: -84, delay: 185, size: 13, rotate: 10 },
];

/**
 * The heart reaction animation: small pixel hearts that pop out and drift up.
 *
 * <p>Takes its particle layout from the caller so a purchased pixel effect can
 * supply a richer one — this layer stays presentational and knows nothing
 * about the store.
 */
export function HeartBurst({
  /** Increment to replay. */
  trigger,
  particles = DEFAULT_PARTICLES,
  glyph = 'heart',
  color,
}: {
  trigger: number;
  particles?: HeartBurstParticle[];
  /** Which mark flies out — a purchased effect can swap it. */
  glyph?: 'heart' | 'star';
  /** Overrides the theme's reaction colour. */
  color?: string;
}) {
  if (trigger === 0) return null;
  return (
    <View pointerEvents="none" style={styles.root}>
      {particles.map((particle, index) => (
        <Particle
          key={`${trigger}-${index}`}
          {...particle}
          glyph={glyph}
          color={color}
        />
      ))}
    </View>
  );
}

function Particle({
  dx,
  dy,
  delay,
  size,
  rotate,
  glyph,
  color,
}: HeartBurstParticle & { glyph: 'heart' | 'star'; color?: string }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(1, { duration: 320 }),
        withTiming(0, { duration: 280 }),
      ),
    );
  }, [delay, progress, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: dx * progress.value },
      { translateY: dy * progress.value },
      { scale: 0.6 + 0.6 * progress.value },
      { rotate: `${rotate * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, style]}>
      <Icon
        name={glyph === 'star' ? 'star-filled' : 'heart-filled'}
        size={size}
        color={color ?? colors.heart}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: { position: 'absolute' },
});
