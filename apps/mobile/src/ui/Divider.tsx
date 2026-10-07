import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { spacing, useTheme } from '@/theme';

export function Divider({
  inset = false,
  style,
}: {
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: inset ? spacing.base : 0,
        },
        style,
      ]}
    />
  );
}
