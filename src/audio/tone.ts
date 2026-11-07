// Reference tones on iOS/Android: synthesize WAV files and play them with expo-audio.

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import type { Note } from '../lib/notes';
import { melodyWav, toneWav } from '../lib/wav';

let modeReady: Promise<void> | null = null;
function ensurePlaybackMode() {
  if (!modeReady) modeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  return modeReady;
}

async function writeWav(name: string, make: () => Uint8Array, reuse: boolean): Promise<string> {
  const file = new File(Paths.cache, name);
  if (file.exists) {
    if (reuse) return file.uri;
    file.delete();
  }
  try {
    file.create();
    await file.write(make());
  } catch (err) {
    if (file.exists) file.delete();
    throw err;
  }
  return file.uri;
}

export type StopFn = () => void;

/** Play one note. Resolves to a function that stops it early. */
export async function playTone(midi: number, seconds = 1.2, a4 = 440): Promise<StopFn> {
  await ensurePlaybackMode();
  const uri = await writeWav(`tone-${midi}-${Math.round(seconds * 1000)}-${a4}.wav`, () => toneWav(midi, seconds, a4), true);
  const player = createAudioPlayer({ uri });
  player.play();
  let removed = false;
  const stop = () => {
    if (removed) return;
    removed = true;
    try { player.pause(); player.remove(); } catch { /* already released */ }
  };
  setTimeout(stop, seconds * 1000 + 600);
  return stop;
}

/**
 * Play a melody. `onNote(i)` fires as each note starts (tracked from the player's clock),
 * `onEnd` when finished. Resolves to a stop function.
 */
export async function playMelody(
  notes: Note[],
  bpm: number,
  { a4 = 440, onNote, onEnd }: { a4?: number; onNote?: (i: number) => void; onEnd?: () => void } = {},
): Promise<StopFn> {
  await ensurePlaybackMode();
  const uri = await writeWav(`melody-${Date.now()}.wav`, () => melodyWav(notes, bpm, a4), false);
  const spb = 60 / bpm;
  const starts: number[] = [];
  let t = 0.1;
  for (const n of notes) { starts.push(t); t += Math.max(0.12, n.beats * spb); }
  const total = t;

  const player = createAudioPlayer({ uri });
  player.play();
  let last = -1;
  let finished = false;
  const startedAt = Date.now();
  const finish = (callEnd: boolean) => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    try { player.pause(); player.remove(); } catch { /* ignore */ }
    try { new File(uri).delete(); } catch { /* ignore */ }
    if (callEnd) onEnd?.();
  };
  const timer = setInterval(() => {
    const pos = player.currentTime || 0;
    let idx = last;
    while (idx + 1 < starts.length && pos >= starts[idx + 1]) idx++;
    if (idx !== last && idx >= 0) { last = idx; onNote?.(idx); }
    const wall = (Date.now() - startedAt) / 1000;
    if (pos >= total - 0.05 || wall > total + 3) finish(true);
  }, 40);
  return () => finish(false);
}
