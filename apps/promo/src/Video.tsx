import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { CUE, SCENE, TOTAL } from './lib/timeline';
import { useFonts } from './lib/ui';
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

  return (
    <AbsoluteFill style={{ background: '#FBF7EF' }}>
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

      {/* ---------------- 사운드: 타임라인 큐와 1:1 ---------------- */}
      <Bgm />
      <Sfx at={CUE.shutter} file="shutter" />
      <Sfx at={CUE.pixelate} file="pixelate" />
      <Sfx at={CUE.heroPop} file="pop" />

      <Sfx at={CUE.makeWhoosh} file="whoosh" volume={0.8} />
      <Sfx at={CUE.tapPreview} file="ui-tap" />
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
