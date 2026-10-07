import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { SquareOccupant, SquareResponse } from '@/api';
import { moodEmoji } from '@/constants/moods';
import { layout, radius, spacing, useTheme } from '@/theme';
import { PixelCharacter, Text } from '@/ui';

import { SquareProps } from './SquareProps';

export interface SquareCanvasProps {
  data: SquareResponse;
  onSelectOccupant: (occupant: SquareOccupant) => void;
  /** Rendered above the canvas (curation rails). */
  header?: React.ReactNode;
  /** Pull-to-refresh control, owned by the screen. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/**
 * The 2D square.
 *
 * Deliberately *not* a game: there is no avatar the user drives, no realtime
 * position sync and no physics. It is a laid-out list — characters at
 * server-assigned coordinates with a gentle idle bob — which is why plain
 * absolutely-positioned views beat a canvas/game loop here: far cheaper, and
 * each character stays a real accessible, pressable element.
 */
export function SquareCanvas({
  data,
  onSelectOccupant,
  header,
  refreshControl,
}: SquareCanvasProps) {
  const { colors } = useTheme();

  const { width: canvasWidth, height: canvasHeight } = layout.squareCanvas;

  /**
   * Back rows render smaller and slightly faded. Sorting by `y` means the
   * painter's order matches depth, so a front-row character correctly overlaps
   * someone standing behind them.
   */
  const occupants = useMemo(
    () => [...data.occupants].sort((a, b) => a.y - b.y),
    [data.occupants],
  );

  const scale = useCallback(
    (depth: number) => 1 - Math.min(depth, 4) * 0.08,
    [],
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
        style={[
          styles.canvas,
          {
            aspectRatio: canvasWidth / canvasHeight,
            borderColor: colors.border,
          },
        ]}
      >
        <LinearGradient
          colors={[data.scene.palette.sky, data.scene.palette.ground]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SquareProps props={data.scene.props} accent={data.scene.palette.accent} />

        {occupants.map((occupant) => (
          <Occupant
            key={occupant.postId}
            occupant={occupant}
            scale={scale(occupant.depth)}
            onPress={() => onSelectOccupant(occupant)}
          />
        ))}
      </View>

      <Text variant="micro" tone="tertiary" align="center" style={styles.footer}>
        오늘 {data.totalCount}명이 광장에 나와 있어요.
      </Text>
    </ScrollView>
  );
}

function Occupant({
  occupant,
  scale,
  onPress,
}: {
  occupant: SquareOccupant;
  scale: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { width: canvasWidth, height: canvasHeight } = layout.squareCanvas;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${occupant.nickname}의 PIXME 보기`}
      onPress={onPress}
      style={[
        styles.occupant,
        {
          left: `${(occupant.x / canvasWidth) * 100}%`,
          top: `${(occupant.y / canvasHeight) * 100}%`,
          transform: [{ scale }],
          opacity: 1 - Math.min(occupant.depth, 4) * 0.06,
        },
      ]}
    >
      <PixelCharacter
        uri={occupant.characterImageUrl}
        size={72}
        idle
        idleVariant={occupant.idleVariant}
        accessibilityLabel={`${occupant.nickname}의 PIXME`}
      />
      <View
        style={[
          styles.nameplate,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text variant="micro" numberOfLines={1} style={styles.nameplateText}>
          {occupant.nickname}
          {occupant.mood ? ` ${moodEmoji(occupant.mood)}` : ''}
        </Text>
      </View>
    </Pressable>
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
  occupant: {
    position: 'absolute',
    alignItems: 'center',
    // Anchor by the character's feet so a shifted coordinate reads as "moved
    // along the ground" rather than "floating".
    marginLeft: -36,
    marginTop: -72,
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
