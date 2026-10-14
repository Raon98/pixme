/**
 * 단일한 진실의 타임라인.
 *
 * 모든 장면 경계와 사운드 큐가 여기 프레임 숫자 하나로 묶인다 — 애니메이션과
 * 오디오 타이밍이 어긋나는 가장 흔한 원인은 숫자가 두 군데 사는 것이라서다.
 * 수정할 때는 여기만 고치면 그림과 소리가 같이 움직인다.
 */
export const FPS = 30;

export const SCENE = {
  hook: { from: 0, to: 150 },      // 사진 → 픽셀 변신
  make: { from: 150, to: 400 },    // 만들기 플로우 (실제 UI)
  square: { from: 400, to: 580 },  // 오늘의 광장
  connect: { from: 580, to: 800 }, // 좋아요 · 👋 · 대화
  styles: { from: 800, to: 980 },  // 픽셀 스타일
  outro: { from: 980, to: 1200 },  // 로고 + 슬로건 + CTA
} as const;

export const TOTAL = SCENE.outro.to;

/**
 * 씬 컴포넌트는 <Sequence> 안에서 돌므로 useCurrentFrame()이 "씬-로컬"이다.
 * 아래 CUE는 전부 절대 프레임(오디오용) — 씬 안에서는 이 함수로 변환해 쓴다.
 * 첫 렌더에서 모든 씬이 통째로 비어 보였던 원인이 바로 이 변환 누락이었다.
 */
export const local = (absolute: number, scene: { from: number }) => absolute - scene.from;

/** 사운드 큐 — 이름은 public/audio/*.wav 파일명과 1:1. */
export const CUE = {
  shutter: 18,
  pixelate: 52,
  heroPop: 92,

  makeWhoosh: SCENE.make.from,
  tapGenerate: 246,
  resultSuccess: 320,

  squareWhoosh: SCENE.square.from,
  squarePop: 432,

  connectWhoosh: SCENE.connect.from,
  heart: 612,
  wave: 668,
  connectedPop: 706,
  message1: 736,
  message2: 762,

  stylesWhoosh: SCENE.styles.from,
  styleSwap1: 836,
  styleSwap2: 896,
  chip1: 824,
  chip2: 840,
  chip3: 856,
  chip4: 872,

  outroWhoosh: SCENE.outro.from,
  iconPop: 1002,
  logoChime: 1040,
} as const;
