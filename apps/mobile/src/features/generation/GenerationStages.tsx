import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { duration, radius, spacing, useTheme } from '@/theme';
import { ProgressBar, Text } from '@/ui';

/**
 * Loading UI for generation.
 *
 * The three stage lines are driven by *real* server progress, not a timer:
 * 0–35% "looking at today's style", 35–80% "moving hair and clothes into
 * pixels", 80%+ "almost done". A fake timeline that finishes before the
 * server does is worse than a spinner, because the user then waits on a
 * screen that claims to be finished.
 */
export function GenerationStages({ progress }: { progress: number }) {
  const { colors } = useTheme();

  const stageIndex = useMemo(() => {
    if (progress < 0.35) return 0;
    if (progress < 0.8) return 1;
    return 2;
  }, [progress]);

  return (
    <View style={styles.root}>
      <PixelLoader />

      <Text variant="title3" align="center" style={styles.stageText}>
        {copy.generation.steps[stageIndex]}
      </Text>

      <View style={styles.progressWrap}>
        <ProgressBar progress={progress} />
      </View>

      <View style={styles.dots}>
        {copy.generation.steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index <= stageIndex ? colors.accent : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A 3x3 block of pixels that lights up in a loop — reads as "something is
 * being drawn" and costs nothing to render.
 */
function PixelLoader() {
  const { colors } = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setTick((value) => (value + 1) % 9),
      duration.pixelStep,
    );
    return () => clearInterval(interval);
  }, []);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Spiral order so the fill reads as a deliberate draw, not random noise.
  const order = [0, 1, 2, 5, 8, 7, 6, 3, 4];

  return (
    <Animated.View style={[styles.loader, animated]}>
      {Array.from({ length: 9 }).map((_, index) => {
        const position = order.indexOf(index);
        const lit = position <= tick;
        return (
          <View
            key={index}
            style={[
              styles.pixel,
              {
                backgroundColor: lit ? colors.accent : colors.surfacePressed,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  loader: {
    width: 84,
    height: 84,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  pixel: { width: 24, height: 24, borderRadius: radius.pixel },
  stageText: { marginTop: spacing.xxl, minHeight: 52 },
  progressWrap: { width: 200, marginTop: spacing.base },
  dots: { flexDirection: 'row', marginTop: spacing.base },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: spacing.xs,
  },
});
