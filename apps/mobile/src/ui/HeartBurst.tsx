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

/**
 * The heart reaction animation: a handful of small pixel hearts that pop out
 * and drift up. Deliberately restrained — the spec calls for "a small pixel
 * heart naturally popping out", not confetti.
 */
const PARTICLES = [
  { dx: 0, dy: -62, delay: 0, size: 26, rotate: 0 },
  { dx: -26, dy: -44, delay: 60, size: 16, rotate: -18 },
  { dx: 24, dy: -48, delay: 95, size: 18, rotate: 16 },
  { dx: -14, dy: -78, delay: 150, size: 12, rotate: -8 },
  { dx: 16, dy: -84, delay: 185, size: 13, rotate: 10 },
];

export function HeartBurst({
  /** Increment to replay. */
  trigger,
}: {
  trigger: number;
}) {
  if (trigger === 0) return null;
  return (
    <View pointerEvents="none" style={styles.root}>
      {PARTICLES.map((particle, index) => (
        <Particle key={`${trigger}-${index}`} {...particle} />
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
}: (typeof PARTICLES)[number]) {
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
      <Icon name="heart-filled" size={size} color={colors.heart} />
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
