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

import { color, font } from '../lib/theme';
import { Backdrop, Headline, PixelPhoto, Pop, Rise, useScale } from '../lib/ui';

/**
 * 훅 (0–5s): 실제 사용자 사진이 셔터와 함께 들어오고, 픽셀 그리드가 굵어지며
 * 진짜 생성 결과(Y2K 캐릭터)로 바뀐다. 앱이 하는 일 전체가 3초 안에 보인다.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;

  // 사진 등장 (셔터 큐 = 18f)
  const photoIn = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  // 픽셀화: 52f부터 굵어진다 → 86f에 캐릭터로 스왑
  const px = interpolate(frame, [50, 86], [1, 42], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showCharacter = frame >= 88;

  const cardW = vertical ? 640 * s : 560 * s;
  const cardH = cardW * 1.24;

  const charSpring = spring({ frame: frame - 90, fps, config: { damping: 10, mass: 0.9 } });

  return (
    <AbsoluteFill>
      <Backdrop />
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
            transform: `scale(${0.7 + photoIn * 0.3}) rotate(${(1 - photoIn) * -4}deg)`,
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
            <AbsoluteFill style={{ background: color.paper, alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 * s }}>
          <Rise at={24}>
            <Headline size={(vertical ? 92 : 104) * s} weight={font.black}>
              사진 한 장,
            </Headline>
          </Rise>
          <Pop at={96} damping={12}>
            <Headline size={(vertical ? 92 : 104) * s} weight={font.black} color={color.accent}>
              오늘의 내가 픽셀로.
            </Headline>
          </Pop>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
