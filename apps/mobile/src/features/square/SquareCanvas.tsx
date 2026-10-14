import React, { useCallback, useMemo, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { SquareOccupant, SquareResponse } from '@/api';
import { moodEmoji } from '@/constants/moods';
import { copy } from '@/constants/copy';
import { layout, radius, spacing, useTheme } from '@/theme';
import { PixelCharacter, Text } from '@/ui';

import { PlazaGround } from './PlazaGround';
import { SquareProps } from './SquareProps';

export interface SquareCanvasProps {
  data: SquareResponse;
  onSelectOccupant: (occupant: SquareOccupant) => void;
  /** Rendered above the canvas (curation rails). */
  header?: React.ReactNode;
  /** Pull-to-refresh control, owned by the screen. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** The viewer's own user id, if they are standing in the square today. */
  myUserId?: string | null;
}

/**
 * Where the painted ground starts, as a fraction of canvas height.
 *
 * <p>Sky is backdrop, not space. Every row above the horizon is dead canvas,
 * and it compounds with {@link FEET_TOP} below — at 0.4 sky plus a 0.48 floor,
 * nearly half the square was guaranteed to be empty no matter how many people
 * turned up, which read as a bug rather than a quiet day.
 */
const HORIZON = 0.22;

/**
 * The highest a character's feet may stand, as a fraction of canvas height.
 * Below the horizon by about one character's height: a 72pt body is drawn
 * upwards from its feet, so standing on the skyline itself put the whole
 * person in the sky. Mirrors `pixme.square.feet-top-ratio` on the server.
 */
const FEET_TOP = 0.38;

/** Prop codes PlazaGround doesn't already draw as part of the scene itself. */
const SKY_AND_SEASONAL = new Set([
  'CLOUD',
  'MOON',
  'SUN',
  'FLOWER',
  'SNOWMAN',
  'PUDDLE',
]);

/**
 * The 2D square.
 *
 * Deliberately *not* a game: there is no persisted avatar position, no
 * realtime sync and no physics. Placement stays server-owned and stable for
 * the day — everyone sees the same arrangement, and a refresh never shuffles
 * the crowd.
 *
 * <p>The one exception is cosmetic: tapping open ground walks *your own*
 * character over to it, locally. Nothing is sent to the server, nobody else
 * sees it, and it resets on reload. It exists because a plaza where nothing
 * can move reads as a screenshot rather than a place.
 */
export function SquareCanvas({
  data,
  onSelectOccupant,
  header,
  refreshControl,
  myUserId,
}: SquareCanvasProps) {
  const { colors } = useTheme();

  const { width: canvasWidth, height: canvasHeight } = layout.squareCanvas;

  /** Measured on screen, so a tap in px can be mapped back to canvas units. */
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  /** Local-only walk target for the viewer's own character. */
  const [myPosition, setMyPosition] = useState<{ x: number; y: number } | null>(null);

  /**
   * Back rows render smaller and slightly faded. Sorting by `y` means the
   * painter's order matches depth, so a front-row character correctly overlaps
   * someone standing behind them.
   */
  const occupants = useMemo(() => {
    const placed = data.occupants.map((occupant) =>
      occupant.userId === myUserId && myPosition
        ? { ...occupant, x: myPosition.x, y: myPosition.y }
        : occupant,
    );
    return placed.sort((a, b) => a.y - b.y);
  }, [data.occupants, myPosition, myUserId]);

  const scale = useCallback((depth: number) => 1 - Math.min(depth, 4) * 0.08, []);

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  const onGroundPress = useCallback(
    (event: GestureResponderEvent) => {
      if (!myUserId || !canvasSize) return;

      const { locationX, locationY } = event.nativeEvent;
      const x = (locationX / canvasSize.width) * canvasWidth;
      const y = (locationY / canvasSize.height) * canvasHeight;

      // Only the walkable ground, and never so close to the edge that the
      // nameplate would be clipped.
      if (y < canvasHeight * HORIZON) return;
      const margin = canvasWidth * 0.08;
      setMyPosition({
        x: Math.min(Math.max(x, margin), canvasWidth - margin),
        y: Math.min(Math.max(y, canvasHeight * FEET_TOP), canvasHeight * 0.96),
      });
    },
    [canvasHeight, canvasSize, canvasWidth, myUserId],
  );

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={refreshControl}
    >
      {header}

      <View
        onLayout={onCanvasLayout}
        style={[
          styles.canvas,
          {
            aspectRatio: canvasWidth / canvasHeight,
            borderColor: colors.border,
          },
        ]}
      >
        <PlazaGround
          sky={data.scene.palette.sky}
          ground={data.scene.palette.ground}
          accent={data.scene.palette.accent}
          horizon={HORIZON}
        />

        {/*
          Only the sky/entrance dressing — the fountain, benches, lamps and
          treeline that used to come from this list are now part of
          PlazaGround itself, drawn once as a real plaza rather than placed
          piece by piece. A server scene can still add weather (CLOUD, MOON,
          SUN) or a seasonal accent (FLOWER, SNOWMAN, PUDDLE) on top.
        */}
        <SquareProps
          props={data.scene.props.filter((prop) => SKY_AND_SEASONAL.has(prop.code))}
          accent={data.scene.palette.accent}
        />

        {/*
          Taps land here rather than on the canvas itself. `locationX/Y` are
          measured against whichever view actually received the touch, and the
          ground gradient starts at the horizon — so a tap read as if the
          canvas began there, landed above the walkable line, and was thrown
          away. A single flat layer spanning the exact canvas rect makes the
          coordinates mean what the maths below assumes.
        */}
        {myUserId ? (
          <Pressable
            onPress={onGroundPress}
            accessibilityRole="button"
            accessibilityLabel={copy.a11y.squareGround}
            style={styles.groundTapLayer}
          />
        ) : null}

        {occupants.map((occupant) => (
          <Occupant
            key={occupant.userId}
            occupant={occupant}
            scale={scale(occupant.depth)}
            isMe={occupant.userId === myUserId}
            onPress={() => onSelectOccupant(occupant)}
          />
        ))}
      </View>

      <Text variant="micro" tone="tertiary" align="center" style={styles.footer}>
        {copy.square.occupantCount(data.totalCount)}
        {myUserId ? `\n${copy.square.moveHint}` : ''}
      </Text>
    </ScrollView>
  );
}

