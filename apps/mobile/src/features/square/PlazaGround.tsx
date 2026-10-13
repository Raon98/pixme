import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
} from 'react-native-svg';

import { layout } from '@/theme';

export interface PlazaGroundProps {
  sky: string;
  /** Paving colour. The old flat "ground" field — reused, now painted, not filled. */
  ground: string;
  accent: string;
  /** Fraction of canvas height where paving starts. */
  horizon: number;
}

/* Scene materials — warm, muted, far below the characters in saturation. */
const SEAM = '#78685B';
const RIM = '#BDB2A2';
const RIM_DARK = '#A39785';
const WATER = '#93A8BD';
const WATER_LIGHT = '#A3B7C9';
const JET = '#D0E0EC';
const WOOD = '#A28C74';
const WOOD_DARK = '#88745E';
const POLE = '#968C7E';
const LAMP_BULB = '#F8C482';
const FOLIAGE = '#8A9A7B';
const FOLIAGE_LIGHT = '#96A685';
const PETAL = '#DE9C88';

/**
 * The plaza: a fountain on a round paved apron, benches beside it, lamps and
 * potted trees at the entrance, a treeline and drifting clouds behind.
 *
 * <p>Replaces a flat two-tone gradient. 오늘의 광장 is meant to be a place with
 * its own geography — somewhere people "go" and recognise — and a plain
 * sky/ground split read as an abstract backdrop rather than anywhere.
 *
 * <p>Floor texture is a faint diamond tile grid plus concentric apron rings
 * around the fountain. An earlier pass drew radial seams fanning out of the
 * fountain across the whole canvas; at full length they read as scratches
 * through the scene, which is exactly the kind of noise a quiet backdrop
 * cannot afford.
 *
 * <p>Drawn in SVG (already a dependency) rather than baked images so it
 * recolours per scene (dawn/night/rain/...) from the same palette the server
 * sends, instead of needing an asset per variant.
 */
