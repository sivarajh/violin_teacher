// Live microphone pitch detection in the browser (getUserMedia + Web Audio).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { freqToMidi } from '../lib/notes';
import { detectPitch, PitchSmoother } from '../lib/pitch';
import { audioContext } from './tone.web';
import type { PitchListener, PitchReading } from './types';

export function usePitchListener(onReading: (r: PitchReading) => void, a4 = 440): PitchListener {
  const cb = useRef(onReading);
  const a4Ref = useRef(a4);
  useLayoutEffect(() => {
    cb.current = onReading;
    a4Ref.current = a4;
  });
  const [listening, setListening] = useState(false);
  const res = useRef<{ stream: MediaStream; source: MediaStreamAudioSourceNode; raf: number } | null>(null);

  const stop = useCallback(() => {
    const r = res.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    r.stream.getTracks().forEach((t) => t.stop());
    r.source.disconnect();
    res.current = null;
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (res.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available here. Open the app over https:// or http://localhost.');
    }
    const ac = audioContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const source = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const smoother = new PitchSmoother(5);
    let last = 0;
    const loop = (ts: number) => {
      if (!res.current) return;
      res.current.raf = requestAnimationFrame(loop);
      if (ts - last < 40) return;
      last = ts;
      analyser.getFloatTimeDomainData(buf);
      const { freq, rms } = detectPitch(buf, ac.sampleRate);
      const now = performance.now();
      if (freq > 0) {
        const midi = smoother.push(freqToMidi(freq, a4Ref.current));
        cb.current({ freq, midi, rms, time: now });
      } else {
        smoother.push(null);
        cb.current({ freq: -1, midi: null, rms, time: now });
      }
    };
    res.current = { stream, source, raf: requestAnimationFrame(loop) };
    setListening(true);
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop, listening };
}
