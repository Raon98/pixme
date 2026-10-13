import React, { useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { color, font } from './theme';

/* ----------------------------------------------------------------- fonts */

const FONT_FILES: Record<string, string> = {
  'Pretendard Black': 'fonts/Pretendard-Black.otf',
  'Pretendard ExtraBold': 'fonts/Pretendard-ExtraBold.otf',
  'Pretendard Bold': 'fonts/Pretendard-Bold.otf',
  'Pretendard SemiBold': 'fonts/Pretendard-SemiBold.otf',
  'Pretendard Medium': 'fonts/Pretendard-Medium.otf',
  'Pretendard Regular': 'fonts/Pretendard-Regular.otf',
};

/**
 * Pretendard(SIL OFL)를 렌더 전에 로드한다. delayRender 없이는 첫 프레임이
 * 폴백 폰트로 찍히는 수가 있어서, 전부 로드될 때까지 렌더를 잡아둔다.
 */
export const useFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(
      Object.entries(FONT_FILES).map(async ([family, file]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`);
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => continueRender(handle));
  }, [handle]);
};

/* ---------------------------------------------------------------- layout */

/** 세로(1080x1920) 기준 1 = 1px. 가로 레이아웃은 씬에서 직접 조정한다. */
export const useScale = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width / 1080, height / 1920) || width / 1920;
};

export const isVertical = (width: number, height: number) => height > width;

/* ------------------------------------------------------------ primitives */

export const Pop: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  damping?: number;
  from?: number;
}> = ({ at, children, style, damping = 11, from = 0.6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping, mass: 0.8 } });
  if (frame < at) return null;
  return (
    <div
      style={{
        transform: `scale(${from + (1 - from) * s})`,
        opacity: Math.min(1, s * 1.6),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 아래에서 떠오르는 카피 한 줄. */
export const Rise: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  dist?: number;
  out?: number;
}> = ({ at, children, style, dist = 60, out }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 14, mass: 0.9 } });
  const exit =
    out === undefined
      ? 1
      : interpolate(frame, [out, out + 12], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  if (frame < at) return null;
  return (
    <div
      style={{
        transform: `translateY(${(1 - s) * dist}px)`,
        opacity: Math.min(1, s * 1.5) * exit,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Headline: React.FC<{
  children: React.ReactNode;
  size: number;
  color?: string;
  weight?: string;
  style?: React.CSSProperties;
}> = ({ children, size, color: c = color.ink, weight = font.extraBold, style }) => (
  <div
    style={{
      fontFamily: weight,
      fontSize: size,
      lineHeight: 1.22,
      color: c,
      textAlign: 'center',
      letterSpacing: -size * 0.02,
      whiteSpace: 'pre-line',
      ...style,
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------ phone frame */

/**
 * 실제 앱 스크린샷(1179x2556, iPhone 393x852 @3x)을 담는 디바이스 프레임.
 * UI는 절대 변형하지 않는다 — 프레임, 그림자, 등장 모션만 입힌다.
 */
export const Phone: React.FC<{
  src: string;
  width: number;
  style?: React.CSSProperties;
  screenStyle?: React.CSSProperties;
  children?: React.ReactNode; // 스크린 위 오버레이(탭 리플 등)
}> = ({ src, width, style, screenStyle, children }) => {
  const h = width * (852 / 393);
  const r = width * 0.14;
  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: r,
        background: color.bezel,
        padding: width * 0.025,
        boxShadow: '0 40px 80px rgba(26,24,22,0.28), 0 12px 28px rgba(26,24,22,0.18)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: r - width * 0.025,
          overflow: 'hidden',
          background: color.paper,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', ...screenStyle }}
        />
        {children}
      </div>
    </div>
  );
};

/** 터치 포인트 — 눌리는 순간을 보여주는 리플. 좌표는 스크린 비율(0~1). */
export const Tap: React.FC<{ at: number; x: number; y: number; size?: number }> = ({
  at,
  x,
  y,
  size = 120,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 20) return null;
  const p = t / 20;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size,
        border: `${Math.max(2, size * 0.06 * (1 - p))}px solid ${color.accent}`,
        background: `rgba(124,108,240,${0.25 * (1 - p)})`,
        transform: `scale(${0.4 + p * 1.1})`,
        opacity: 1 - p,
      }}
    />
  );
};

/* -------------------------------------------------------------- particles */

const rand = (seed: number) => {
  const x = Math.sin(seed * 999.73) * 43758.5453;
  return x - Math.floor(x);
};

/** 좋아요 하트 버스트 — 결정적(시드 기반)이라 렌더마다 동일하다. */
export const HeartBurst: React.FC<{
  at: number;
  count?: number;
  size?: number;
  spread?: number;
}> = ({ at, count = 14, size = 54, spread = 320 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 55) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const a = rand(i + 1) * Math.PI - Math.PI; // 위쪽 반원
        const v = 0.5 + rand(i + 7) * 0.9;
        const p = t / 55;
        const dx = Math.cos(a) * spread * v * p;
        const dy = Math.sin(a) * spread * v * p - 120 * p + 260 * p * p;
        const s = size * (0.6 + rand(i + 13) * 0.8);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(${dx}px, ${dy}px) rotate(${(rand(i) - 0.5) * 60}deg) scale(${1 - p * 0.3})`,
              fontSize: s,
              opacity: 1 - p * p,
            }}
          >
            ❤️
          </div>
        );
      })}
    </>
  );
};

/* --------------------------------------------------------- pixelate photo */

/**
 * 훅 장면의 핵심: 실제 사진이 단계적으로 "픽셀"이 되는 변환.
 * 캔버스에 cover-fit 으로 저해상 → 니어리스트 업스케일을 그린다.
 */
export const PixelPhoto: React.FC<{
  src: string;
  width: number;
  height: number;
  /** 1 = 원본, 커질수록 굵은 픽셀. */
  pixelSize: number;
  style?: React.CSSProperties;
}> = ({ src, width, height, pixelSize, style }) => {
  const [handle] = useState(() => delayRender('pixel-photo'));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new Image();
    image.src = staticFile(src);
    image.onload = () => {
      setImg(image);
      continueRender(handle);
    };
    image.onerror = () => continueRender(handle);
  }, [handle, src]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const px = Math.max(1, pixelSize);
    const sw = Math.max(2, Math.round(width / px));
    const sh = Math.max(2, Math.round(height / px));

    // cover-fit 소스 크롭
    const scale = Math.max(width / img.width, height / img.height);
    const cw = width / scale;
    const ch = height / scale;
    const cx = (img.width - cw) / 2;
    const cy = (img.height - ch) / 2;

    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.drawImage(img, cx, cy, cw, ch, 0, 0, sw, sh);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(off, 0, 0, sw, sh, 0, 0, width, height);
  }, [img, pixelSize, width, height]);

  return <canvas ref={ref} width={width} height={height} style={style} />;
};

/* ----------------------------------------------------------- scene chrome */

/** 모든 씬 공통 배경 — 종이 질감 그라데이션 + 은은한 픽셀 도트. */
export const Backdrop: React.FC<{ tint?: string }> = ({ tint }) => {
  const { width, height } = useVideoConfig();
  const dot = Math.round(Math.min(width, height) / 36);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 90% at 50% 8%, ${color.white} 0%, ${color.paper} 55%, ${color.paperDeep} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${color.ink}11 1.5px, transparent 1.5px)`,
          backgroundSize: `${dot}px ${dot}px`,
          opacity: 0.5,
        }}
      />
      {tint ? <AbsoluteFill style={{ background: tint, opacity: 0.06 }} /> : null}
    </AbsoluteFill>
  );
};