export function PlazaGround({ sky, ground, accent, horizon }: PlazaGroundProps) {
  const { width: w, height: h } = layout.squareCanvas;
  const gy = h * horizon;
  const fx = w * 0.5;
  const fy = gy + (h - gy) * 0.42;

  const clouds = [
    { x: w * 0.18, y: h * 0.055, s: 58 },
    { x: w * 0.66, y: h * 0.03, s: 46 },
    { x: w * 0.84, y: h * 0.12, s: 36 },
    { x: w * 0.39, y: h * 0.13, s: 30 },
  ];

  const treeline = Array.from({ length: 11 }, (_, i) => ({
    x: (w / 10) * i + ((i % 3) - 1) * 14,
    r: 22 + ((i * 37) % 16),
    y: gy - ((i * 13) % 10),
  }));

  /** Diamond paving: diagonal seams in both directions, clipped to the floor. */
  const tiles = Array.from({ length: 21 }, (_, i) => (i - 10) * 110);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[sky, mix(sky, ground)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { height: gy }]}
      />

      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <ClipPath id="plaza-floor">
            <Rect x={0} y={gy} width={w} height={h - gy} />
          </ClipPath>
        </Defs>

        {clouds.map((c, i) => (
          <React.Fragment key={i}>
            <Ellipse cx={c.x} cy={c.y + c.s * 0.3} rx={c.s} ry={c.s * 0.4} fill="#FFFFFF" fillOpacity={0.45} />
            <Ellipse cx={c.x - c.s * 0.1} cy={c.y + c.s * 0.1} rx={c.s * 0.5} ry={c.s * 0.5} fill="#FFFFFF" fillOpacity={0.45} />
            <Ellipse cx={c.x + c.s * 0.45} cy={c.y + c.s * 0.22} rx={c.s * 0.35} ry={c.s * 0.35} fill="#FFFFFF" fillOpacity={0.45} />
          </React.Fragment>
        ))}

        {treeline.map((t, i) => (
          <Circle key={i} cx={t.x} cy={t.y} r={t.r} fill={mix(ground, FOLIAGE)} opacity={0.55} />
        ))}


        {/* floor */}
        <Rect x={0} y={gy} width={w} height={h - gy} fill={ground} />
        <G clipPath="url(#plaza-floor)">
          {tiles.map((x0) => (
            <React.Fragment key={x0}>
              <Line x1={x0} y1={gy} x2={x0 + (h - gy) * 1.3} y2={h} stroke={SEAM} strokeOpacity={0.055} strokeWidth={1.1} />
              <Line x1={x0} y1={gy} x2={x0 - (h - gy) * 1.3} y2={h} stroke={SEAM} strokeOpacity={0.055} strokeWidth={1.1} />
            </React.Fragment>
          ))}

          {/* paved apron around the fountain */}
          <Ellipse cx={fx} cy={fy} rx={240} ry={150} fill={mix(ground, RIM)} fillOpacity={0.62} />
          <Ellipse cx={fx} cy={fy} rx={190} ry={118} fill={mix(ground, '#FFFFFF')} fillOpacity={0.66} />
          <Ellipse cx={fx} cy={fy} rx={120} ry={74} fill={mix(ground, RIM_DARK)} fillOpacity={0.58} />
          <Ellipse cx={fx} cy={fy} rx={240} ry={150} stroke={SEAM} strokeOpacity={0.16} strokeWidth={1.3} fill="none" />
          <Ellipse cx={fx} cy={fy} rx={120} ry={74} stroke={SEAM} strokeOpacity={0.14} strokeWidth={1.3} fill="none" />
        </G>

        {/* mid-ground trees framing the plaza — trunks, two-tone canopies */}
        {SIDE_TREES.map((tree, i) => {
          const cx = w * tree.fxr;
          const base = gy + (h - gy) * tree.depth;
          const s = tree.size;
          return (
            <React.Fragment key={i}>
              <Ellipse cx={cx} cy={base + 2} rx={s * 0.34} ry={s * 0.08} fill="#000000" fillOpacity={0.06} />
              <Rect x={cx - s * 0.05} y={base - s * 0.42} width={s * 0.1} height={s * 0.42} rx={1.5} fill={WOOD_DARK} />
              <Circle cx={cx} cy={base - s * 0.62} r={s * 0.34} fill={FOLIAGE} />
              <Circle cx={cx - s * 0.16} cy={base - s * 0.72} r={s * 0.2} fill={FOLIAGE_LIGHT} />
              <Circle cx={cx + s * 0.15} cy={base - s * 0.55} r={s * 0.18} fill={mix(FOLIAGE, WOOD_DARK)} opacity={0.5} />
            </React.Fragment>
          );
        })}

        {/* low bushes along the sides */}
        {BUSHES.map((bush, i) => {
          const cx = w * bush.fxr;
          const cy = gy + (h - gy) * bush.depth;
          return (
            <React.Fragment key={i}>
              <Ellipse cx={cx} cy={cy} rx={bush.size} ry={bush.size * 0.55} fill={FOLIAGE} fillOpacity={0.8} />
              <Ellipse cx={cx - bush.size * 0.3} cy={cy - bush.size * 0.2} rx={bush.size * 0.45} ry={bush.size * 0.3} fill={FOLIAGE_LIGHT} fillOpacity={0.8} />
            </React.Fragment>
          );
        })}

        {/* fountain */}
        <Ellipse cx={fx} cy={fy + 23} rx={82} ry={17} fill="#000000" fillOpacity={0.08} />
        <Ellipse cx={fx} cy={fy} rx={78} ry={32} fill={RIM} />
        <Ellipse cx={fx} cy={fy} rx={68} ry={27} fill={RIM_DARK} />
        <Ellipse cx={fx} cy={fy} rx={62} ry={23} fill={WATER} />
        <Path d={topHalf(fx, fy, 62, 23)} fill={WATER_LIGHT} />
        <Rect x={fx - 7} y={fy - 33} width={14} height={31} fill="#B0A492" />
        <Ellipse cx={fx} cy={fy - 35} rx={23} ry={8} fill={RIM} />
        <Ellipse cx={fx} cy={fy - 36} rx={17} ry={5.5} fill={WATER} />
        {[-1, 1].map((sgn) => (
          <Path
            key={sgn}
            d={`M ${fx + sgn * 2} ${fy - 38} q ${sgn * 20} -26 ${sgn * 34} 24`}
            stroke={JET}
            strokeOpacity={0.9}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <Ellipse cx={fx - 19} cy={fy - 10} rx={10} ry={3} fill="#FFFFFF" fillOpacity={0.3} />

        {/* benches flanking the fountain */}
        {[-1, 1].map((side) => {
          const cx = fx + side * 165;
          const cy = fy + 6;
          return (
            <React.Fragment key={side}>
              {[-20, 20].map((lx) => (
                <Rect key={lx} x={cx + lx - 2} y={cy} width={4} height={7} fill={WOOD_DARK} fillOpacity={0.9} />
              ))}
              <Rect x={cx - 27} y={cy - 6} width={54} height={6} rx={2} fill={WOOD} />
              <Rect x={cx - 27} y={cy - 17} width={54} height={4} rx={2} fill={WOOD} fillOpacity={0.92} />
            </React.Fragment>
          );
        })}

        {/* lamps flanking the entrance */}
        {[0.1, 0.9].map((fxr, i) => {
          const cx = w * fxr;
          const base = gy + (i === 0 ? 10 : 6);
          const lampH = 58;
          return (
            <React.Fragment key={fxr}>
              <Line x1={cx} y1={base} x2={cx} y2={base - lampH} stroke={POLE} strokeWidth={2.6} />
              <Line x1={cx - 7} y1={base} x2={cx + 7} y2={base} stroke={POLE} strokeWidth={2.2} />
              <Circle cx={cx} cy={base - lampH} r={12} fill={accent} fillOpacity={0.22} />
              <Circle cx={cx} cy={base - lampH} r={6} fill={LAMP_BULB} />
            </React.Fragment>
          );
        })}

        {/* potted trees at the entrance */}
        {[0.24, 0.76].map((fxr, i) => {
          const cx = w * fxr;
          const base = gy + (i === 0 ? 22 : 18);
          return (
            <React.Fragment key={fxr}>
              <Rect x={cx - 9} y={base - 9} width={18} height={9} rx={1.5} fill={WOOD} />
              <Circle cx={cx} cy={base - 22} r={12} fill={FOLIAGE} />
              <Circle cx={cx - 3} cy={base - 26} r={7} fill={FOLIAGE_LIGHT} />
            </React.Fragment>
          );
        })}

        {/* low planters + flower patches, so the near ground isn't bare */}
        {[0.15, 0.85].map((fxr) => {
          const cx = w * fxr;
          const base = h - 85;
          return (
            <React.Fragment key={fxr}>
              <Rect x={cx - 10} y={base - 10} width={20} height={10} rx={1.5} fill={WOOD} fillOpacity={0.9} />
              <Circle cx={cx} cy={base - 24} r={14} fill={FOLIAGE} fillOpacity={0.92} />
            </React.Fragment>
          );
        })}
        {[
          { fxr: 0.32, y: h - 50 },
          { fxr: 0.68, y: h - 44 },
        ].map(({ fxr, y }) => {
          const cx = w * fxr;
          return (
            <React.Fragment key={fxr}>
              {[-1, 0, 1].map((k) => (
                <React.Fragment key={k}>
                  <Line x1={cx + k * 9} y1={y + 3} x2={cx + k * 9} y2={y + 9} stroke={FOLIAGE} strokeOpacity={0.85} strokeWidth={1.2} />
                  <Circle cx={cx + k * 9} cy={y} r={3} fill={PETAL} fillOpacity={0.8} />
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * Trees and bushes framing the plaza, kept to the side thirds so the centre
 * stays clear for people. `depth` is a fraction of the floor's height.
 */
const SIDE_TREES = [
  { fxr: 0.07, depth: 0.3, size: 110 },
  { fxr: 0.93, depth: 0.34, size: 120 },
  { fxr: 0.1, depth: 0.78, size: 130 },
  { fxr: 0.9, depth: 0.84, size: 125 },
];

const BUSHES = [
  { fxr: 0.2, depth: 0.52, size: 26 },
  { fxr: 0.82, depth: 0.58, size: 24 },
  { fxr: 0.3, depth: 0.92, size: 28 },
  { fxr: 0.72, depth: 0.95, size: 25 },
];

/** Upper half of an ellipse — the light band on the water. */
function topHalf(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} L ${cx + rx} ${cy - 2} A ${rx} ${ry} 0 0 0 ${cx - rx} ${cy - 2} Z`;
}

/** Midpoint of two hex colours. */
function mix(a: string, b: string): string {
  const parse = (value: string): [number, number, number] => {
    const hex = value.replace('#', '');
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  };
  try {
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    const channel = (x: number, y: number) =>
      Math.round((x + y) / 2)
        .toString(16)
        .padStart(2, '0');
    return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
  } catch {
    return b;
  }
}
