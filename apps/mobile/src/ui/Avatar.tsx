import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';

import { PixelCharacter } from './PixelCharacter';
import { Text } from './Text';

export interface AvatarProps {
  uri: string | null | undefined;
  size?: number;
  nickname?: string;
  /** Mint ring used for "connected" peers. */
  ring?: 'none' | 'connection' | 'accent';
  style?: StyleProp<ViewStyle>;
}

/**
 * A character bust in a rounded tile. We never crop a character into a circle
 * — pixel art loses its silhouette — so this is a squared tile with a soft
 * radius and the character composited inside it.
 */
export function Avatar({
  uri,
  size = 44,
  nickname,
  ring = 'none',
  style,
}: AvatarProps) {
  const { colors } = useTheme();

  const ringColor =
    ring === 'connection'
      ? colors.connection
      : ring === 'accent'
        ? colors.accent
        : 'transparent';

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: radius.base,
          backgroundColor: colors.surfaceSubtle,
          borderWidth: ring === 'none' ? 0 : 2,
          borderColor: ringColor,
        },
        style,
      ]}
    >
      {uri ? (
        <PixelCharacter
          uri={uri}
          size={size * 0.92}
          accessibilityLabel={nickname ? `${nickname}의 PIXME` : 'PIXME'}
        />
      ) : (
        <Text variant="label" tone="tertiary">
          {nickname?.slice(0, 1).toUpperCase() ?? '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
