import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { haptics } from '@/lib/haptics';
import { opacity, radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading emoji / glyph. */
  prefix?: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'accent' | 'heart' | 'wave';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Used for interests, tags and curation filters. Selection is a fill change,
 * not a checkmark — it reads faster in a dense wrap layout.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  prefix,
  size = 'md',
  tone = 'accent',
  disabled = false,
  style,
}: ChipProps) {
  const { colors } = useTheme();

  const selectedBg =
    tone === 'heart'
      ? colors.heartSubtle
      : tone === 'wave'
        ? colors.waveSubtle
        : tone === 'default'
          ? colors.surfacePressed
          : colors.accentSubtle;

  const selectedBorder =
    tone === 'heart'
      ? colors.heart
      : tone === 'wave'
        ? colors.wave
        : tone === 'default'
          ? colors.borderStrong
          : colors.accent;

  const height = size === 'sm' ? 28 : 36;
  const paddingHorizontal = size === 'sm' ? spacing.md : spacing.base;

  const content = (
    <View
      style={[
        styles.root,
        {
          height,
          paddingHorizontal,
          borderRadius: radius.full,
          backgroundColor: selected ? selectedBg : colors.surfaceSubtle,
          borderColor: selected ? selectedBorder : colors.border,
        },
        style,
      ]}
    >
      {prefix ? (
        <Text variant={size === 'sm' ? 'micro' : 'caption'} style={styles.prefix}>
          {prefix}
        </Text>
      ) : null}
      <Text
        variant={size === 'sm' ? 'micro' : 'label'}
        tone={selected ? (tone === 'default' ? 'default' : tone) : 'secondary'}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        pressed ? { opacity: opacity.pressed } : null,
        disabled ? { opacity: opacity.disabled } : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  prefix: { marginRight: spacing.xs },
});
