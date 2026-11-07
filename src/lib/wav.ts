// Synthesizes violin-like tones into 16-bit mono WAV files (used for playback on iOS/Android).

import { midiToFreq, type Note } from './notes';

const HARMONICS = [1, 0.62, 0.45, 0.3, 0.22, 0.14, 0.1, 0.06];

type Segment = { midi: number | null; seconds: number };

/** Render segments (null midi = silence) to PCM samples in [-1, 1]. */
export function renderSegments(segments: Segment[], sampleRate = 22050, a4 = 440, volume = 0.3): Float32Array {
  const total = Math.ceil(segments.reduce((a, s) => a + s.seconds, 0) * sampleRate);
  const out = new Float32Array(total);
  let pos = 0;
  for (const seg of segments) {
    const len = Math.floor(seg.seconds * sampleRate);
    if (seg.midi != null) {
      const f0 = midiToFreq(seg.midi, a4);
      const nyquist = sampleRate / 2;
      const soundLen = Math.max(1, Math.floor(len * 0.95));
      const attack = Math.min(0.06 * sampleRate, soundLen / 3);
      const release = Math.min(0.12 * sampleRate, soundLen / 3);
      const phases = new Float64Array(HARMONICS.length);
      for (let i = 0; i < soundLen; i++) {
        const t = i / sampleRate;
        // Gentle vibrato that fades in after the attack.
        const vibDepth = Math.min(1, t / 0.35) * 0.004;
        const f = f0 * (1 + vibDepth * Math.sin(2 * Math.PI * 5.5 * t));
        let v = 0;
        for (let h = 0; h < HARMONICS.length; h++) {
          const fh = f * (h + 1);
          if (fh >= nyquist) break;
          phases[h] += (2 * Math.PI * fh) / sampleRate;
          v += HARMONICS[h] * Math.sin(phases[h]);
        }
        let env = 1;
        if (i < attack) env = i / attack;
        else if (i > soundLen - release) env = (soundLen - i) / release;
        out[pos + i] = (v / 2.2) * env * volume;
      }
    }
    pos += len;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const dv = new DataView(bytes.buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, 'data');
  dv.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

export function toneWav(midi: number, seconds: number, a4 = 440, sampleRate = 22050): Uint8Array {
  return encodeWav(renderSegments([{ midi, seconds }], sampleRate, a4), sampleRate);
}

/** One WAV for a whole melody, so playback timing is sample-accurate. */
export function melodyWav(notes: Note[], bpm: number, a4 = 440, sampleRate = 22050): Uint8Array {
  const spb = 60 / bpm;
  const segs: Segment[] = [{ midi: null, seconds: 0.1 }];
  for (const n of notes) segs.push({ midi: n.rest ? null : n.midi, seconds: Math.max(0.12, n.beats * spb) });
  return encodeWav(renderSegments(segs, sampleRate, a4), sampleRate);
}
