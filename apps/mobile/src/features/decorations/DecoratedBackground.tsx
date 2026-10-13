import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BACKGROUNDS, type BackgroundStyle } from './catalog';

export interface DecoratedBackgroundProps {
  /** Unlock code from the author's applied decorations, if any. */
  code?: string;
  /** Drawn when the author has no background applied, or an unknown one. */
  fallback: readonly [string, string];
  /** Animation only runs for the card the user is actually looking at. */
  active?: boolean;
}

/**
 * The layer behind a status card's character.
 *
 * <p>Unknown codes fall through to `fallback` on purpose: the server may know
 * about a background this build doesn't, and a plain card is a much better
 * failure than a blank one.
 */
export function DecoratedBackground({
  code,
  fallback,
  active = true,
}: DecoratedBackgroundProps) {
  const style: BackgroundStyle | undefined = code ? BACKGROUNDS[code] : undefined;
  const colors = style?.colors ?? fallback;

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <LinearGradient
        colors={[...colors] as [string, string, ...string[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {style?.orb ? <Orb {...style.orb} /> : null}
      {style?.stars ? <Stars /> : null}
      {style?.weather && active ? <Weather kind={style.weather} /> : null}
    </View>
  );
}

/**
 * The sun at dusk, the moon at night. Sized and placed as fractions of the
 * card so the same definition works on a feed card, the MY hero and a
 * profile, whatever their pixel sizes.
 */
function Orb({
  color,
  halo,
  x,
  y,
  size,
}: NonNullable<BackgroundStyle['orb']>) {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: `${(x - size) * 100}%`,
          top: `${(y - size) * 100}%`,
          width: `${size * 2 * 100}%`,
          aspectRatio: 1,
          borderRadius: 999,
          backgroundColor: halo,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: `${(x - size / 2) * 100}%`,
          top: `${(y - size / 2) * 100}%`,
          width: `${size * 100}%`,
          aspectRatio: 1,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </>
  );
}

/**
 * Deterministic pixel star field. Squares, not circles — this is a pixel-art
 * product — with two bright cross-shaped sparkles so the sky has focal
 * points. Positions are hashed from the index, so every card shows the same
 * sky and nothing re-randomises on re-render.
 */
const STARS = Array.from({ length: 22 }, (_, i) => ({
  left: ((i * 37 + 11) % 100) / 100,
  top: ((i * 53 + 7) % 72) / 100,
  size: i % 5 === 0 ? 3 : 2,
  opacity: 0.35 + ((i * 29) % 50) / 100,
}));

function Stars() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((star, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: `${star.left * 100}%`,
            top: `${star.top * 100}%`,
            width: star.size,
            height: star.size,
            backgroundColor: '#F6F2E4',
            opacity: star.opacity,
          }}
        />
      ))}
      {[{ left: 0.22, top: 0.3 }, { left: 0.62, top: 0.52 }].map((spark, i) => (
        <View key={`spark-${i}`} style={{ position: 'absolute', left: `${spark.left * 100}%`, top: `${spark.top * 100}%` }}>
          <View style={styles.sparkV} />
          <View style={styles.sparkH} />
        </View>
      ))}
    </View>
  );
}

const DROP_COUNT = 14;

/**
 * Falling pixel particles. Deliberately plain `Animated` squares on a loop
 * rather than a particle library — this runs behind every visible card, so
 * the cost of the effect has to stay close to zero.
 */
function Weather({ kind }: { kind: 'rain' | 'snow' }) {
  const drops = useMemo(
    () =>
      Array.from({ length: DROP_COUNT }, (_, index) => ({
        left: `${(index * 97) % 100}%`,
        delay: (index * 173) % 2000,
        size: kind === 'rain' ? 2 : 3,
        duration: kind === 'rain' ? 1100 : 2600,
      })),
    [kind],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((drop, index) => (
        <Drop key={index} {...drop} kind={kind} />
      ))}
    </View>
  );
}

function Drop({
  left,
  delay,
  size,
  duration,
  kind,
}: {
  left: string;
  delay: number;
  size: number;
  duration: number;
  kind: 'rain' | 'snow';
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 520],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 0.7, 0.7, 0],
  });

  return (
    <Animated.View
      style={[
        styles.drop,
        {
          left: left as unknown as number,
          width: size,
          height: kind === 'rain' ? size * 6 : size,
          borderRadius: kind === 'rain' ? 0 : size,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  sparkV: {
    position: 'absolute',
    left: 3,
    top: 0,
    width: 2,
    height: 8,
    backgroundColor: '#FFF9E8',
    opacity: 0.9,
  },
  sparkH: {
    position: 'absolute',
    left: 0,
    top: 3,
    width: 8,
    height: 2,
    backgroundColor: '#FFF9E8',
    opacity: 0.9,
  },
  drop: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FFFFFF',
  },
});
