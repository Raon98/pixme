import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { SCENE } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Backdrop, Headline, Phone, Rise, useScale } from '../lib/ui';

/**
 * 광장 (13.3–19.3s): 실제 광장 화면을 천천히 줌 — 오늘의 캐릭터들이 한 공간에
 * 서 있는 장면이 그대로 보인다.
 */
export const Square: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const local = frame - SCENE.square.from;

  const phoneIn = spring({ frame: local - 14, fps, config: { damping: 13 } });
  const zoom = interpolate(local, [20, 170], [1.12, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const phoneW = vertical ? 680 * s : 480 * s;

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill
        style={{
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 54 * s : 140 * s,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: vertical ? 'center' : 'flex-start',
            gap: 22 * s,
          }}
        >
          <Rise at={SCENE.square.from + 10}>
            <Headline
              size={(vertical ? 76 : 92) * s}
              weight={font.black}
              style={{ textAlign: vertical ? 'center' : 'left' }}
            >
              오늘의 캐릭터들이{'\n'}모이는 광장
            </Headline>
          </Rise>
          <Rise at={SCENE.square.from + 26}>
            <Headline
              size={(vertical ? 42 : 48) * s}
              weight={font.medium}
              color={color.inkSoft}
              style={{ textAlign: vertical ? 'center' : 'left' }}
            >
              매일 달라지는 서로의 오늘을{'\n'}가볍게 구경해요.
            </Headline>
          </Rise>
        </div>

        <div
          style={{
            transform: `translateY(${(1 - phoneIn) * 140}px)`,
            opacity: phoneIn,
          }}
        >
          <Phone
            src="ui/square.png"
            width={phoneW}
            screenStyle={{
              transform: `scale(${zoom}) translateY(${interpolate(local, [20, 170], [4, -3], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}%)`,
            }}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: color.paperDeep,
          transform: `translateX(${interpolate(local, [0, 16], [0, -110], {
            extrapolateRight: 'clamp',
          })}%)`,
        }}
      />
    </AbsoluteFill>
  );
};
