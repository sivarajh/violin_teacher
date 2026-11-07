// Reference tones in the browser using the Web Audio API.

import { midiToFreq, type Note } from '../lib/notes';

export type StopFn = () => void;

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function scheduleTone(ac: AudioContext, midi: number, seconds: number, when: number, a4: number, volume = 0.25): StopFn {
  const t0 = ac.currentTime + when;
  const freq = midiToFreq(midi, a4);

  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  const lfo = ac.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoGain = ac.createGain();
  lfoGain.gain.setValueAtTime(0, t0);
  lfoGain.gain.linearRampToValueAtTime(freq * 0.004, t0 + Math.min(0.35, seconds * 0.5));
  lfo.connect(lfoGain).connect(osc.frequency);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(6000, freq * 6);
  filter.Q.value = 0.8;

  const body = ac.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 2800;
  body.gain.value = 4;

  const amp = ac.createGain();
  const attack = 0.06;
  const release = Math.min(0.15, seconds * 0.3);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(volume, t0 + attack);
  amp.gain.setValueAtTime(volume * 0.85, t0 + Math.max(attack, seconds - release));
  amp.gain.linearRampToValueAtTime(0, t0 + seconds);

  osc.connect(filter).connect(body).connect(amp).connect(ac.destination);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + seconds + 0.05);
  lfo.stop(t0 + seconds + 0.05);
  return () => {
    try {
      amp.gain.cancelScheduledValues(ac.currentTime);
      amp.gain.setValueAtTime(0, ac.currentTime);
      osc.stop();
      lfo.stop();
    } catch { /* already stopped */ }
  };
}

export async function playTone(midi: number, seconds = 1.2, a4 = 440): Promise<StopFn> {
  return scheduleTone(audioContext(), midi, seconds, 0, a4);
}

export async function playMelody(
  notes: Note[],
  bpm: number,
  { a4 = 440, onNote, onEnd }: { a4?: number; onNote?: (i: number) => void; onEnd?: () => void } = {},
): Promise<StopFn> {
  const ac = audioContext();
  const spb = 60 / bpm;
  const stops: StopFn[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0.1;
  notes.forEach((n, i) => {
    const dur = Math.max(0.12, n.beats * spb);
    if (!n.rest) stops.push(scheduleTone(ac, n.midi, dur * 0.95, t, a4));
    timers.push(setTimeout(() => onNote?.(i), t * 1000));
    t += dur;
  });
  timers.push(setTimeout(() => onEnd?.(), t * 1000));
  return () => {
    stops.forEach((s) => s());
    timers.forEach(clearTimeout);
  };
}
