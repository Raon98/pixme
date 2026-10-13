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

import { CUE, SCENE } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Backdrop, Headline, Pop, Rise, useScale } from '../lib/ui';

/** 앱의 실제 7개 스타일 — copy.ko.ts create.styles 그대로. */
const CHIPS = ['기본', 'Y2K 픽셀', '16비트', '레트로 PC', '아케이드', '미니 픽셀', '소프트 픽셀'];

/**
 * 스타일 (26.6–32.6s): 같은 사람, 같은 옷 — 렌더만 달라진다.
 * 실제 생성물 두 장(기본/Y2K)을 스왑하고, 실제 스타일 칩 이름이 아래로 뜬다.
 */
export const Styles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const local = frame - SCENE.styles.from;

  // 캐릭터 스왑: 기본 → Y2K → 기본
  const showY2k = frame >= CUE.styleSwap1 && frame < CUE.styleSwap2;
  const swapK = spring({
    frame: Math.min(frame - CUE.styleSwap1, Math.abs(frame - CUE.styleSwap2)),
    fps,
    config: { damping: 11 },
  });

  const charSize = vertical ? 760 * s : 620 * s;
  const charIn = spring({ frame: local - 8, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill>
      <Backdrop tint={color.accent} />
      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36 * s,
        }}
      >
        <Rise at={SCENE.styles.from + 8}>
          <Headline size={(vertical ? 74 : 84) * s} weight={font.black}>
            취향대로 고르는{'\n'}픽셀 스타일
          </Headline>
        </Rise>

        {/* 실제 생성 결과 스왑 */}
        <div
          style={{
            width: charSize,
            height: charSize,
            position: 'relative',
            transform: `scale(${0.85 + charIn * 0.15}) scale(${0.96 + swapK * 0.04})`,
            opacity: charIn,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 44 * s,
              background: showY2k ? '#121019' : color.white,
              boxShadow: '0 36px 80px rgba(26,24,22,0.2)',
            }}
          />
          <Img
            src={staticFile(showY2k ? 'char/cheol-y2k.png' : 'char/cheol-mock.png')}
            style={{
              position: 'absolute',
              inset: '6%',
              width: '88%',
              height: '88%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
            }}
          />
          {/* 스타일 라벨 */}
          <Pop at={showY2k ? CUE.styleSwap1 : SCENE.styles.from + 14} key={showY2k ? 'y' : 'b'}>
            <div
              style={{
                position: 'absolute',
                top: -26 * s,
                right: -18 * s,
                background: showY2k ? color.accent : color.ink,
                color: color.white,
                fontFamily: font.bold,
                fontSize: 36 * s,
                padding: `${12 * s}px ${28 * s}px`,
                borderRadius: 999,
              }}
            >
              {showY2k ? 'Y2K 픽셀' : '기본'}
            </div>
          </Pop>
        </div>

        {/* 실제 스타일 칩 이름들 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16 * s,
            maxWidth: vertical ? 880 * s : 1300 * s,
          }}
        >
          {CHIPS.map((chip, i) => (
            <Pop at={SCENE.styles.from + 20 + i * 7} key={chip} damping={12}>
              <div
                style={{
                  border: `${3 * s}px solid ${color.ink}22`,
                  background: color.white,
                  color: color.ink,
                  fontFamily: font.semi,
                  fontSize: 34 * s,
                  padding: `${14 * s}px ${30 * s}px`,
                  borderRadius: 999,
                }}
              >
                {chip}
              </div>
            </Pop>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: color.paperDeep,
          transform: `translateY(${interpolate(local, [0, 16], [0, 112], {
            extrapolateRight: 'clamp',
          })}%)`,
        }}
      />
    </AbsoluteFill>
  );
};
