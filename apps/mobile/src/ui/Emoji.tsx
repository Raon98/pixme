import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

export interface EmojiProps {
  children: string;
  size: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * An emoji, rendered with no text styling imposed on it.
 *
 * <p>Deliberately *not* our themed `Text`. That component always merges a
 * `color` (and a variant's `fontWeight`) into the style, and a colour emoji
 * is a bitmap glyph that wants neither — on iOS a foreground colour on an
 * emoji-only run can flatten it to a single-colour blob, and a synthesised
 * bold does the same. A waving hand turning into an orange smear is what
 * prompted this.
 *
 * <p>`allowFontScaling` is off because these are sized to sit in a layout
 * (a chip prefix, a 44pt empty-state glyph); letting Dynamic Type grow them
 * independently of their container is what breaks the row they live in.
 */
export function Emoji({ children, size, style, accessibilityLabel }: EmojiProps) {
  return (
    <RNText
      allowFontScaling={false}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.2) }, style]}
    >
      {children}
    </RNText>
  );
}
