import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { SquareProp } from '@/api';
import { layout, radius } from '@/theme';

/**
 * Scene furniture — benches, lamps, trees, a fountain, a tiny café.
 *
 * <p>Drawn as flat shapes rather than emoji. Emoji carry Apple's own glossy
 * 3D styling and a saturation far above anything else in the product, so a
 * plaza dressed in them read as a sticker sheet with a pixel character pasted
 * on top. The art direction is the opposite: the character is the only
 * saturated thing on screen and the scene recedes behind it.
 *
 * <p>Three muted materials rather than one grey. An earlier pass tinted every
 * prop with the text colour and the plaza became a field of identical blobs —
 * present, but unreadable as a tree or a bench. Material colour costs nothing
 * and does the recognising for the viewer.
 */
const FOLIAGE = '#8A9A7B';
const WOOD = '#A28C74';
const STONE = '#B0A698';
const CLOUD_TONE = '#D6D0C4';

export interface SquarePropsProps {
  props: SquareProp[];
  /** Lamps, the moon and water catch the scene's own accent. */
  accent: string;
}

/**
 * Keeps a prop's own footprint inside the canvas — the container is
 * `overflow: hidden` with rounded corners, and the server's placement
 * allocator only reasons about anchor points, not rendered width.
 */
function clampToCanvas(value: number, extent: number, scale: number): number {
  const halfFootprint = (34 * scale) / 2 + 6;
  return Math.min(Math.max(value, halfFootprint), extent - halfFootprint);
}

export function SquareProps({ props, accent }: SquarePropsProps) {
  const { width, height } = layout.squareCanvas;

  return (
    <>
      {props.map((prop, index) => {
        const shape = SHAPES[prop.code];
        if (!shape) return null;
        const size = 34 * prop.scale;
        const x = clampToCanvas(prop.x, width, prop.scale);
        const y = clampToCanvas(prop.y, height, prop.scale);

        return (
          <View
            key={`${prop.code}-${index}`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              styles.prop,
              {
                left: `${(x / width) * 100}%`,
                top: `${(y / height) * 100}%`,
                width: size,
                height: size,
                marginLeft: -size / 2,
                // Anchored by its base, so a prop stands *on* the ground the
                // same way a character does.
                marginTop: -size,
                zIndex: prop.zIndex,
              },
            ]}
          >
            {shape({ size, accent })}
          </View>
        );
      })}
    </>
  );
}

interface ShapeArgs {
  size: number;
  accent: string;
}

type Shape = (args: ShapeArgs) => React.ReactNode;

/** One flat part of a prop. */
function part(color: string, opacity: number, style: object): React.ReactNode {
  return (
    <View
      style={[{ position: 'absolute', backgroundColor: color, opacity }, style]}
    />
  );
}

