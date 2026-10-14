import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { color, font } from '../lib/theme';
import { Crop, Headline, Pop, Tint, Words, useScale } from '../lib/ui';

/** square.png 원본 크기 (393x852 @3x). */
const SOURCE = { width: 1179, height: 2556 };

/**
 * 광장 캔버스에서 사람들이 모여 선 구역만.
 *
 * <p>화면 전체를 폰 목업으로 띄우면 정작 보여줄 것 — 오늘의 캐릭터들이 한
 * 공간에 서 있다는 사실 — 이 손톱만 해진다. 분수 앞 무리만 크게 잘라낸다.
 */
const PLAZA = { x: 0.26, y: 0.51, w: 0.60, h: 0.32 };

/**
 * 광장 (13.3–19.3s): 실제 광장 화면을 크게 잘라 천천히 밀고 들어간다.
 * 캐릭터·배경·이름표 전부 앱이 그린 그대로다.
 */
export const Square: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const vertical = height > width;

  const cardIn = spring({ frame: frame - 12, fps, config: { damping: 14 } });
  // 느린 푸시인. 1.05 → 1.0 같은 미세한 줌은 흔들림으로만 읽혀서, 잘라낸
  // 이미지 안에서 확실히 들어가는 양으로 민다.
  const push = interpolate(frame, [12, 170], [1.10, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 가로는 폭이 아니라 높이가 한계다 — 1080 안에 들어오는 폭으로 역산한다.
  const cardW = vertical ? 940 * s : 780 * s;

  return (
    <AbsoluteFill>
      <Tint color={color.accent} opacity={0.04} />
      <AbsoluteFill
        style={{
          flexDirection: vertical ? 'column' : 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 62 * s : 90 * s,
        }}
      >
        {/* 가로에서는 카피가 오른쪽 기둥으로 빠진다 — 세로처럼 쌓으면
            크롭 카드 높이만으로 1080을 넘겨 제목이 잘린다. */}
        {vertical ? (
          <Words text={'오늘의 캐릭터들이\n모이는 광장'} at={8} size={80 * s} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 28 * s,
              maxWidth: 680 * s,
            }}
          >
            <Words
              text={'오늘의 캐릭터들이\n모이는 광장'}
              at={8}
              size={86 * s}
              align="left"
            />
            <Pop at={104} damping={13}>
              <Headline
                size={44 * s}
                weight={font.medium}
                color={color.inkSoft}
                style={{ textAlign: 'left' }}
              >
                {'매일 달라지는 서로의 오늘을\n가볍게 구경해요.'}
              </Headline>
            </Pop>
          </div>
        )}

        <div
          style={{
            position: 'relative',
            transform: `translateY(${(1 - cardIn) * 90}px) scale(${0.94 + cardIn * 0.06})`,
            opacity: cardIn,
          }}
        >
          <Crop
            src="ui/square.png"
            rect={PLAZA}
            source={SOURCE}
            width={cardW}
            scale={push}
            style={{
              borderRadius: 40 * s,
              boxShadow: '0 44px 90px rgba(26,24,22,0.26)',
              border: `${3 * s}px solid rgba(26,24,22,0.06)`,
            }}
          />

          {/* 떠 있는 상태 칩들 — 앱의 실제 요소(오늘의 한마디·좋아요)를
              화면 밖으로 꺼내 강조한 것. */}
          {/* Pop 이 wrapper 에 transform 을 걸어 containing block 이 되므로,
              절대 위치는 안쪽이 아니라 Pop 자체에 줘야 카드 기준으로 잡힌다. */}
          <Pop at={56} style={{ position: 'absolute', left: -40 * s, top: '30%' }}>
            <div
              style={{
                background: color.white,
                color: color.ink,
                fontFamily: font.bold,
                fontSize: 32 * s,
                padding: `${16 * s}px ${30 * s}px`,
                borderRadius: 999,
                boxShadow: '0 16px 36px rgba(26,24,22,0.16)',
                transform: `translateY(${Math.sin(frame / 22) * 6 * s}px)`,
              }}
            >
              😊 오늘은 그냥 산책
            </div>
          </Pop>

          <Pop at={82} style={{ position: 'absolute', right: -58 * s, top: '74%' }}>
            <div
              style={{
                background: color.heart,
                color: color.white,
                fontFamily: font.bold,
                fontSize: 32 * s,
                padding: `${16 * s}px ${30 * s}px`,
                borderRadius: 999,
                boxShadow: '0 16px 36px rgba(240,79,121,0.32)',
                transform: `translateY(${Math.cos(frame / 19) * 6 * s}px)`,
              }}
            >
              ❤️ 좋아요
            </div>
          </Pop>
        </div>

        {vertical ? (
          <Pop at={104} damping={13}>
            <Headline size={42 * s} weight={font.medium} color={color.inkSoft}>
              {'매일 달라지는 서로의 오늘을\n가볍게 구경해요.'}
            </Headline>
          </Pop>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