function Occupant({
  occupant,
  scale,
  isMe,
  onPress,
}: {
  occupant: SquareOccupant;
  scale: number;
  isMe: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { width: canvasWidth, height: canvasHeight } = layout.squareCanvas;

  /**
   * Clamped the same way scene props are (`SquareProps.clampToCanvas`): the
   * canvas is `overflow: 'hidden'` with rounded corners, and an occupant's
   * footprint is wider than its anchor point — the 92pt-wide nameplate hangs
   * below and to both sides. A server coordinate near an edge is legitimate;
   * letting it render half-clipped is not. Only the local tap-to-walk path
   * used to clamp, so everyone placed by the server could still overhang.
   */
  const HALF_WIDTH = 46;
  const FOOT_ROOM = 24;
  const clampedX = Math.min(Math.max(occupant.x, HALF_WIDTH), canvasWidth - HALF_WIDTH);
  // Feet belong on the ground. The floor here used to be FOOT_ROOM, which let
  // any coordinate above the horizon render a character standing in mid-air —
  // the allocator now keeps them below it, but placements already stored from
  // before that fix would otherwise still float.
  const clampedY = Math.min(
    Math.max(occupant.y, canvasHeight * FEET_TOP),
    canvasHeight - FOOT_ROOM,
  );

  const left = (clampedX / canvasWidth) * 100;
  const top = (clampedY / canvasHeight) * 100;

  /**
   * Position is animated rather than set directly so a tap-to-walk reads as
   * the character crossing the square, not teleporting. Everyone else's
   * coordinates never change, so for them this is a no-op.
   */
  const animatedLeft = useSharedValue(left);
  const animatedTop = useSharedValue(top);

  React.useEffect(() => {
    const config = { duration: 900, easing: Easing.inOut(Easing.cubic) };
    animatedLeft.value = withTiming(left, config);
    animatedTop.value = withTiming(top, config);
  }, [animatedLeft, animatedTop, left, top]);

  const positionStyle = useAnimatedStyle(() => ({
    left: `${animatedLeft.value}%`,
    top: `${animatedTop.value}%`,
  }));

  return (
    <Animated.View style={[styles.occupant, positionStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.a11y.userPixelOpen(occupant.nickname)}
        onPress={onPress}
        style={{
          alignItems: 'center',
          transform: [{ scale }],
          opacity: 1 - Math.min(occupant.depth, 4) * 0.06,
        }}
      >
        <PixelCharacter
          uri={occupant.characterImageUrl}
          size={72}
          idle
          idleVariant={occupant.idleVariant}
          accessibilityLabel={copy.a11y.userPixel(occupant.nickname)}
        />

        {/* Contact shadow. Without it every character looks pasted on top of
            the scene rather than standing in it. */}
        <View style={styles.shadow} pointerEvents="none" />

        <View
          style={[
            styles.nameplate,
            {
              backgroundColor: isMe ? colors.accent : colors.surface,
              borderColor: isMe ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            variant="micro"
            numberOfLines={1}
            style={[styles.nameplateText, isMe ? { color: colors.textOnAccent } : null]}
          >
            {occupant.nickname}
            {occupant.mood ? ` ${moodEmoji(occupant.mood)}` : ''}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  canvas: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  // Above the scene furniture (max zIndex 5), below the occupants (10), so a
  // character is still tappable while bare ground is too.
  groundTapLayer: { ...StyleSheet.absoluteFill, zIndex: 6 },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.18,
  },
  occupant: {
    position: 'absolute',
    alignItems: 'center',
    // Anchor by the character's feet so a shifted coordinate reads as "moved
    // along the ground" rather than "floating".
    marginLeft: -36,
    marginTop: -72,
    // Always above scene furniture (props top out at zIndex 5): a person is
    // never allowed to render fully hidden behind a tree or sign, even if
    // their allocated coordinate happens to land near one.
    zIndex: 10,
  },
  shadow: {
    position: 'absolute',
    bottom: 16,
    width: 40,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#000000',
    opacity: 0.13,
  },
  nameplate: {
    marginTop: -spacing.xs,
    maxWidth: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nameplateText: { textAlign: 'center' },
  footer: { marginTop: spacing.base },
});