const SHAPES: Record<string, Shape> = {
  TREE: ({ size: s }) => (
    <>
      {part(WOOD, 0.85, {
        bottom: 0,
        left: s * 0.42,
        width: s * 0.16,
        height: s * 0.42,
        borderRadius: 2,
      })}
      {part(FOLIAGE, 0.85, {
        bottom: s * 0.3,
        left: s * 0.08,
        width: s * 0.84,
        height: s * 0.76,
        borderRadius: s * 0.42,
      })}
      {part(FOLIAGE, 0.7, {
        bottom: s * 0.7,
        left: s * 0.2,
        width: s * 0.5,
        height: s * 0.5,
        borderRadius: s * 0.25,
      })}
    </>
  ),

  PLANT: ({ size: s }) => (
    <>
      {part(WOOD, 0.8, {
        bottom: 0,
        left: s * 0.28,
        width: s * 0.44,
        height: s * 0.32,
        borderRadius: s * 0.06,
      })}
      {part(FOLIAGE, 0.8, {
        bottom: s * 0.28,
        left: s * 0.2,
        width: s * 0.3,
        height: s * 0.38,
        borderRadius: s * 0.16,
      })}
      {part(FOLIAGE, 0.8, {
        bottom: s * 0.3,
        left: s * 0.5,
        width: s * 0.3,
        height: s * 0.42,
        borderRadius: s * 0.16,
      })}
    </>
  ),

  BENCH: ({ size: s }) => (
    <>
      {part(WOOD, 0.6, {
        bottom: 0,
        left: s * 0.14,
        width: s * 0.1,
        height: s * 0.3,
      })}
      {part(WOOD, 0.6, {
        bottom: 0,
        right: s * 0.14,
        width: s * 0.1,
        height: s * 0.3,
      })}
      {part(WOOD, 0.9, {
        bottom: s * 0.28,
        left: s * 0.04,
        right: s * 0.04,
        height: s * 0.14,
        borderRadius: 2,
      })}
      {part(WOOD, 0.75, {
        bottom: s * 0.5,
        left: s * 0.04,
        right: s * 0.04,
        height: s * 0.12,
        borderRadius: 2,
      })}
    </>
  ),

  STREET_LAMP: ({ size: s, accent }) => (
    <>
      {part(STONE, 0.9, {
        bottom: 0,
        left: s * 0.45,
        width: s * 0.1,
        height: s * 0.78,
      })}
      {part(accent, 0.16, {
        bottom: s * 0.62,
        left: s * 0.2,
        width: s * 0.6,
        height: s * 0.6,
        borderRadius: s * 0.3,
      })}
      {part(accent, 0.8, {
        bottom: s * 0.74,
        left: s * 0.35,
        width: s * 0.3,
        height: s * 0.3,
        borderRadius: s * 0.15,
      })}
    </>
  ),

  LANTERN: ({ size: s, accent }) => (
    <>
      {part(STONE, 0.5, {
        bottom: s * 0.64,
        left: s * 0.47,
        width: s * 0.06,
        height: s * 0.36,
      })}
      {part(accent, 0.18, {
        bottom: s * 0.14,
        left: s * 0.14,
        width: s * 0.72,
        height: s * 0.62,
        borderRadius: s * 0.31,
      })}
      {part(accent, 0.66, {
        bottom: s * 0.24,
        left: s * 0.28,
        width: s * 0.44,
        height: s * 0.44,
        borderRadius: s * 0.22,
      })}
    </>
  ),

  CAFE: ({ size: s, accent }) => (
    <>
      {part(STONE, 0.85, {
        bottom: 0,
        left: s * 0.1,
        right: s * 0.1,
        height: s * 0.62,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
      })}
      {part(accent, 0.32, {
        bottom: s * 0.58,
        left: s * 0.02,
        right: s * 0.02,
        height: s * 0.14,
        borderRadius: 2,
      })}
      {part(WOOD, 0.55, {
        bottom: s * 0.12,
        left: s * 0.26,
        width: s * 0.22,
        height: s * 0.24,
        borderRadius: 1,
      })}
    </>
  ),

  FOUNTAIN: ({ size: s, accent }) => (
    <>
      {part(STONE, 0.9, {
        bottom: 0,
        left: s * 0.02,
        right: s * 0.02,
        height: s * 0.28,
        borderRadius: s * 0.14,
      })}
      {part(STONE, 0.8, {
        bottom: s * 0.24,
        left: s * 0.41,
        width: s * 0.18,
        height: s * 0.32,
      })}
      {part(accent, 0.35, {
        bottom: s * 0.5,
        left: s * 0.22,
        width: s * 0.56,
        height: s * 0.2,
        borderRadius: s * 0.1,
      })}
    </>
  ),

  BUS_STOP: ({ size: s, accent }) => (
    <>
      {part(STONE, 0.9, {
        bottom: 0,
        left: s * 0.46,
        width: s * 0.08,
        height: s * 0.8,
      })}
      {part(accent, 0.36, {
        bottom: s * 0.62,
        left: s * 0.28,
        width: s * 0.58,
        height: s * 0.3,
        borderRadius: 3,
      })}
    </>
  ),

  SIGN: ({ size: s }) => (
    <>
      {part(WOOD, 0.7, {
        bottom: 0,
        left: s * 0.46,
        width: s * 0.08,
        height: s * 0.5,
      })}
      {part(WOOD, 0.9, {
        bottom: s * 0.44,
        left: s * 0.16,
        width: s * 0.68,
        height: s * 0.42,
        borderRadius: 3,
      })}
    </>
  ),

  FLOWER: ({ size: s, accent }) => (
    <>
      {part(FOLIAGE, 0.8, {
        bottom: 0,
        left: s * 0.47,
        width: s * 0.06,
        height: s * 0.5,
      })}
      {part(accent, 0.45, {
        bottom: s * 0.44,
        left: s * 0.28,
        width: s * 0.44,
        height: s * 0.44,
        borderRadius: s * 0.22,
      })}
    </>
  ),

  PUDDLE: ({ size: s, accent }) =>
    part(accent, 0.18, {
      bottom: 0,
      left: 0,
      right: 0,
      height: s * 0.22,
      borderRadius: s * 0.11,
    }),

  SNOWMAN: ({ size: s }) => (
    <>
      {part(CLOUD_TONE, 0.9, {
        bottom: 0,
        left: s * 0.18,
        width: s * 0.64,
        height: s * 0.64,
        borderRadius: s * 0.32,
      })}
      {part(CLOUD_TONE, 1, {
        bottom: s * 0.54,
        left: s * 0.3,
        width: s * 0.4,
        height: s * 0.4,
        borderRadius: s * 0.2,
      })}
    </>
  ),

  /* ------------------------------------------------------------- sky */

  CLOUD: ({ size: s }) => (
    <>
      {part(CLOUD_TONE, 0.75, {
        top: s * 0.34,
        left: 0,
        right: 0,
        height: s * 0.3,
        borderRadius: s * 0.15,
      })}
      {part(CLOUD_TONE, 0.75, {
        top: s * 0.14,
        left: s * 0.2,
        width: s * 0.42,
        height: s * 0.42,
        borderRadius: s * 0.21,
      })}
      {part(CLOUD_TONE, 0.75, {
        top: s * 0.24,
        left: s * 0.54,
        width: s * 0.32,
        height: s * 0.32,
        borderRadius: s * 0.16,
      })}
    </>
  ),

  SUN: ({ size: s, accent }) => (
    <>
      {part(accent, 0.13, {
        top: 0,
        left: 0,
        width: s,
        height: s,
        borderRadius: s / 2,
      })}
      {part(accent, 0.42, {
        top: s * 0.18,
        left: s * 0.18,
        width: s * 0.64,
        height: s * 0.64,
        borderRadius: s * 0.32,
      })}
    </>
  ),

  MOON: ({ size: s, accent }) => (
    <>
      {part(accent, 0.13, {
        top: 0,
        left: 0,
        width: s,
        height: s,
        borderRadius: s / 2,
      })}
      {part(accent, 0.5, {
        top: s * 0.16,
        left: s * 0.16,
        width: s * 0.68,
        height: s * 0.68,
        borderRadius: s * 0.34,
      })}
    </>
  ),
};

const styles = StyleSheet.create({
  prop: { position: 'absolute', borderRadius: radius.pixel },
});
