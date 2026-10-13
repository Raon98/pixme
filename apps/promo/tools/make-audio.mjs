/**
 * PIXME 프로모션 영상 오디오 — 전부 코드로 합성한다.
 *
 * 외부 샘플을 하나도 쓰지 않는 이유는 단순하다: 상업용 광고에 넣을 소리는
 * 라이선스가 증명 가능해야 하고, 여기서 만든 PCM은 우리가 저작자다.
 * 각 효과음은 영상 쪽 타임라인(src/lib/timeline.ts)의 큐 이름과 1:1 대응한다.
 *
 * 실행: node tools/make-audio.mjs  →  assets/audio/*.wav
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

const SR = 48000;

/* ------------------------------------------------------------------ WAV IO */

function writeWav(name, channels) {
  // channels: [Float32Array] (mono) 또는 [L, R]
  const ch = channels.length;
  const frames = channels[0].length;
  const data = Buffer.alloc(frames * ch * 2);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      data.writeInt16LE(Math.round(v * 32767), (i * ch + c) * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(ch, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * ch * 2, 28);
  header.writeUInt16LE(ch * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(OUT, name), Buffer.concat([header, data]));
  console.log('wrote', name, (frames / SR).toFixed(2) + 's');
}

const seconds = (s) => new Float32Array(Math.round(s * SR));
const mix = (dst, src, atSec, gain = 1) => {
  const at = Math.round(atSec * SR);
  for (let i = 0; i < src.length && at + i < dst.length; i++) dst[at + i] += src[i] * gain;
};

/* ------------------------------------------------------------ synth bricks */

/** 짧은 사인 블립. pitchEnv로 시작→끝 주파수를 긋는다. */
function blip({ dur, f0, f1 = f0, gain = 0.8, curve = 3 }) {
  const buf = seconds(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const p = i / buf.length;
    const f = f0 + (f1 - f0) * p;
    const env = Math.exp(-curve * p * 6);
    buf[i] = Math.sin(2 * Math.PI * f * t) * env * gain;
  }
  return buf;
}

/** 삼각파 — 픽셀/칩튠 질감. */
function tri(f, t) {
  const x = (t * f) % 1;
  return 4 * Math.abs(x - 0.5) - 1;
}

function chipNote({ dur, f, gain = 0.5, attack = 0.004, release = 0.08 }) {
  const buf = seconds(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    let env = 1;
    if (t < attack) env = t / attack;
    const left = dur - t;
    if (left < release) env *= left / release;
    buf[i] = tri(f, t) * env * gain * 0.6 + Math.sin(2 * Math.PI * f * t) * env * gain * 0.4;
  }
  return buf;
}

/** 화이트노이즈를 밴드패스 느낌으로 깎은 우시. */
function whoosh({ dur = 0.45, gain = 0.5, rise = 0.35 }) {
  const buf = seconds(dur);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const p = i / buf.length;
    const n = Math.random() * 2 - 1;
    // 열리는 필터: 컷오프가 올라갔다가 내려온다
    const cutoff = 0.04 + 0.4 * Math.sin(Math.PI * Math.min(1, p / rise));
    lp += cutoff * (n - lp);
    lp2 += cutoff * (lp - lp2);
    const env = Math.sin(Math.PI * p) ** 1.5;
    buf[i] = (lp - lp2) * env * gain * 6;
  }
  return buf;
}

/* ------------------------------------------------------------------- SFX */

// 1) ui-tap — 부드러운 클릭 (짧은 고음 블립 + 저음 톡)
{
  const buf = seconds(0.12);
  mix(buf, blip({ dur: 0.05, f0: 1800, f1: 1200, gain: 0.5 }), 0);
  mix(buf, blip({ dur: 0.08, f0: 320, f1: 260, gain: 0.5, curve: 4 }), 0.004);
  writeWav('ui-tap.wav', [buf]);
}

