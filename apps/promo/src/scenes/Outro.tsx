import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { CUE, SCENE, local as toLocal } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Headline, Rise, useScale } from '../lib/ui';

const LOGO = 'PIXME';

/**
 * 아웃트로 (32.6–40s): 캐릭터 카드 + 브랜드명 + 공식 슬로건("오늘의 나를
 * 픽셀로." — copy.ko.ts brand.slogan) + 진실한 CTA(첫 생성은 실제로 무료).
 *
 * <p>로고는 글자마다 픽셀 블록이 제자리로 날아와 맞춰지며 완성된다 — 영상
 * 내내 보여준 "사진이 픽셀이 된다"를 마지막에 브랜드로 한 번 더 말한다.
 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const L = (abs: number) => toLocal(abs, SCENE.outro);
  const END = SCENE.outro.to - SCENE.outro.from;

  const iconK = spring({
    frame: frame - L(CUE.iconPop),
    fps,
    config: { damping: 10, mass: 0.9 },
  });
  const fadeOut = interpolate(frame, [END - 18, END - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const iconSize = (vertical ? 300 : 260) * s;
  const logoSize = (vertical ? 140 : 150) * s;
  const logoAt = L(CUE.logoChime) - 10;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40 * s,
        }}
      >
        {/* 실제 생성 캐릭터를 아이콘 카드에 담는다 — 제품의 얼굴.
            현재 앱 아이콘은 텍스트 로고뿐이라 아래 로고타이프와 중복된다. */}
        <div
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize * 0.24,
            overflow: 'hidden',
            background: color.white,
            boxShadow: '0 36px 80px rgba(26,24,22,0.25)',
            transform: `scale(${0.5 + iconK * 0.5}) rotate(${(1 - iconK) * -8}deg)`,
            opacity: Math.min(1, iconK * 1.5),
          }}
        >
          <Img
            src={staticFile('char/cheol-y2k.png')}
            style={{
              width: '86%',
              height: '86%',
              margin: '7%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
            }}
          />
        </div>

        {/* 픽셀이 날아와 맞춰지는 로고타이프 */}
        <div style={{ display: 'flex', gap: logoSize * 0.06 }}>
          {LOGO.split('').map((ch, i) => {
            const k = spring({
              frame: frame - (logoAt + i * 4),
              fps,
              config: { damping: 13, mass: 0.6 },
            });
            const ox = (random(`lx${i}`) - 0.5) * 220 * s;
            const oy = (random(`ly${i}`) - 0.5) * 160 * s;
            return (
              <div
                key={i}
                style={{
                  fontFamily: font.black,
                  fontSize: logoSize,
                  letterSpacing: 2 * s,
                  color: color.ink,
                  transform: `translate(${(1 - k) * ox}px, ${(1 - k) * oy}px) scale(${
                    0.4 + k * 0.6
                  })`,
                  opacity: Math.min(1, k * 1.8),
                }}
              >
                {ch}
              </div>
            );
          })}
        </div>

        <Rise at={L(CUE.logoChime) + 6}>
          <Headline size={(vertical ? 56 : 62) * s} weight={font.semi} color={color.inkSoft}>
            오늘의 나를 픽셀로.
          </Headline>
        </Rise>

        <Rise at={L(CUE.logoChime) + 22}>
          <div
            style={{
              background: color.accent,
              color: color.white,
              fontFamily: font.bold,
              fontSize: 44 * s,
              padding: `${24 * s}px ${56 * s}px`,
              borderRadius: 999,
              boxShadow: '0 20px 48px rgba(124,108,240,0.4)',
              transform: `scale(${1 + Math.sin(frame / 16) * 0.012})`,
            }}
          >
            첫 PIXME는 무료예요 — 지금 만들어보세요
          </div>
        </Rise>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
