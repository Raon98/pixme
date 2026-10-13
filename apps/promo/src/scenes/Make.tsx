import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { CUE, SCENE } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Backdrop, Headline, Phone, Pop, Rise, Tap, useScale } from '../lib/ui';

/**
 * 만들기 (5–13.3s): 실제 앱 화면 4장이 하나의 플로우로 이어진다.
 * 사진 선택 → 미리보기(탭) → 생성 중 → 완성. 탭 리플과 사운드가 실제 조작처럼
 * 맞물린다. UI는 캡처 원본 그대로, 변형 없음.
 */
export const Make: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const local = frame - SCENE.make.from;

  // 화면 전환 스케줄 (로컬 프레임)
  const STEP = [
    { src: 'ui/create.png', from: 0 },
    { src: 'ui/preview.png', from: 62 },
    { src: 'ui/generating.png', from: 115 },
    { src: 'ui/result.png', from: 172 },
  ];
  const current = STEP.filter((x) => local >= x.from).length - 1;
  const step = STEP[Math.max(0, current)];
  const sincePrev = local - step.from;
  const slide = spring({ frame: sincePrev, fps, config: { damping: 16, mass: 0.9 } });

  const phoneW = vertical ? 620 * s : 460 * s;
  const phoneIn = spring({ frame: local, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill>
      <Backdrop tint={color.accent} />
      <AbsoluteFill
        style={{
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 56 * s : 130 * s,
          paddingTop: vertical ? 40 * s : 0,
        }}
      >
        {/* 카피 블록 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: vertical ? 'center' : 'flex-start',
            gap: 24 * s,
            order: vertical ? 0 : 1,
          }}
        >
          <Rise at={SCENE.make.from + 8}>
            <Headline
              size={(vertical ? 76 : 92) * s}
              weight={font.black}
              style={{ textAlign: vertical ? 'center' : 'left' }}
            >
              찍고, 고르고, 끝.
            </Headline>
          </Rise>
          <Rise at={SCENE.make.from + 22}>
            <Headline
              size={(vertical ? 42 : 48) * s}
              weight={font.medium}
              color={color.inkSoft}
              style={{ textAlign: vertical ? 'center' : 'left' }}
            >
              헤어도, 오늘 입은 옷도{'\n'}사진 그대로 픽셀이 돼요.
            </Headline>
          </Rise>
          {/* 완성 뱃지 */}
          <Pop at={CUE.resultSuccess + 4}>
            <div
              style={{
                background: color.accent,
                color: color.white,
                fontFamily: font.bold,
                fontSize: 40 * s,
                padding: `${18 * s}px ${40 * s}px`,
                borderRadius: 999,
                boxShadow: '0 16px 40px rgba(124,108,240,0.35)',
              }}
            >
              ✓ 오늘의 PIXME 완성
            </div>
          </Pop>
        </div>

        {/* 실제 앱 화면 */}
        <div
          style={{
            transform: `translateY(${(1 - phoneIn) * 120}px) scale(${0.92 + phoneIn * 0.08})`,
            opacity: phoneIn,
          }}
        >
          <Phone
            src={step.src}
            width={phoneW}
            screenStyle={{
              transform: `translateX(${(1 - slide) * (current > 0 ? 36 : 0)}px)`,
              opacity: current > 0 ? Math.min(1, slide * 1.8) : 1,
            }}
          >
            {/* 미리보기에서 "이 사진으로 만들기" 탭 */}
            <Tap at={CUE.tapPreview - SCENE.make.from + 46} x={0.5} y={0.86} size={phoneW * 0.22} />
            {/* 생성 직전 탭 */}
            <Tap at={CUE.tapGenerate - SCENE.make.from + 52} x={0.5} y={0.86} size={phoneW * 0.22} />
            {/* 생성 중 은은한 펄스 */}
            {current === 2 ? (
              <AbsoluteFill
                style={{
                  background: color.accent,
                  opacity: 0.06 + 0.05 * Math.sin(local / 4),
                }}
              />
            ) : null}
          </Phone>
        </div>
      </AbsoluteFill>
      {/* 장면 진입 와이프 */}
      <AbsoluteFill
        style={{
          background: color.accentSoft,
          transform: `translateX(${interpolate(local, [0, 16], [0, 110], {
            extrapolateRight: 'clamp',
          })}%)`,
        }}
      />
    </AbsoluteFill>
  );
};
