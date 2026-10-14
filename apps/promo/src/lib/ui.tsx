import React, { useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  interpolate,
  random,
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

/**
 * 세로는 1080x1920, 가로는 1920x1080을 각자의 기준 캔버스로 삼는다.
 * 가로에서도 세로 기준(min)을 쓰면 모든 요소가 56%로 쪼그라들어 화면이
 * 휑해진다 — 씬들이 이미 vertical 분기로 크기를 따로 주므로, 스케일은
 * "그 방향의 기준 캔버스 대비 배율"이어야 한다.
 */
export const useScale = () => {
  const { width, height } = useVideoConfig();
  return height > width ? height / 1920 : height / 1080;
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

/**
 * 단어 단위로 마스크를 열며 올라오는 카피.
 *
 * <p>블록 전체가 한 덩어리로 페이드되면 슬라이드쇼처럼 보인다. 단어마다
 * 몇 프레임씩 어긋나게 들어오면 같은 문장도 "쓰이는" 느낌이 된다.
 * 줄바꿈은 `\n`으로 넣는다.
 */
export const Words: React.FC<{
  text: string;
  at: number;
  size: number;
  color?: string;
  weight?: string;
  stagger?: number;
  align?: 'center' | 'left';
}> = ({ text, at, size, color: c = color.ink, weight = font.black, stagger = 3, align = 'center' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = text.split('\n');
  let index = 0;

  return (
    <div
      style={{
        fontFamily: weight,
        fontSize: size,
        lineHeight: 1.2,
        color: c,
        letterSpacing: -size * 0.025,
        textAlign: align,
      }}
    >
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: align === 'center' ? 'center' : 'flex-start',
            // 마스크가 글자의 디센더까지 덮도록 줄 높이만큼 여유를 준다.
            overflow: 'hidden',
            paddingBottom: size * 0.12,
          }}
        >
          {line.split(' ').map((word, wi) => {
            const delay = at + index * stagger;
            index += 1;
            const k = spring({
              frame: frame - delay,
              fps,
              config: { damping: 15, mass: 0.7 },
            });
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  transform: `translateY(${(1 - k) * size * 1.1}px)`,
                  opacity: k,
                  marginRight: size * 0.26,
                  whiteSpace: 'pre',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------ phone frame */

/**
 * 실제 앱 스크린샷(1179x2556, iPhone 393x852 @3x)을 담는 디바이스 프레임.
 * UI는 절대 변형하지 않는다 — 프레임, 그림자, 등장 모션, 유리 반사만 입힌다.
 */
export const Phone: React.FC<{
  src: string;
  width: number;
  style?: React.CSSProperties;
  screenStyle?: React.CSSProperties;
  /** 화면을 훑고 지나가는 유리 반사. 프레임 번호, 없으면 생략. */
  glareAt?: number;
  /** 입체감을 주는 Y축 기울기(도). */
  tilt?: number;
  children?: React.ReactNode; // 스크린 위 오버레이(탭 리플 등)
}> = ({ src, width, style, screenStyle, glareAt, tilt = 0, children }) => {
  const frame = useCurrentFrame();
  const h = width * (852 / 393);
  const r = width * 0.14;

  const glare =
    glareAt === undefined
      ? null
      : interpolate(frame - glareAt, [0, 38], [-70, 170], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: r,
        background: color.bezel,
        padding: width * 0.025,
        boxShadow: '0 40px 80px rgba(26,24,22,0.28), 0 12px 28px rgba(26,24,22,0.18)',
        transform: tilt ? `perspective(${width * 6}px) rotateY(${tilt}deg)` : undefined,
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
        {glare !== null && glare > -60 && glare < 170 ? (
          <div
            style={{
              position: 'absolute',
              top: '-30%',
              bottom: '-30%',
              left: `${glare}%`,
              width: '34%',
              background:
                'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0) 100%)',
              transform: 'rotate(8deg)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/**
 * 스크린샷의 한 구역만 잘라 크게 보여준다.
 *
 * <p>전체 화면을 작게 띄우면 정작 보여주려던 것(광장에 서 있는 캐릭터들)이
 * 손톱만 해진다. 비율은 잘라낸 영역 그대로 유지하므로 늘어나지 않는다.
 */
export const Crop: React.FC<{
  src: string;
  /** 0~1 정규화 좌표. */
  rect: { x: number; y: number; w: number; h: number };
  /** 원본 픽셀 크기 — 잘린 영역의 종횡비 계산용. */
  source: { width: number; height: number };
  width: number;
  scale?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ src, rect, source, width, scale = 1, style, children }) => {
  const height = (width * (rect.h * source.height)) / (rect.w * source.width);
  const imgW = width / rect.w;
  const imgH = imgW * (source.height / source.width);

  return (
    <div
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          width: imgW,
          height: imgH,
          left: -rect.x * imgW,
          top: -rect.y * imgH,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          maxWidth: 'none',
        }}
      />
      {children}
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

/**
 * 영상 전체에 한 번만 깔리는 배경.
 *
 * <p>씬마다 각자 그리면 컷마다 배경 모션이 0프레임으로 되감겨 튄다. 여기서는
 * `<Sequence>` 바깥에 한 번만 두므로 40초 내내 끊김 없이 흐른다: 느리게
 * 도는 두 개의 빛 덩어리, 위로 흐르는 픽셀 먼지, 그리고 브랜드의 도트 그리드.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const dot = Math.round(Math.min(width, height) / 36);
  const t = frame / durationInFrames;

  const blobA = {
    x: 50 + Math.sin(frame / 190) * 16,
    y: 14 + Math.cos(frame / 240) * 8,
  };
  const blobB = {
    x: 24 + Math.cos(frame / 165) * 20,
    y: 88 + Math.sin(frame / 210) * 7,
  };

  const motes = 26;

  return (
    <AbsoluteFill style={{ background: color.paper }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 46% at ${blobA.x}% ${blobA.y}%, ${color.white} 0%, rgba(255,255,255,0) 70%),
            radial-gradient(54% 40% at ${blobB.x}% ${blobB.y}%, rgba(124,108,240,0.16) 0%, rgba(124,108,240,0) 72%),
            linear-gradient(170deg, ${color.paper} 0%, ${color.paperDeep} 100%)`,
        }}
      />

      {/* 브랜드 도트 그리드 — 아주 느리게 흐른다. */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${color.ink}11 1.5px, transparent 1.5px)`,
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${(frame * 0.12) % dot}px ${(-frame * 0.18) % dot}px`,
          opacity: 0.5,
        }}
      />

      {/* 떠오르는 픽셀 먼지 */}
      {Array.from({ length: motes }).map((_, i) => {
        const seed = i + 1;
        const size = 4 + random(`m${seed}`) * 9;
        const x = random(`x${seed}`) * 100;
        const speed = 0.4 + random(`s${seed}`) * 0.9;
        const y = (110 - ((frame * speed * 0.12 + random(`o${seed}`) * 130) % 130)) % 130;
        const violet = random(`c${seed}`) > 0.62;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: violet ? color.accent : color.inkFaint,
              opacity: 0.1 + random(`a${seed}`) * 0.13,
            }}
          />
        );
      })}

      {/* 가장자리를 눌러 화면 중앙으로 시선을 모은다. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(78% 62% at 50% 46%, rgba(0,0,0,0) 55%, rgba(26,24,22,${0.07 + t * 0.03}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** 씬마다 다른 색감을 아주 옅게 덧입힌다. */
export const Tint: React.FC<{ color: string; opacity?: number }> = ({
  color: c,
  opacity = 0.06,
}) => <AbsoluteFill style={{ background: c, opacity }} />;

/**
 * 컷 전환 — 화면이 픽셀 블록으로 닫혔다 열린다.
 *
 * <p>사각형 하나가 슬라이드해 지나가는 와이프는 어느 앱 광고에나 붙는다.
 * 픽셀로 닫히는 전환은 이 제품이 무엇을 하는지 그 자체로 말한다. 블록은
 * 중앙에서의 거리 + 약간의 난수 순으로 채워져 기계적으로 보이지 않는다.
 */
export const PixelWipe: React.FC<{ cols?: number }> = ({ cols = 16 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const cell = width / cols;
  const rows = Math.ceil(height / cell);
  const half = durationInFrames / 2;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: rows * cols }).map((_, i) => {
        const cx = i % cols;
        const cy = Math.floor(i / cols);
        const dx = (cx + 0.5) / cols - 0.5;
        const dy = (cy + 0.5) / rows - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy) / 0.707;
        const jitter = random(`w${i}`) * 0.22;
        const order = Math.min(1, dist * 0.8 + jitter);

        // 닫힐 때는 바깥부터, 열릴 때는 같은 순서로 비워진다.
        const closeAt = order * (half * 0.75);
        const openAt = half + order * (half * 0.75);
        const on = frame >= closeAt && frame < openAt;
        if (!on) return null;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx * cell,
              top: cy * cell,
              width: cell + 1,
              height: cell + 1,
              background: cy % 2 === cx % 2 ? color.paperDeep : color.paper,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
