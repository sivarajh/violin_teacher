// Live microphone pitch detection on iOS/Android using expo-audio's PCM stream.

import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { freqToMidi } from '../lib/notes';
import { detectPitch, PitchSmoother, SampleWindow } from '../lib/pitch';
import type { PitchListener, PitchReading } from './types';

export function usePitchListener(onReading: (r: PitchReading) => void, a4 = 440): PitchListener {
  const cb = useRef(onReading);
  const a4Ref = useRef(a4);
  useLayoutEffect(() => {
    cb.current = onReading;
    a4Ref.current = a4;
  });
  const windowRef = useRef(new SampleWindow(2048));
  const smoother = useRef(new PitchSmoother(5));
  const lastRun = useRef(0);

  const { stream, isStreaming } = useAudioStream({
    sampleRate: 24000,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buffer) => {
      const win = windowRef.current;
      let samples = new Float32Array(buffer.data);
      if (buffer.channels > 1) {
        const mono = new Float32Array(Math.floor(samples.length / buffer.channels));
        for (let i = 0; i < mono.length; i++) mono[i] = samples[i * buffer.channels];
        samples = mono;
      }
      win.push(samples);
      const now = performance.now();
      if (!win.ready || now - lastRun.current < 40) return;
      lastRun.current = now;
      const { freq, rms } = detectPitch(win.data, buffer.sampleRate);
      if (freq > 0) {
        const midi = smoother.current.push(freqToMidi(freq, a4Ref.current));
        cb.current({ freq, midi, rms, time: now });
      } else {
        smoother.current.push(null);
        cb.current({ freq: -1, midi: null, rms, time: now });
      }
    },
  });

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission was not granted. You can enable it in your device settings.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await stream.start();
  }, [stream]);

  const stop = useCallback(() => {
    try { stream.stop(); } catch { /* not running */ }
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  }, [stream]);

  useEffect(() => () => {
    try { stream.stop(); } catch { /* ignore */ }
  }, [stream]);

  return { start, stop, listening: isStreaming };
}
