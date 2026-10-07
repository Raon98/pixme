import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { radius, spacing, useTheme } from '@/theme';
import { Screen, Text } from '@/ui';

/**
 * Splash / bootstrap screen.
 *
 * Shown only while the session is being restored; `_layout`'s redirect takes
 * over the moment that resolves. Animation is deliberately minimal — the
 * wordmark, the slogan, and a few blinking pixels.
 */
export default function SplashRoute() {
  const { colors } = useTheme();

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.root}>
        <Text variant="display" style={styles.wordmark}>
          {copy.brand.name}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.slogan}>
          {copy.brand.slogan}
        </Text>

        <View style={styles.pixels}>
          {[0, 1, 2, 3].map((index) => (
            <BlinkingPixel key={index} index={index} color={colors.accent} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function BlinkingPixel({ index, color }: { index: number; color: string }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.25, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.pixel, { backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { letterSpacing: 4 },
  slogan: { marginTop: spacing.md },
  pixels: { flexDirection: 'row', marginTop: spacing.xxxl },
  pixel: {
    width: 8,
    height: 8,
    borderRadius: radius.pixel,
    marginHorizontal: spacing.xs,
  },
});
