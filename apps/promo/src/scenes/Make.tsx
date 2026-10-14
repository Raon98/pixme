import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { CUE, SCENE, local } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Headline, Phone, Pop, Rise, Tap, Tint, Words, useScale } from '../lib/ui';

/** 플로우의 현재 단계를 알려주는 작은 진행 표시. */
const Steps: React.FC<{ current: number; s: number }> = ({ current, s }) => (
  <div style={{ display: 'flex', gap: 12 * s, alignItems: 'center' }}>
    {['사진', '생성', '완성'].map((label, i) => {
      const on = i <= current;
      return (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10 * s,
            fontFamily: font.bold,
            fontSize: 28 * s,
            color: on ? color.accentDeep : color.inkFaint,
          }}
        >
          <div
            style={{
              width: 14 * s,
              height: 14 * s,
              background: on ? color.accent : color.inkFaint,
              opacity: on ? 1 : 0.4,
            }}
          />
          {label}
          {i < 2 ? (
            <div
              style={{
                width: 26 * s,
                height: 3 * s,
                background: color.inkFaint,
                opacity: 0.3,
                marginLeft: 4 * s,
              }}
            />
          ) : null}
        </div>
      );
    })}
  </div>
);

/**
 * 만들기 (5–13.3s): 실제 앱 화면 3장이 하나의 플로우로 이어진다.
 * 미리보기(탭) → 생성 중 → 완성. 탭 리플과 사운드가 실제 조작처럼 맞물린다.
 * UI는 캡처 원본 그대로, 변형 없음.
 *
 * <p>이 파일의 프레임은 전부 씬-로컬이다 — <Sequence> 안의 useCurrentFrame()은
 * 0부터 시작한다. 절대 큐는 timeline의 local()로 변환한다.
 */
export const Make: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const L = (abs: number) => local(abs, SCENE.make);

  const STEP = [
    { src: 'ui/preview.png', from: 0 },
    { src: 'ui/generating.png', from: 108 },
    { src: 'ui/result.png', from: 170 },
  ];
  const current = STEP.filter((x) => frame >= x.from).length - 1;
  const step = STEP[Math.max(0, current)]!;
  const sincePrev = frame - step.from;
  const slide = spring({ frame: sincePrev, fps, config: { damping: 16, mass: 0.9 } });

  const phoneW = vertical ? 620 * s : 460 * s;
  const phoneIn = spring({ frame, fps, config: { damping: 14 } });

  // 단계가 바뀔 때마다 살짝 당겨 찍는 느낌.
  const punch = 1 + (1 - Math.min(1, sincePrev / 14)) * 0.035;
  const tilt = vertical ? 0 : -7 + Math.sin(frame / 50) * 1.4;

  return (
    <AbsoluteFill>
      <Tint color={color.accent} opacity={0.05} />
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
          <Words
            text="찍고, 고르고, 끝."
            at={8}
            size={(vertical ? 76 : 92) * s}
            align={vertical ? 'center' : 'left'}
          />
          <Rise at={24}>
            <Headline
              size={(vertical ? 42 : 48) * s}
              weight={font.medium}
              color={color.inkSoft}
              style={{ textAlign: vertical ? 'center' : 'left' }}
            >
              헤어도, 오늘 입은 옷도{'\n'}사진 그대로 픽셀이 돼요.
            </Headline>
          </Rise>

          <Rise at={40}>
            <Steps current={current} s={s} />
          </Rise>

          <Pop at={L(CUE.resultSuccess) + 6}>
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
            transform: `translateY(${(1 - phoneIn) * 120}px) scale(${
              (0.92 + phoneIn * 0.08) * punch
            })`,
            opacity: phoneIn,
          }}
        >
          <Phone
            src={step.src}
            width={phoneW}
            tilt={tilt}
            glareAt={current === 2 ? step.from + 4 : undefined}
            screenStyle={{
              transform: `translateX(${(1 - slide) * (current > 0 ? 36 : 0)}px)`,
              opacity: current > 0 ? Math.min(1, slide * 1.8) : 1,
            }}
          >
            <Tap at={L(CUE.tapGenerate)} x={0.5} y={0.86} size={phoneW * 0.22} />
            {current === 1 ? (
              <AbsoluteFill
                style={{
                  background: color.accent,
                  opacity: 0.06 + 0.05 * Math.sin(frame / 4),
                }}
              />
            ) : null}
          </Phone>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
