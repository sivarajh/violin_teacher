// Parsers that turn uploaded sheet music into a flat list of notes.
// Note objects: { rest, step, alter, octave, midi, beats } where beats are quarter notes.

import { makeNote, makeRest, parseNoteList } from './notes.js';

/* ----------------------------------------------------------------- ABC */

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const MAJOR_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const MINOR_FIFTHS = { A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7, D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7 };
const MODE_SHIFT = { ion: 0, maj: 0, mix: -1, dor: -2, aeo: -3, min: -3, m: -3, phr: -4, loc: -5, lyd: 1 };

/** Key signature → map of step → alter, e.g. "D" → { F: 1, C: 1 }. */
export function keySignature(key) {
  const m = /^\s*([A-Ga-g])([#b]?)\s*([A-Za-z]*)/.exec(key || 'C');
  if (!m || /^none$/i.test((key || '').trim())) return {};
  const tonic = m[1].toUpperCase() + m[2];
  const modeRaw = m[3].toLowerCase();
  const mode = modeRaw === '' ? 'maj' : (modeRaw === 'm' ? 'm' : modeRaw.slice(0, 3));
  let fifths;
  if (mode === 'm' || mode === 'min' || mode === 'aeo') fifths = MINOR_FIFTHS[tonic];
  else {
    const base = MAJOR_FIFTHS[tonic];
    fifths = base == null ? undefined : base + (MODE_SHIFT[mode] ?? 0);
  }
  if (fifths == null) return {};
  const sig = {};
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((s) => { sig[s] = 1; });
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((s) => { sig[s] = -1; });
  // Explicit accidentals after the key, e.g. "K:D ^g".
  const extra = (key.slice(m[0].length).match(/(\^\^|\^|=|__|_)([A-Ga-g])/g)) || [];
  for (const e of extra) {
    const em = /(\^\^|\^|=|__|_)([A-Ga-g])/.exec(e);
    sig[em[2].toUpperCase()] = { '^^': 2, '^': 1, '=': 0, '_': -1, '__': -2 }[em[1]];
  }
  return sig;
}

function parseFraction(s, fallback) {
  const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(s || '');
  return m ? parseInt(m[1], 10) / parseInt(m[2], 10) : fallback;
}

export function parseABC(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  let title = '';
  let unit = null; // fraction of a whole note
  let meter = 4 / 4;
  let keySig = {};
  let tempo = null;
  const body = [];
  let inBody = false;

  for (const raw of lines) {
    const line = raw.replace(/(^|[^\\])%.*$/, '$1');
    const field = /^([A-Za-z]):\s*(.*)$/.exec(line);
    if (field) {
      const [, k, v] = field;
      if (k === 'T' && !title) title = v.trim();
      else if (k === 'L') unit = parseFraction(v, unit);
      else if (k === 'M') {
        if (/^C\|/.test(v.trim())) meter = 1;
        else if (/^C/.test(v.trim())) meter = 1;
        else meter = parseFraction(v, meter);
      } else if (k === 'Q') {
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
  if (unit == null) unit = meter < 0.75 ? 1 / 16 : 1 / 8;

  const notes = [];
  let barAcc = {};
  let tuplet = null; // { factor, remaining }
  let pendingBroken = 1; // duration multiplier for next note from '>' / '<'
  let tieNext = false;

  const pushNote = (note) => {
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

  for (const item of body) {
    if (typeof item === 'object') { keySig = item.keyChange; barAcc = {}; continue; }
    const s = item;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '"') { const j = s.indexOf('"', i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '!' || c === '+') { const j = s.indexOf(c, i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '{') { const j = s.indexOf('}', i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '[' && /^\[[A-Za-z]:/.test(s.slice(i))) {
        const j = s.indexOf(']', i);
        const inner = s.slice(i + 1, j < 0 ? s.length : j);
        if (inner[0] === 'K') { keySig = keySignature(inner.slice(2)); barAcc = {}; }
        if (inner[0] === 'L') unit = parseFraction(inner.slice(2), unit);
        i = j < 0 ? s.length : j + 1;
        continue;
      }
      if (c === '|' || c === ':' || c === ']') { barAcc = {}; i++; continue; }
      if (c === '-') { tieNext = true; i++; continue; }
      if (c === '(' && /\d/.test(s[i + 1] || '')) {
        const p = parseInt(s[i + 1], 10);
        const q = { 2: 3, 3: 2, 4: 3, 6: 2, 8: 3 }[p] ?? 2;
        tuplet = { factor: q / p, remaining: p };
        i += 2;
        continue;
      }
      if (c === '>' || c === '<') {
        let count = 0;
        while (s[i] === c) { count++; i++; }
        const prev = notes[notes.length - 1];
        const factor = 1 - Math.pow(0.5, count); // 0.5, 0.75, ...
        if (prev) prev.beats *= c === '>' ? 1 + factor : 1 - factor;
        pendingBroken = c === '>' ? 1 - factor : 1 + factor;
        continue;
      }

      // Chord: take the first (melody) note, skip the rest.
      let inChord = false;
      if (c === '[') { inChord = true; i++; }

      const nm = /^(\^\^|\^|__|_|=)?([A-Ga-gzxZ])([',]*)(\d*)(\/*)(\d*)/.exec(s.slice(i));
      if (!nm) { i += inChord ? 0 : 1; if (inChord) i = skipChord(s, i); continue; }
      i += nm[0].length;
      let len = unit;
      const num = nm[4] ? parseInt(nm[4], 10) : 1;
      let den = 1;
      if (nm[5]) den = nm[6] ? parseInt(nm[6], 10) : Math.pow(2, nm[5].length);
      len = (unit * num) / den;
      if (inChord) {
        i = skipChord(s, i);
        // Chord-level length after the closing bracket, e.g. [CEG]2
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

      const step = letter.toUpperCase();
      let octave = letter === letter.toUpperCase() ? 4 : 5;
      for (const ch of nm[3]) octave += ch === "'" ? 1 : -1;
      const accKey = step + octave;
      let alter;
      if (nm[1]) {
        alter = { '^^': 2, '^': 1, '=': 0, '_': -1, '__': -2 }[nm[1]];
        barAcc[accKey] = alter;
      } else if (accKey in barAcc) alter = barAcc[accKey];
      else alter = keySig[step] ?? 0;
      pushNote(makeNote(step, alter, octave, len * 4));
      continue;
    }
  }
  return { title, notes: notes.filter((n) => n.beats > 0), tempo };
}

function skipChord(s, i) {
  const j = s.indexOf(']', i);
  return j < 0 ? s.length : j + 1;
}

/* ------------------------------------------------------------ MusicXML */

function tag(xml, name) {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeEntities(m[1].trim()) : null;
}

function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function parseMusicXML(xml) {
  xml = String(xml).replace(/<!--[\s\S]*?-->/g, '');
  if (!/<score-partwise|<score-timewise/.test(xml)) throw new Error('This file does not look like MusicXML.');
  if (/<score-timewise/.test(xml)) throw new Error('Timewise MusicXML is not supported — please export as partwise MusicXML.');

  const title = tag(xml, 'work-title') || tag(xml, 'movement-title') || '';
  const partMatch = /<part\b[^>]*>([\s\S]*?)<\/part>/.exec(xml);
  if (!partMatch) throw new Error('No <part> found in the MusicXML file.');
  const part = partMatch[1];

  let tempo = null;
  const tempoMatch = /<sound\b[^>]*\btempo="([\d.]+)"/.exec(part);
  if (tempoMatch) tempo = Math.round(parseFloat(tempoMatch[1]));

  let divisions = 1;
  let melodyVoice = null;
  const notes = [];
  const re = /<divisions>\s*(\d+)\s*<\/divisions>|<note\b[^>]*>([\s\S]*?)<\/note>/g;
  let m;
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

    const dur = parseFloat(tag(body, 'duration') || '0');
    const beats = dur / divisions;
    if (!(beats > 0)) continue;

    if (/<rest\b/.test(body)) {
      notes.push(makeRest(beats));
      lastTieStart = false;
      continue;
    }
    const pitch = tag(body, 'pitch');
    if (!pitch) continue;
    const step = (tag(pitch, 'step') || 'C').toUpperCase();
    const alter = Math.round(parseFloat(tag(pitch, 'alter') || '0'));
    const octave = parseInt(tag(pitch, 'octave') || '4', 10);
    const note = makeNote(step, alter, octave, beats);

    const tieStop = /<tie\b[^>]*type="stop"/.test(body);
    const prev = notes[notes.length - 1];
    if (tieStop && lastTieStart && prev && !prev.rest && prev.midi === note.midi) {
      prev.beats += beats;
    } else {
      notes.push(note);
    }
    lastTieStart = /<tie\b[^>]*type="start"/.test(body);
  }
  return { title, notes, tempo };
}

/* ------------------------------------------------------- MXL (zip) */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Your browser cannot open compressed .mxl files. Please export uncompressed MusicXML (.musicxml).');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read entries of a zip archive. Returns Map<name, () => Promise<Uint8Array>>. */
export function readZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .mxl (zip) file.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = bytes.subarray(start, start + compSize);
    entries.set(name, async () => {
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error(`Unsupported zip compression method ${method}.`);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function parseMXL(buffer) {
  const entries = readZip(buffer);
  const dec = new TextDecoder();
  let rootPath = null;
  if (entries.has('META-INF/container.xml')) {
    const container = dec.decode(await entries.get('META-INF/container.xml')());
    const rm = /<rootfile\b[^>]*full-path="([^"]+)"/.exec(container);
    if (rm) rootPath = rm[1];
  }
  if (!rootPath || !entries.has(rootPath)) {
    rootPath = [...entries.keys()].find((n) => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n));
  }
  if (!rootPath) throw new Error('No MusicXML score found inside the .mxl file.');
  return parseMusicXML(dec.decode(await entries.get(rootPath)()));
}

/* ------------------------------------------------------- dispatch */

/** Guess the text format and parse it. */
export function parseText(text) {
  const t = String(text).trim();
  if (/<score-partwise|<score-timewise/.test(t)) return { format: 'MusicXML', ...parseMusicXML(t) };
  if (/^\s*(X|K):/m.test(t)) return { format: 'ABC', ...parseABC(t) };
  const { notes, errors } = parseNoteList(t);
  if (!notes.length) throw new Error('No notes found. Use ABC notation, MusicXML, or a note list like "G3 A3 B3 C4".');
  return { format: 'Note list', title: '', notes, tempo: null, errors };
}

/** Parse an uploaded File. Returns { kind: 'score', ... } or { kind: 'image', ... }. */
export async function parseFile(file) {
  const name = file.name || 'Untitled';
  const base = name.replace(/\.[^.]+$/, '');
  const lower = name.toLowerCase();
  if (/\.mxl$/.test(lower)) {
    const res = await parseMXL(await file.arrayBuffer());
    return { kind: 'score', format: 'MusicXML (compressed)', ...res, title: res.title || base };
  }
  if (/^image\//.test(file.type) || /\.(png|jpe?g|gif|webp|pdf)$/.test(lower) || file.type === 'application/pdf') {
    return { kind: 'image', title: base, mime: file.type || (lower.endsWith('.pdf') ? 'application/pdf' : 'image/*') };
  }
  const res = parseText(await file.text());
  return { kind: 'score', ...res, title: res.title || base };
}
