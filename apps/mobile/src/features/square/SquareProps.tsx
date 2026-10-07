import { StyleSheet, View } from 'react-native';

import type { SquareProp } from '@/api';
import { layout } from '@/theme';
import { Text } from '@/ui';

/**
 * Scene furniture — benches, lamps, trees, a bus stop, a tiny café.
 *
 * Rendered as glyph props positioned by the server so the square can be
 * re-dressed (Night / Rain / Spring / Winter) by changing data, not code. When
 * dedicated pixel sprites ship, only `GLYPHS` changes.
 */
const GLYPHS: Record<string, string> = {
  BENCH: '🪑',
  STREET_LAMP: '🏮',
  TREE: '🌳',
  CAFE: '🏠',
  FOUNTAIN: '⛲️',
  BUS_STOP: '🚏',
  PLANT: '🪴',
  CLOUD: '☁️',
  MOON: '🌙',
  SUN: '☀️',
  PUDDLE: '💧',
  SNOWMAN: '⛄️',
  FLOWER: '🌷',
  LANTERN: '🏮',
  SIGN: '🪧',
};

export function SquareProps({
  props,
  accent,
}: {
  props: SquareProp[];
  accent: string;
}) {
  const { width, height } = layout.squareCanvas;

  return (
    <>
      {props.map((prop, index) => {
        const glyph = GLYPHS[prop.code];
        if (!glyph) return null;
        return (
          <View
            key={`${prop.code}-${index}`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.prop,
              {
                left: `${(prop.x / width) * 100}%`,
                top: `${(prop.y / height) * 100}%`,
                zIndex: prop.zIndex,
              },
            ]}
          >
            <Text style={{ fontSize: 34 * prop.scale, color: accent }}>
              {glyph}
            </Text>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  prop: { position: 'absolute', marginLeft: -18, marginTop: -34 },
});
