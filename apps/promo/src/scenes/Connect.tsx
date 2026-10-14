import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { CUE, SCENE, local as toLocal } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Headline, HeartBurst, Phone, Pop, Rise, Tap, Tint, Words, useScale } from '../lib/ui';

/** 말풍선 — 실제 대화 기능을 브랜드 톤으로 표현. */
const Bubble: React.FC<{
  at: number;
  mine?: boolean;
  children: React.ReactNode;
  s: number;
}> = ({ at, mine, children, s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: frame - at, fps, config: { damping: 12, mass: 0.8 } });
  if (frame < at) return null;
  return (
    <div
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        background: mine ? color.accent : color.white,
        color: mine ? color.white : color.ink,
        fontFamily: font.semi,
        fontSize: 40 * s,
        padding: `${22 * s}px ${34 * s}px`,
        borderRadius: 32 * s,
        borderBottomRightRadius: mine ? 8 * s : 32 * s,
        borderBottomLeftRadius: mine ? 32 * s : 8 * s,
        boxShadow: '0 10px 30px rgba(26,24,22,0.12)',
        transform: `scale(${0.7 + k * 0.3}) translateY(${(1 - k) * 30}px)`,
        opacity: Math.min(1, k * 1.6),
        maxWidth: '82%',
      }}
    >
      {children}
    </div>
  );
};

/**
 * 반응·연결 (19.3–26.6s): 실제 피드 카드 위에서 ♥가 터지고, 👋 서로 인사하면
 * 대화가 열린다 — 앱의 소셜 규칙(일방향 👋는 비공개, 상호면 연결) 그대로.
 */
export const Connect: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const local = frame;
  const L = (abs: number) => toLocal(abs, SCENE.connect);

  const phoneIn = spring({ frame: local - 8, fps, config: { damping: 13 } });
  const phoneW = vertical ? 600 * s : 440 * s;

  // 후반: 폰이 살짝 옆으로 가고 대화 버블 등장
  const shift = spring({ frame: frame - (L(CUE.connectedPop) - 4), fps, config: { damping: 15 } });

  return (
    <AbsoluteFill>
      <Tint color={color.heart} opacity={0.05} />
      <AbsoluteFill
        style={{
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 48 * s : 120 * s,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: vertical ? 'center' : 'flex-start',
            gap: 22 * s,
            maxWidth: vertical ? '92%' : 980 * s,
          }}
        >
          <Words
            text="마음은 ♥ 로 가볍게,"
            at={8}
            size={(vertical ? 72 : 88) * s}
            align={vertical ? 'center' : 'left'}
          />
          <Words
            text="서로 👋 하면 대화가 열려요."
            at={L(CUE.wave) - 6}
            size={(vertical ? 72 : 88) * s}
            color={color.accent}
            align={vertical ? 'center' : 'left'}
          />

          {/* 연결 후 대화 미리보기 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20 * s,
              width: vertical ? 760 * s : 640 * s,
              marginTop: 24 * s,
              opacity: shift,
            }}
          >
            <Pop at={L(CUE.connectedPop)}>
              <div
                style={{
                  alignSelf: 'center',
                  background: color.accentSoft,
                  color: color.accentDeep,
                  fontFamily: font.bold,
                  fontSize: 34 * s,
                  padding: `${14 * s}px ${30 * s}px`,
                  borderRadius: 999,
                  textAlign: 'center',
                }}
              >
                ✨ 둘이 연결됐어요
              </div>
            </Pop>
            <Bubble at={L(CUE.message1)} s={s}>
              오늘 픽셀 너무 귀여워요 😄
            </Bubble>
            <Bubble at={L(CUE.message2)} mine s={s}>
              퇴근하고 바로 만들었어요 👋
            </Bubble>
          </div>
        </div>

        {/* 실제 피드 카드 + 하트 버스트 */}
        <div
          style={{
            position: 'relative',
            transform: `translateY(${(1 - phoneIn) * 130}px)`,
            opacity: phoneIn,
          }}
        >
          <Phone src="ui/today.png" width={phoneW} tilt={vertical ? 0 : 7}>
            <Tap at={L(CUE.heart)} x={0.26} y={0.845} size={phoneW * 0.2} />
            <Tap at={L(CUE.wave)} x={0.5} y={0.845} size={phoneW * 0.2} />
          </Phone>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <HeartBurst at={L(CUE.heart)} size={60 * s} spread={340 * s} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