// 2) pop — 카드/캐릭터 등장 (피치가 튀어오르는 블립)
{
  const buf = seconds(0.25);
  mix(buf, blip({ dur: 0.16, f0: 420, f1: 980, gain: 0.7, curve: 2 }), 0);
  mix(buf, blip({ dur: 0.1, f0: 1600, f1: 2100, gain: 0.25, curve: 3 }), 0.03);
  writeWav('pop.wav', [buf]);
}

// 3) whoosh — 장면 전환
writeWav('whoosh.wav', [whoosh({ dur: 0.5, gain: 0.55 })]);

// 4) pixelate — 사진→픽셀 변환 (칩튠 아르페지오가 샥 올라감)
{
  const buf = seconds(0.7);
  const steps = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
  steps.forEach((f, i) => mix(buf, chipNote({ dur: 0.12, f, gain: 0.4 }), i * 0.085));
  mix(buf, whoosh({ dur: 0.6, gain: 0.25, rise: 0.5 }), 0);
  writeWav('pixelate.wav', [buf]);
}

// 5) success — 완성 차임 (장3화음 상행)
{
  const buf = seconds(0.9);
  mix(buf, chipNote({ dur: 0.5, f: 523.25, gain: 0.35, release: 0.4 }), 0);
  mix(buf, chipNote({ dur: 0.5, f: 659.25, gain: 0.35, release: 0.4 }), 0.09);
  mix(buf, chipNote({ dur: 0.65, f: 783.99, gain: 0.4, release: 0.55 }), 0.18);
  mix(buf, chipNote({ dur: 0.75, f: 1046.5, gain: 0.3, release: 0.65 }), 0.27);
  writeWav('success.wav', [buf]);
}

// 6) heart — 좋아요 (톡, 위로 살짝 벙긋)
{
  const buf = seconds(0.3);
  mix(buf, blip({ dur: 0.1, f0: 660, f1: 880, gain: 0.55, curve: 2.5 }), 0);
  mix(buf, blip({ dur: 0.14, f0: 880, f1: 1174, gain: 0.4, curve: 2.5 }), 0.09);
  writeWav('heart.wav', [buf]);
}

// 7) wave — 손 흔들기 👋 (가벼운 두 번 똑똑)
{
  const buf = seconds(0.35);
  mix(buf, blip({ dur: 0.07, f0: 980, f1: 760, gain: 0.5, curve: 3 }), 0);
  mix(buf, blip({ dur: 0.09, f0: 1180, f1: 900, gain: 0.5, curve: 3 }), 0.13);
  writeWav('wave.wav', [buf]);
}

// 8) message — 채팅 수신 틱
{
  const buf = seconds(0.22);
  mix(buf, blip({ dur: 0.07, f0: 1400, f1: 1050, gain: 0.45, curve: 3 }), 0);
  mix(buf, blip({ dur: 0.12, f0: 700, f1: 740, gain: 0.3, curve: 3 }), 0.05);
  writeWav('message.wav', [buf]);
}

// 9) shutter — 사진 찍는 소리 (노이즈 클릭 2연타)
{
  const buf = seconds(0.18);
  const click = (at, g) => {
    const c = seconds(0.04);
    for (let i = 0; i < c.length; i++) {
      c[i] = (Math.random() * 2 - 1) * Math.exp(-(i / c.length) * 10) * g;
    }
    mix(buf, c, at);
  };
  click(0, 0.6);
  click(0.05, 0.4);
  mix(buf, blip({ dur: 0.05, f0: 240, f1: 180, gain: 0.3 }), 0.01);
  writeWav('shutter.wav', [buf]);
}

