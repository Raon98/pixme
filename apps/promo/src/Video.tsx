import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { CUE, SCENE, TOTAL } from './lib/timeline';
import { Backdrop, PixelWipe, useFonts } from './lib/ui';
import { Hook } from './scenes/Hook';
import { Make } from './scenes/Make';
import { Square } from './scenes/Square';
import { Connect } from './scenes/Connect';
import { Styles } from './scenes/Styles';
import { Outro } from './scenes/Outro';

/** 한 번만 깔리는 BGM — 마지막 2초 페이드아웃, 전체적으로 효과음 아래 볼륨. */
const Bgm: React.FC = () => {
  const frame = useCurrentFrame();
  const volume = interpolate(frame, [0, 20, TOTAL - 70, TOTAL - 6], [0, 0.5, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <Audio src={staticFile('audio/bgm.wav')} volume={volume} />;
};

const Sfx: React.FC<{ at: number; file: string; volume?: number }> = ({ at, file, volume = 1 }) => (
  <Sequence from={at} durationInFrames={60}>
    <Audio src={staticFile(`audio/${file}.wav`)} volume={volume} />
  </Sequence>
);

export const PromoVideo: React.FC = () => {
  useFonts();

  const span = (k: keyof typeof SCENE) => ({
    from: SCENE[k].from,
    durationInFrames: SCENE[k].to - SCENE[k].from,
  });

  /** 컷을 가리는 픽셀 전환. 경계 프레임을 한가운데 두고 양쪽으로 걸친다. */
  const WIPE = 22;
  const wipeAt = (k: keyof typeof SCENE) => SCENE[k].from - WIPE / 2;

  return (
    <AbsoluteFill style={{ background: '#FBF7EF' }}>
      {/* 40초 내내 끊기지 않는 배경. 씬 바깥에 둬야 컷마다 되감기지 않는다. */}
      <Backdrop />

      <Sequence {...span('hook')}>
        <Hook />
      </Sequence>
      <Sequence {...span('make')}>
        <Make />
      </Sequence>
      <Sequence {...span('square')}>
        <Square />
      </Sequence>
      <Sequence {...span('connect')}>
        <Connect />
      </Sequence>
      <Sequence {...span('styles')}>
        <Styles />
      </Sequence>
      <Sequence {...span('outro')}>
        <Outro />
      </Sequence>

      {(['make', 'square', 'connect', 'styles', 'outro'] as const).map((k) => (
        <Sequence key={k} from={wipeAt(k)} durationInFrames={WIPE}>
          <PixelWipe />
        </Sequence>
      ))}

      {/* ---------------- 사운드: 타임라인 큐와 1:1 ---------------- */}
      <Bgm />
      <Sfx at={CUE.shutter} file="shutter" />
      <Sfx at={CUE.pixelate} file="pixelate" />
      <Sfx at={CUE.heroPop} file="pop" />

      <Sfx at={CUE.makeWhoosh} file="whoosh" volume={0.8} />
      <Sfx at={CUE.tapGenerate} file="ui-tap" />
      <Sfx at={CUE.resultSuccess} file="success" />

      <Sfx at={CUE.squareWhoosh} file="whoosh" volume={0.8} />
      <Sfx at={CUE.squarePop} file="pop" volume={0.7} />

      <Sfx at={CUE.connectWhoosh} file="whoosh" volume={0.8} />
      <Sfx at={CUE.heart} file="heart" />
      <Sfx at={CUE.wave} file="wave" />
      <Sfx at={CUE.connectedPop} file="pop" />
      <Sfx at={CUE.message1} file="message" />
      <Sfx at={CUE.message2} file="message" />

      <Sfx at={CUE.stylesWhoosh} file="whoosh" volume={0.8} />
      <Sfx at={CUE.chip1} file="ui-tap" volume={0.7} />
      <Sfx at={CUE.chip2} file="ui-tap" volume={0.7} />
      <Sfx at={CUE.chip3} file="ui-tap" volume={0.7} />
      <Sfx at={CUE.chip4} file="ui-tap" volume={0.7} />
      <Sfx at={CUE.styleSwap1} file="pop" />
      <Sfx at={CUE.styleSwap2} file="pop" />

      <Sfx at={CUE.outroWhoosh} file="whoosh" volume={0.8} />
      <Sfx at={CUE.iconPop} file="pop" />
      <Sfx at={CUE.logoChime} file="success" />
    </AbsoluteFill>
  );
};
