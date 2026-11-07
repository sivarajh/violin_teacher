// Music theory helpers and violin first-position fingering.

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type PitchedNote = {
  rest: false;
  step: Step;
  alter: number;
  octave: number;
  midi: number;
  /** Length in quarter-note beats. */
  beats: number;
};
export type RestNote = { rest: true; beats: number };
export type Note = PitchedNote | RestNote;

const STEP_SEMITONE: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEP_INDEX: Record<Step, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const STRINGS = [
  { name: 'G', midi: 55 },
  { name: 'D', midi: 62 },
  { name: 'A', midi: 69 },
  { name: 'E', midi: 76 },
] as const;

export function midiFromParts(step: Step, alter: number, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONE[step] + alter;
}

export function makeNote(step: Step, alter: number, octave: number, beats = 1): PitchedNote {
  return { rest: false, step, alter, octave, midi: midiFromParts(step, alter, octave), beats };
}

export function makeRest(beats = 1): RestNote {
  return { rest: true, beats };
}

/** Parse names like "A4", "C#5", "Bb3", "F♯4", "Ebb4". */
export function parseNoteName(str: string): PitchedNote | null {
  const m = /^([A-Ga-g])(##|bb|#|b|♯|♭|x)?(-?\d)$/.exec(String(str).trim());
  if (!m) return null;
  const step = m[1].toUpperCase() as Step;
  const alter = ({ '': 0, '#': 1, '♯': 1, '##': 2, x: 2, b: -1, '♭': -1, bb: -2 } as Record<string, number>)[m[2] || ''];
  return makeNote(step, alter, parseInt(m[3], 10));
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Name for a MIDI number, e.g. 61 → "C#4" (or "Db4" with flats). */
export function midiToName(midi: number, flats = false): string {
  const m = Math.round(midi);
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/** Pretty version with ♯/♭ symbols. */
export function prettyName(name: string): string {
  return name.replace('#', '♯').replace(/([A-G])b/, '$1♭');
}

const ACC_SYMBOL: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** Human label that keeps the written spelling, e.g. "F♯4". */
export function noteLabel(note: Note): string {
  if (note.rest) return 'Rest';
  return note.step + ACC_SYMBOL[note.alter] + note.octave;
}

/** Diatonic staff index (C4 = 28, E4 = 30 = bottom line of the treble staff). */
export function staffIndex(note: PitchedNote): number {
  return note.octave * 7 + STEP_INDEX[note.step];
}

export type Fingering = {
  inRange: boolean;
  string: string | null;
  stringIndex: number | null;
  finger: number | null;
  offset: number | null;
  text: string;
  alt?: string;
};

const OFFSET_FINGER: Record<number, { finger: number; text: string }> = {
  0: { finger: 0, text: 'open string' },
  1: { finger: 1, text: 'low 1st finger (right up near the nut)' },
  2: { finger: 1, text: '1st finger' },
  3: { finger: 2, text: 'low 2nd finger (touching your 1st finger)' },
  4: { finger: 2, text: 'high 2nd finger (touching your 3rd finger)' },
  5: { finger: 3, text: '3rd finger' },
  6: { finger: 3, text: 'high 3rd finger (stretch slightly toward the bridge)' },
  7: { finger: 4, text: '4th finger' },
};

/** First-position fingering for a MIDI pitch. */
export function fingeringFor(midi: number): Fingering {
  if (midi < STRINGS[0].midi) {
    return { inRange: false, string: null, stringIndex: null, finger: null, offset: null,
      text: "This note is below the violin's lowest string (G). Try playing it an octave higher." };
  }
  for (let i = 0; i < STRINGS.length; i++) {
    const s = STRINGS[i];
    const offset = midi - s.midi;
    const isLast = i === STRINGS.length - 1;
    if (offset >= 0 && (offset <= 6 || (isLast && offset === 7))) {
      const f = OFFSET_FINGER[offset];
      const out: Fingering = { inRange: true, string: s.name, stringIndex: i, finger: f.finger, offset, text: f.text };
      if (offset === 0 && i > 0) out.alt = `or 4th finger on the ${STRINGS[i - 1].name} string`;
      return out;
    }
  }
  const above = midi - (STRINGS[3].midi + 7);
  return { inRange: false, string: 'E', stringIndex: 3, finger: null, offset: midi - STRINGS[3].midi,
    text: `Above first position (${above} semitone${above > 1 ? 's' : ''} past B5) — shift your hand up the E string.` };
}

export function describeFingering(midi: number): string {
  const f = fingeringFor(midi);
  if (!f.inRange) return f.text;
  const base = f.finger === 0 ? `Open ${f.string} string` : `${capitalize(f.text)} on the ${f.string} string`;
  return f.alt ? `${base} (${f.alt})` : base;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse a simple space separated note list: "G3 A3 B3:2 R C4/2 D4". */
export function parseNoteList(text: string): { notes: Note[]; errors: string[] } {
  const notes: Note[] = [];
  const errors: string[] = [];
  const tokens = String(text).replace(/[|,]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const m = /^([^:/]+)(?:[:]([\d.]+)|\/([\d.]+))?$/.exec(tok);
    if (!m) { errors.push(tok); continue; }
    let beats = 1;
    if (m[2]) beats = parseFloat(m[2]);
    if (m[3]) beats = 1 / parseFloat(m[3]);
    if (!(beats > 0)) { errors.push(tok); continue; }
    if (/^(r|rest|z)$/i.test(m[1])) { notes.push(makeRest(beats)); continue; }
    const n = parseNoteName(m[1]);
    if (!n) { errors.push(tok); continue; }
    n.beats = beats;
    notes.push(n);
  }
  return { notes, errors };
}

/** Serialize notes back into the simple list format. */
export function toNoteList(notes: Note[]): string {
  return notes.map((n) => {
    const name = n.rest ? 'R' : n.step + ({ [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' } as Record<number, string>)[n.alter] + n.octave;
    return n.beats === 1 ? name : `${name}:${+n.beats.toFixed(3)}`;
  }).join(' ');
}