/* -------------------------------------------------------------------- BGM */
/**
 * 45초 로파이 칩팝 루프 — 96 BPM, Cmaj7 · Am7 · Fmaj7 · G 진행.
 * 레이어: 사인 베이스 + 삼각파 코드 패드 + 칩 멜로디 + 브러시 노이즈 하이햇.
 * 과하지 않게: 전체 게인을 영상 믹스에서 -쪽으로 깐다.
 */
{
  const DUR = 46;
  const L = seconds(DUR);
  const R = seconds(DUR);
  const BPM = 96;
  const beat = 60 / BPM;
  const bar = beat * 4;

  const CHORDS = [
    { root: 130.81, tones: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
    { root: 110.0, tones: [220.0, 261.63, 329.63, 392.0] },   // Am7
    { root: 87.31, tones: [174.61, 220.0, 261.63, 329.63] },  // Fmaj7
    { root: 98.0, tones: [196.0, 246.94, 293.66, 392.0] },    // G
  ];

  // 멜로디(칩): C E G A | A G E C ... 펜타토닉 느낌의 조용한 모티프
  const MELODY = [
    [523.25, 0], [659.25, 1], [783.99, 2], [880.0, 3],
    [783.99, 4.5], [659.25, 5.5], [523.25, 6], [587.33, 7],
  ];

  const totalBars = Math.floor(DUR / bar);
  for (let b = 0; b < totalBars; b++) {
    const chord = CHORDS[b % 4];
    const t0 = b * bar;

    // 베이스: 1박·3박 — 사인 + 살짝 배음
    for (const k of [0, 2]) {
      const at = t0 + k * beat;
      const note = seconds(beat * 0.9);
      for (let i = 0; i < note.length; i++) {
        const t = i / SR;
        const env = Math.min(1, t / 0.02) * Math.exp(-t * 2.2);
        note[i] =
          (Math.sin(2 * Math.PI * chord.root * t) * 0.8 +
            Math.sin(2 * Math.PI * chord.root * 2 * t) * 0.15) * env * 0.5;
      }
      mix(L, note, at, 1);
      mix(R, note, at, 1);
    }

    // 패드: 코드 톤을 작게 깔기 (좌우로 살짝 벌림)
    chord.tones.forEach((f, idx) => {
      const note = seconds(bar);
      for (let i = 0; i < note.length; i++) {
        const t = i / SR;
        const env = Math.min(1, t / 0.4) * Math.min(1, (bar - t) / 0.8);
        note[i] = tri(f, t) * env * 0.05;
      }
      mix(idx % 2 === 0 ? L : R, note, t0, 1);
      mix(idx % 2 === 0 ? R : L, note, t0, 0.6);
    });

    // 하이햇: 8분음 브러시 노이즈, 뒤박만 세게
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * beat * 0.5;
      const g = e % 2 === 1 ? 0.12 : 0.06;
      const hat = seconds(0.05);
      let hp = 0;
      for (let i = 0; i < hat.length; i++) {
        const n = Math.random() * 2 - 1;
        hp = 0.7 * hp + n - (i > 0 ? 0 : 0);
        hat[i] = (n - hp * 0.6) * Math.exp(-(i / hat.length) * 7) * g;
      }
      mix(L, hat, at, 0.9);
      mix(R, hat, at, 1);
    }

    // 멜로디: 2마디마다 모티프 (2마디 쉼)
    if (b % 4 === 0 || b % 4 === 1) {
      for (const [f, pos] of MELODY) {
        const at = t0 + pos * beat * 0.5;
        if (at + 0.3 > t0 + bar) continue;
        const note = chipNote({ dur: 0.22, f, gain: 0.1, release: 0.15 });
        mix(L, note, at, 0.8);
        mix(R, note, at, 1);
      }
    }
  }

  // 마스터: 페이드인/아웃 + 소프트클립
  const fade = (buf) => {
    const fi = Math.round(0.8 * SR);
    const fo = Math.round(2.5 * SR);
    for (let i = 0; i < fi; i++) buf[i] *= i / fi;
    for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo;
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * 1.4) * 0.85;
  };
  fade(L);
  fade(R);
  writeWav('bgm.wav', [L, R]);
}

console.log('all audio written to', OUT);
