// Parsers that turn sheet music into a flat list of notes (beats = quarter notes).

import { strFromU8, unzipSync } from 'fflate';
import { makeNote, makeRest, parseNoteList, type Note, type PitchedNote, type Step } from './notes';

export type ParsedScore = { title: string; notes: Note[]; tempo: number | null; format: string; errors?: string[] };

/* ----------------------------------------------------------------- ABC */

const SHARP_ORDER: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const MAJOR_FIFTHS: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const MINOR_FIFTHS: Record<string, number> = { A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7, D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7 };
const MODE_SHIFT: Record<string, number> = { ion: 0, maj: 0, mix: -1, dor: -2, aeo: -3, min: -3, m: -3, phr: -4, loc: -5, lyd: 1 };
const ACC_ALTER: Record<string, number> = { '^^': 2, '^': 1, '=': 0, _: -1, __: -2 };

type KeySig = Partial<Record<Step, number>>;

/** Key signature → map of step → alter, e.g. "D" → { F: 1, C: 1 }. */
export function keySignature(key: string): KeySig {
  const m = /^\s*([A-Ga-g])([#b]?)\s*([A-Za-z]*)/.exec(key || 'C');
  if (!m || /^none$/i.test((key || '').trim())) return {};
  const tonic = m[1].toUpperCase() + m[2];
  const modeRaw = m[3].toLowerCase();
  const mode = modeRaw === '' ? 'maj' : modeRaw === 'm' ? 'm' : modeRaw.slice(0, 3);
  let fifths: number | undefined;
  if (mode === 'm' || mode === 'min' || mode === 'aeo') fifths = MINOR_FIFTHS[tonic];
  else {
    const base = MAJOR_FIFTHS[tonic];
    fifths = base == null ? undefined : base + (MODE_SHIFT[mode] ?? 0);
  }
  if (fifths == null) return {};
  const sig: KeySig = {};
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((s) => { sig[s] = 1; });
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((s) => { sig[s] = -1; });
  for (const e of key.slice(m[0].length).match(/(\^\^|\^|=|__|_)([A-Ga-g])/g) || []) {
    const em = /(\^\^|\^|=|__|_)([A-Ga-g])/.exec(e)!;
    sig[em[2].toUpperCase() as Step] = ACC_ALTER[em[1]];
  }
  return sig;
}

function parseFraction(s: string, fallback: number): number;
function parseFraction(s: string, fallback: number | null): number | null;
function parseFraction(s: string, fallback: number | null) {
  const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(s || '');
  return m ? parseInt(m[1], 10) / parseInt(m[2], 10) : fallback;
}

export function parseABC(text: string): Omit<ParsedScore, 'format'> {
  const lines = String(text).replace(/\r/g, '').split('\n');
  let title = '';
  let unit: number | null = null; // fraction of a whole note
  let meter = 1;
  let keySig: KeySig = {};
  let tempo: number | null = null;
  const body: (string | { keyChange: KeySig })[] = [];
  let inBody = false;

  for (const raw of lines) {
    const line = raw.replace(/(^|[^\\])%.*$/, '$1');
    const field = /^([A-Za-z]):\s*(.*)$/.exec(line);
    if (field) {
      const [, k, v] = field;
      if (k === 'T' && !title) title = v.trim();
      else if (k === 'L') unit = parseFraction(v, unit);
      else if (k === 'M') meter = /^C/.test(v.trim()) ? 1 : parseFraction(v, meter);
      else if (k === 'Q') {
        const qm = /(\d+)\s*$/.exec(v);
        if (qm) tempo = parseInt(qm[1], 10);
      } else if (k === 'K') {
        keySig = keySignature(v);
        if (inBody) body.push({ keyChange: keySignature(v) });
        inBody = true;
      }
      continue;
    }
    if (line.trim()) { inBody = true; body.push(line); }
  }
  let unitLen: number = unit ?? (meter < 0.75 ? 1 / 16 : 1 / 8);

  const notes: Note[] = [];
  let barAcc: Record<string, number> = {};
  let tuplet: { factor: number; remaining: number } | null = null;
  let pendingBroken = 1;
  let tieNext = false;

  const pushNote = (note: Note) => {
    if (tuplet) {
      note.beats *= tuplet.factor;
      if (--tuplet.remaining <= 0) tuplet = null;
    }
    note.beats *= pendingBroken;
    pendingBroken = 1;
    const prev = notes[notes.length - 1];
    if (tieNext && prev && !prev.rest && !note.rest && prev.midi === note.midi) prev.beats += note.beats;
    else notes.push(note);
    tieNext = false;
  };

  const skipTo = (s: string, ch: string, from: number) => {
    const j = s.indexOf(ch, from);
    return j < 0 ? s.length : j + 1;
  };

  for (const item of body) {
    if (typeof item === 'object') { keySig = item.keyChange; barAcc = {}; continue; }
    const s = item;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '"') { i = skipTo(s, '"', i + 1); continue; }
      if (c === '!' || c === '+') { i = skipTo(s, c, i + 1); continue; }
      if (c === '{') { i = skipTo(s, '}', i + 1); continue; }
      if (c === '[' && /^\[[A-Za-z]:/.test(s.slice(i))) {
        const end = skipTo(s, ']', i);
        const inner = s.slice(i + 1, end - 1);
        if (inner[0] === 'K') { keySig = keySignature(inner.slice(2)); barAcc = {}; }
        if (inner[0] === 'L') unitLen = parseFraction(inner.slice(2), unitLen);
        i = end;
        continue;
      }
      if (c === '|' || c === ':' || c === ']') { barAcc = {}; i++; continue; }
      if (c === '-') { tieNext = true; i++; continue; }
      if (c === '(' && /\d/.test(s[i + 1] || '')) {
        const p = parseInt(s[i + 1], 10);
        const q = ({ 2: 3, 3: 2, 4: 3, 6: 2, 8: 3 } as Record<number, number>)[p] ?? 2;
        tuplet = { factor: q / p, remaining: p };
        i += 2;
        continue;
      }
      if (c === '>' || c === '<') {
        let count = 0;
        while (s[i] === c) { count++; i++; }
        const prev = notes[notes.length - 1];
        const factor = 1 - Math.pow(0.5, count);
        if (prev) prev.beats *= c === '>' ? 1 + factor : 1 - factor;
        pendingBroken = c === '>' ? 1 - factor : 1 + factor;
        continue;
      }

      let inChord = false;
      if (c === '[') { inChord = true; i++; }

      const nm = /^(\^\^|\^|__|_|=)?([A-Ga-gzxZ])([',]*)(\d*)(\/*)(\d*)/.exec(s.slice(i));
      if (!nm) { i = inChord ? skipTo(s, ']', i) : i + 1; continue; }
      i += nm[0].length;
      const num = nm[4] ? parseInt(nm[4], 10) : 1;
      let den = 1;
      if (nm[5]) den = nm[6] ? parseInt(nm[6], 10) : Math.pow(2, nm[5].length);
      let len = (unitLen * num) / den;
      if (inChord) {
        i = skipTo(s, ']', i);
        const cl = /^(\d*)(\/*)(\d*)/.exec(s.slice(i));
        if (cl && cl[0]) {
          i += cl[0].length;
          const cn = cl[1] ? parseInt(cl[1], 10) : 1;
          const cd = cl[2] ? (cl[3] ? parseInt(cl[3], 10) : Math.pow(2, cl[2].length)) : 1;
          len = (len * cn) / cd;
        }
      }
      const letter = nm[2];
      if (letter === 'Z') { pushNote(makeRest(meter * 4 * num)); continue; }
      if (letter === 'z' || letter === 'x') { pushNote(makeRest(len * 4)); continue; }

      const step = letter.toUpperCase() as Step;
      let octave = letter === letter.toUpperCase() ? 4 : 5;
      for (const ch of nm[3]) octave += ch === "'" ? 1 : -1;
      const accKey = step + octave;
      let alter: number;
      if (nm[1]) {
        alter = ACC_ALTER[nm[1]];
        barAcc[accKey] = alter;
      } else if (accKey in barAcc) alter = barAcc[accKey];
      else alter = keySig[step] ?? 0;
      pushNote(makeNote(step, alter, octave, len * 4));
    }
  }
  return { title, notes: notes.filter((n) => n.beats > 0), tempo };
}

/* ------------------------------------------------------------ MusicXML */

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeEntities(m[1].trim()) : null;
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function parseMusicXML(input: string): Omit<ParsedScore, 'format'> {
  const xml = String(input).replace(/<!--[\s\S]*?-->/g, '');
  if (!/<score-partwise|<score-timewise/.test(xml)) throw new Error('This file does not look like MusicXML.');
  if (/<score-timewise/.test(xml)) throw new Error('Timewise MusicXML is not supported — please export as partwise MusicXML.');

  const title = tag(xml, 'work-title') || tag(xml, 'movement-title') || '';
  const partMatch = /<part\b[^>]*>([\s\S]*?)<\/part>/.exec(xml);
  if (!partMatch) throw new Error('No <part> found in the MusicXML file.');
  const part = partMatch[1];

  const tempoMatch = /<sound\b[^>]*\btempo="([\d.]+)"/.exec(part);
  const tempo = tempoMatch ? Math.round(parseFloat(tempoMatch[1])) : null;

  let divisions = 1;
  let melodyVoice: string | null = null;
  const notes: Note[] = [];
  const re = /<divisions>\s*(\d+)\s*<\/divisions>|<note\b[^>]*>([\s\S]*?)<\/note>/g;
  let m: RegExpExecArray | null;
  let lastTieStart = false;
  while ((m = re.exec(part))) {
    if (m[1]) { divisions = parseInt(m[1], 10) || 1; continue; }
    const body = m[2];
    if (/<chord\s*\/>/.test(body) || /<grace\b/.test(body) || /<cue\s*\/>/.test(body)) continue;
    const voice = tag(body, 'voice') || '1';
    if (melodyVoice == null) melodyVoice = voice;
    if (voice !== melodyVoice) continue;
    const staff = tag(body, 'staff');
    if (staff && staff !== '1') continue;

    const beats = parseFloat(tag(body, 'duration') || '0') / divisions;
    if (!(beats > 0)) continue;

    if (/<rest\b/.test(body)) {
      notes.push(makeRest(beats));
      lastTieStart = false;
      continue;
    }
    const pitch = tag(body, 'pitch');
    if (!pitch) continue;
    const step = (tag(pitch, 'step') || 'C').toUpperCase() as Step;
    const alter = Math.round(parseFloat(tag(pitch, 'alter') || '0'));
    const octave = parseInt(tag(pitch, 'octave') || '4', 10);
    const note = makeNote(step, alter, octave, beats);

    const tieStop = /<tie\b[^>]*type="stop"/.test(body);
    const prev = notes[notes.length - 1] as PitchedNote | undefined;
    if (tieStop && lastTieStart && prev && !prev.rest && prev.midi === note.midi) prev.beats += beats;
    else notes.push(note);
    lastTieStart = /<tie\b[^>]*type="start"/.test(body);
  }
  return { title, notes, tempo };
}

/** Compressed MusicXML (.mxl) is a zip archive. */
export function parseMXL(bytes: Uint8Array): Omit<ParsedScore, 'format'> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('Not a valid .mxl (zip) file.');
  }
  let rootPath: string | undefined;
  const container = entries['META-INF/container.xml'];
  if (container) rootPath = /<rootfile\b[^>]*full-path="([^"]+)"/.exec(strFromU8(container))?.[1];
  if (!rootPath || !entries[rootPath]) {
    rootPath = Object.keys(entries).find((n) => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n));
  }
  if (!rootPath) throw new Error('No MusicXML score found inside the .mxl file.');
  return parseMusicXML(strFromU8(entries[rootPath]));
}

/* ------------------------------------------------------- dispatch */

/** Guess the text format and parse it. */
export function parseText(text: string): ParsedScore {
  const t = String(text).trim();
  if (/<score-partwise|<score-timewise/.test(t)) return { format: 'MusicXML', ...parseMusicXML(t) };
  if (/^\s*(X|K):/m.test(t)) return { format: 'ABC', ...parseABC(t) };
  const { notes, errors } = parseNoteList(t);
  if (!notes.length) throw new Error('No notes found. Use ABC notation, MusicXML, or a note list like "G3 A3 B3 C4".');
  return { format: 'Note list', title: '', notes, tempo: null, errors };
}

export type FileKind = 'mxl' | 'image' | 'pdf' | 'text';

export function classifyFile(name: string, mime?: string | null): FileKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.mxl')) return 'mxl';
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if ((mime && mime.startsWith('image/')) || /\.(png|jpe?g|gif|webp|heic)$/.test(lower)) return 'image';
  return 'text';
}
