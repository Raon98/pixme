import React from 'react';
import { Composition } from 'remotion';

import { PromoVideo } from './Video';
import { FPS, TOTAL } from './lib/timeline';

export const Root: React.FC = () => (
  <>
    {/* 릴스 · 쇼츠 · 틱톡 */}
    <Composition
      id="Vertical"
      component={PromoVideo}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
    />
    {/* 유튜브 · 웹 */}
    <Composition
      id="Horizontal"
      component={PromoVideo}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
