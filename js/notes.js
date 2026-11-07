// Music theory helpers and violin first-position fingering.

const STEP_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const STRINGS = [
  { name: 'G', midi: 55 },
  { name: 'D', midi: 62 },
  { name: 'A', midi: 69 },
  { name: 'E', midi: 76 },
];

export function midiFromParts(step, alter, octave) {
  return (octave + 1) * 12 + STEP_SEMITONE[step] + alter;
}

/** Make a note object from spelled pitch. */
export function makeNote(step, alter, octave, beats = 1) {
  return { rest: false, step, alter, octave, midi: midiFromParts(step, alter, octave), beats };
}

export function makeRest(beats = 1) {
  return { rest: true, beats };
}

/** Parse names like "A4", "C#5", "Bb3", "F♯4", "Ebb4". */
export function parseNoteName(str) {
  const m = /^([A-Ga-g])(##|bb|#|b|♯|♭|x)?(-?\d)$/.exec(String(str).trim());
  if (!m) return null;
  const step = m[1].toUpperCase();
  const acc = m[2] || '';
  const alter = { '': 0, '#': 1, '♯': 1, '##': 2, x: 2, b: -1, '♭': -1, bb: -2 }[acc];
  const octave = parseInt(m[3], 10);
  return makeNote(step, alter, octave);
}

export function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiToName(midi) {
  const m = Math.round(midi);
  return SHARP_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

const ACC_SYMBOL = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

/** Human label that keeps the written spelling, e.g. "F♯4". */
export function noteLabel(note) {
  if (note.rest) return 'Rest';
  return note.step + ACC_SYMBOL[note.alter] + note.octave;
}

/** Diatonic staff index (C4 = 28, E4 = 30 = bottom line of the treble staff). */
export function staffIndex(note) {
  return note.octave * 7 + STEP_INDEX[note.step];
}

const OFFSET_FINGER = {
  0: { finger: 0, text: 'open string' },
  1: { finger: 1, text: 'low 1st finger (right up near the nut)' },
  2: { finger: 1, text: '1st finger' },
  3: { finger: 2, text: 'low 2nd finger (touching your 1st finger)' },
  4: { finger: 2, text: 'high 2nd finger (touching your 3rd finger)' },
  5: { finger: 3, text: '3rd finger' },
  6: { finger: 3, text: 'high 3rd finger (stretch slightly toward the bridge)' },
  7: { finger: 4, text: '4th finger' },
};

/**
 * First-position fingering for a MIDI pitch.
 * Returns { string, finger, offset, text, inRange, alt? }.
 */
export function fingeringFor(midi) {
  if (midi < STRINGS[0].midi) {
    return { inRange: false, string: null, finger: null, offset: null,
      text: 'This note is below the violin\'s lowest string (G). Try playing it an octave higher.' };
  }
  for (let i = 0; i < STRINGS.length; i++) {
    const s = STRINGS[i];
    const offset = midi - s.midi;
    const isLast = i === STRINGS.length - 1;
    if (offset >= 0 && (offset <= 6 || (isLast && offset === 7))) {
      const f = OFFSET_FINGER[offset];
      const out = { inRange: true, string: s.name, stringIndex: i, finger: f.finger, offset, text: f.text };
      if (offset === 0 && i > 0) out.alt = `or 4th finger on the ${STRINGS[i - 1].name} string`;
      return out;
    }
  }
  const above = midi - (STRINGS[3].midi + 7);
  return { inRange: false, string: 'E', stringIndex: 3, finger: null, offset: midi - STRINGS[3].midi,
    text: `Above first position (${above} semitone${above > 1 ? 's' : ''} past B5) — shift your hand up the E string.` };
}

export function describeFingering(midi) {
  const f = fingeringFor(midi);
  if (!f.inRange) return f.text;
  const base = f.finger === 0 ? `Open ${f.string} string` : `${capitalize(f.text)} on the ${f.string} string`;
  return f.alt ? `${base} (${f.alt})` : base;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse a simple space separated note list: "G3 A3 B3:2 R C4/2 D4". */
export function parseNoteList(text) {
  const notes = [];
  const errors = [];
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
export function toNoteList(notes) {
  return notes.map((n) => {
    const name = n.rest ? 'R' : n.step + ({ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' })[n.alter] + n.octave;
    return n.beats === 1 ? name : `${name}:${+n.beats.toFixed(3)}`;
  }).join(' ');
}
