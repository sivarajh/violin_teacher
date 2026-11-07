// Audio output (reference tones, metronome) and microphone pitch listening.

import { detectPitch, PitchSmoother } from './pitch.js';
import { midiToFreq, freqToMidi } from './notes.js';

let ctx = null;

export function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Play a violin-like tone. Returns a stop() function. */
export function playTone(midi, seconds = 1, { when = 0, a4 = 440, volume = 0.25 } = {}) {
  const ac = audioContext();
  const t0 = ac.currentTime + when;
  const freq = midiToFreq(midi, a4);

  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  // Gentle delayed vibrato.
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

  const body = ac.createBiquadFilter(); // a little body resonance
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

export function click(when = 0, accent = false) {
  const ac = audioContext();
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  osc.frequency.value = accent ? 1600 : 1000;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.06);
}

/**
 * Play a sequence of notes. Calls onNote(index) as each note starts.
 * Returns a stop() function.
 */
export function playSequence(notes, bpm, { onNote, onEnd, a4 = 440 } = {}) {
  const spb = 60 / bpm;
  const stops = [];
  const timers = [];
  let t = 0.1;
  notes.forEach((n, i) => {
    const dur = n.beats * spb;
    if (!n.rest) stops.push(playTone(n.midi, Math.max(0.12, dur * 0.95), { when: t, a4 }));
    timers.push(setTimeout(() => onNote && onNote(i), t * 1000));
    t += dur;
  });
  timers.push(setTimeout(() => onEnd && onEnd(), t * 1000));
  return () => {
    stops.forEach((s) => s());
    timers.forEach(clearTimeout);
  };
}

/** Microphone listener that reports smoothed pitch readings. */
export class PitchListener {
  constructor(onReading) {
    this.onReading = onReading;
    this.smoother = new PitchSmoother(5);
    this.running = false;
    this.a4 = 440;
  }

  async start() {
    if (this.running) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not available in this browser. Open the app over https:// or http://localhost.');
    }
    const ac = audioContext();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.source = ac.createMediaStreamSource(this.stream);
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 4096;
    this.source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.running = true;
    this.lastTime = 0;
    const loop = (ts) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (ts - this.lastTime < 40) return; // ~25 readings per second
      this.lastTime = ts;
      this.analyser.getFloatTimeDomainData(this.buf);
      const { freq, clarity, rms } = detectPitch(this.buf.subarray(0, 2048), ac.sampleRate);
      if (freq > 0) {
        const midi = this.smoother.push(freqToMidi(freq, this.a4));
        this.onReading({ freq, midi, clarity, rms, time: ts });
      } else {
        this.smoother.push(null);
        this.onReading({ freq: -1, midi: null, clarity, rms, time: ts });
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.source) this.source.disconnect();
    this.stream = null;
  }
}
