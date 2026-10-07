import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { duration, opacity, radius, useTheme } from '@/theme';

export interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ value, onChange, label, disabled }: ToggleProps) {
  const { colors } = useTheme();

  const knob = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(value ? 18 : 2, { duration: duration.fast }) },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onChange(!value);
      }}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.accent : colors.surfacePressed,
          opacity: disabled ? opacity.disabled : 1,
        },
      ]}
    >
      <Animated.View style={[styles.knobWrap, knob]}>
        <View style={[styles.knob, { backgroundColor: colors.surface }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
  knobWrap: { position: 'absolute' },
  knob: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
  },
});
