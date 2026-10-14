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

import { CUE, SCENE, local as toLocal } from '../lib/timeline';
import { color, font } from '../lib/theme';
import { Pop, Tint, Words, useScale } from '../lib/ui';

/** 앱의 실제 7개 스타일 — copy.ko.ts create.styles 그대로. */
const CHIPS = ['기본', 'Y2K 픽셀', '16비트', '레트로 PC', '아케이드', '미니 픽셀', '소프트 픽셀'];

/**
 * 스타일 (26.6–32.6s): 같은 사람, 같은 옷 — 렌더만 달라진다.
 *
 * <p>실제 생성물 두 장(기본/Y2K)을 스캔라인 글리치로 교체한다. 옷과 머리가
 * 그대로라는 게 이 장면의 요점이라, 교체는 순간적으로 하되 포즈가 달라
 * 보이지 않게 같은 프레임 안에서 겹친다.
 */
export const Styles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;
  const L = (abs: number) => toLocal(abs, SCENE.styles);

  const swapA = L(CUE.styleSwap1);
  const swapB = L(CUE.styleSwap2);
  const showY2k = frame >= swapA && frame < swapB;

  const sinceSwap = Math.min(
    Math.abs(frame - swapA),
    Math.abs(frame - swapB),
  );
  /** 교체 직후 몇 프레임만 지직거린다. */
  const glitch = Math.max(0, 1 - sinceSwap / 9);

  const charSize = vertical ? 760 * s : 620 * s;
  const charIn = spring({ frame: frame - 8, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill>
      <Tint color={color.accent} opacity={0.05} />
      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36 * s,
        }}
      >
        <Words
          text={vertical ? '취향대로 고르는\n픽셀 스타일' : '취향대로 고르는 픽셀 스타일'}
          at={8}
          size={(vertical ? 74 : 84) * s}
        />

        <div
          style={{
            width: charSize,
            height: charSize,
            position: 'relative',
            transform: `scale(${0.85 + charIn * 0.15}) translateX(${
              glitch * (frame % 2 === 0 ? -8 : 8) * s
            }px)`,
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
              transition: 'none',
            }}
          />
          <Img
            src={staticFile(showY2k ? 'char/cheol-y2k.png' : 'char/cheol-basic.png')}
            style={{
              position: 'absolute',
              inset: '6%',
              width: '88%',
              height: '88%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
            }}
          />

          {/* 교체 순간의 스캔라인 */}
          {glitch > 0 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 44 * s,
                overflow: 'hidden',
                backgroundImage: `repeating-linear-gradient(0deg, rgba(124,108,240,${
                  0.35 * glitch
                }) 0px, rgba(124,108,240,0) ${6 * s}px, rgba(124,108,240,0) ${12 * s}px)`,
                mixBlendMode: 'screen',
              }}
            />
          ) : null}

          <Pop at={showY2k ? swapA : 14} key={showY2k ? 'y' : 'b'}>
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
          {CHIPS.map((chip, i) => {
            const active = (showY2k && chip === 'Y2K 픽셀') || (!showY2k && chip === '기본');
            return (
              <Pop at={20 + i * 7} key={chip} damping={12}>
                <div
                  style={{
                    border: `${3 * s}px solid ${active ? color.accent : `${color.ink}22`}`,
                    background: active ? color.accentSoft : color.white,
                    color: active ? color.accentDeep : color.ink,
                    fontFamily: font.semi,
                    fontSize: 34 * s,
                    padding: `${14 * s}px ${30 * s}px`,
                    borderRadius: 999,
                    transform: `scale(${active ? 1.06 : 1})`,
                  }}
                >
                  {chip}
                </div>
              </Pop>
            );
          })}
        </div>

        <div
          style={{
            fontFamily: font.medium,
            fontSize: 38 * s,
            color: color.inkSoft,
            opacity: interpolate(frame, [120, 140], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          스타일만 달라져요. 옷과 머리는 사진 그대로.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
