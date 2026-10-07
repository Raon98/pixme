import { useEffect } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration, radius, useTheme } from '@/theme';

export interface ProgressBarProps {
  /** 0–1. */
  progress: number;
  height?: number;
  tone?: 'accent' | 'connection';
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  height = 6,
  tone = 'accent',
  style,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: duration.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(progress * 100), min: 0, max: 100 }}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: colors.surfacePressed },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            height,
            borderRadius: radius.full,
            backgroundColor:
              tone === 'connection' ? colors.connection : colors.accent,
          },
          fill,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});
