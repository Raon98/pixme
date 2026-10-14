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

import { color, font } from '../lib/theme';
import { Headline, PixelPhoto, Words, useScale } from '../lib/ui';

/**
 * 훅 (0–5s): 실제 사용자 사진이 셔터와 함께 들어오고, 픽셀 그리드가 굵어지며
 * 진짜 생성 결과(Y2K 캐릭터)로 바뀐다. 앱이 하는 일 전체가 3초 안에 보인다.
 *
 * <p>사진·캐릭터 모두 실제 소재다 — cheol-photo.jpg 와, 그 사진으로 돌린
 * 진짜 생성 결과 cheol-y2k.png.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;

  const photoIn = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  // 픽셀화: 50f부터 굵어진다 → 88f에 캐릭터로 스왑
  const px = interpolate(frame, [50, 86], [1, 42], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showCharacter = frame >= 88;

  const cardW = vertical ? 640 * s : 560 * s;
  const cardH = cardW * 1.24;

  const charSpring = spring({ frame: frame - 90, fps, config: { damping: 10, mass: 0.9 } });

  // 카드가 아주 느리게 숨쉬듯 기운다. 정지된 사진이 아니라는 신호.
  const drift = Math.sin(frame / 42) * 1.1;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 70 * s : 110 * s,
        }}
      >
        {/* 사진 → 픽셀 카드 */}
        <div
          style={{
            width: cardW,
            height: cardH,
            borderRadius: 40 * s,
            overflow: 'hidden',
            background: color.white,
            boxShadow: '0 40px 90px rgba(26,24,22,0.22)',
            transform: `perspective(${cardW * 5}px) rotateY(${drift}deg) scale(${
              0.7 + photoIn * 0.3
            }) rotate(${(1 - photoIn) * -4}deg)`,
            opacity: photoIn,
            position: 'relative',
          }}
        >
          {!showCharacter ? (
            <PixelPhoto
              src="char/cheol-photo.jpg"
              width={Math.round(cardW)}
              height={Math.round(cardH)}
              pixelSize={px}
              style={{ display: 'block' }}
            />
          ) : (
            <AbsoluteFill
              style={{
                background: color.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Img
                src={staticFile('char/cheol-y2k.png')}
                style={{
                  width: '88%',
                  height: '88%',
                  objectFit: 'contain',
                  transform: `scale(${0.8 + charSpring * 0.2})`,
                  imageRendering: 'pixelated',
                }}
              />
            </AbsoluteFill>
          )}

          {/* 셔터 플래시 */}
          <AbsoluteFill
            style={{
              background: color.white,
              opacity: interpolate(frame, [16, 18, 26], [0, 0.9, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
        </div>

        {/* 카피 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18 * s,
          }}
        >
          <Words text="사진 한 장," at={24} size={(vertical ? 92 : 104) * s} />
          <Words
            text="오늘의 내가 픽셀로."
            at={94}
            size={(vertical ? 92 : 104) * s}
            color={color.accent}
            stagger={4}
          />
        </div>
      </AbsoluteFill>

      {/* 변환 순간 터지는 픽셀 파편 */}
      {frame >= 86 && frame < 124
        ? Array.from({ length: 22 }).map((_, i) => {
            const t = (frame - 86) / 38;
            const a = random(`h${i}`) * Math.PI * 2;
            const v = (0.4 + random(`v${i}`) * 1) * 420 * s;
            const size = (8 + random(`z${i}`) * 18) * s;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: vertical ? '34%' : '50%',
                  width: size,
                  height: size,
                  background: random(`k${i}`) > 0.5 ? color.accent : color.ink,
                  transform: `translate(${Math.cos(a) * v * t}px, ${
                    Math.sin(a) * v * t + 160 * t * t
                  }px)`,
                  opacity: (1 - t) * 0.75,
                }}
              />
            );
          })
        : null}

      {/* 세로 포맷에서만, 아래쪽에 조용한 브랜드 서명 */}
      {vertical && frame > 110 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90 * s }}>
          <Headline
            size={34 * s}
            weight={font.semi}
            color={color.inkFaint}
            style={{ opacity: interpolate(frame, [110, 126], [0, 1], { extrapolateRight: 'clamp' }) }}
          >
            PIXME
          </Headline>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
