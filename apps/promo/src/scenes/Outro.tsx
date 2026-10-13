import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { CUE, SCENE, TOTAL } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Backdrop, Headline, Pop, Rise, useScale } from '../lib/ui';

/**
 * 아웃트로 (32.6–40s): 실제 앱 아이콘 + 브랜드명 + 공식 슬로건("오늘의 나를
 * 픽셀로." — copy.ko.ts brand.slogan) + 진실한 CTA(첫 생성은 실제로 무료).
 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const local = frame - SCENE.outro.from;

  const iconK = spring({ frame: frame - CUE.iconPop, fps, config: { damping: 10, mass: 0.9 } });
  const fadeOut = interpolate(frame, [TOTAL - 18, TOTAL - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const iconSize = (vertical ? 300 : 260) * s;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Backdrop />
      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40 * s,
        }}
      >
        {/* 실제 앱 아이콘 */}
        <div
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize * 0.24,
            overflow: 'hidden',
            boxShadow: '0 36px 80px rgba(26,24,22,0.25)',
            transform: `scale(${0.5 + iconK * 0.5}) rotate(${(1 - iconK) * -8}deg)`,
            opacity: Math.min(1, iconK * 1.5),
          }}
        >
          <Img
            src={staticFile('char/app-icon.png')}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <Pop at={CUE.logoChime - 6} damping={12}>
          <Headline size={(vertical ? 140 : 150) * s} weight={font.black} style={{ letterSpacing: 2 * s }}>
            PIXME
          </Headline>
        </Pop>

        <Rise at={CUE.logoChime + 6}>
          <Headline size={(vertical ? 56 : 62) * s} weight={font.semi} color={color.inkSoft}>
            오늘의 나를 픽셀로.
          </Headline>
        </Rise>

        <Rise at={CUE.logoChime + 22}>
          <div
            style={{
              background: color.accent,
              color: color.white,
              fontFamily: font.bold,
              fontSize: 44 * s,
              padding: `${24 * s}px ${56 * s}px`,
              borderRadius: 999,
              boxShadow: '0 20px 48px rgba(124,108,240,0.4)',
            }}
          >
            첫 PIXME는 무료예요 — 지금 만들어보세요
          </div>
        </Rise>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: color.paper,
          transform: `scale(${interpolate(local, [0, 18], [1, 0], {
            extrapolateRight: 'clamp',
          })})`,
          borderRadius: '50%',
        }}
      />
    </AbsoluteFill>
  );
};
