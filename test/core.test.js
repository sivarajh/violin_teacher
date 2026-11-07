import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';

import { fingeringFor, parseNoteName, parseNoteList, toNoteList, midiToName, freqToMidi, noteLabel } from '../js/notes.js';
import { detectPitch } from '../js/pitch.js';
import { parseABC, parseMusicXML, parseMXL, parseText, keySignature } from '../js/parsers.js';
import { feedbackFor, PracticeSession } from '../js/coach.js';

const names = (notes) => notes.map((n) => (n.rest ? 'R' : midiToName(n.midi)));

test('note names parse to MIDI', () => {
  assert.equal(parseNoteName('A4').midi, 69);
  assert.equal(parseNoteName('C#5').midi, 73);
  assert.equal(parseNoteName('Bb3').midi, 58);
  assert.equal(parseNoteName('G3').midi, 55);
  assert.equal(parseNoteName('nope'), null);
});

test('first-position fingering', () => {
  const f = (n) => fingeringFor(parseNoteName(n).midi);
  assert.deepEqual([f('G3').string, f('G3').finger], ['G', 0]);
  assert.deepEqual([f('B4').string, f('B4').finger], ['A', 1]);
  assert.deepEqual([f('C#5').string, f('C#5').finger, f('C#5').offset], ['A', 2, 4]);
  assert.deepEqual([f('C5').string, f('C5').finger, f('C5').offset], ['A', 2, 3]);
  assert.deepEqual([f('D5').string, f('D5').finger], ['A', 3]);
  assert.deepEqual([f('E5').string, f('E5').finger], ['E', 0]); // prefer open string
  assert.deepEqual([f('B5').string, f('B5').finger], ['E', 4]);
  assert.equal(f('C6').inRange, false);
  assert.equal(f('F3').inRange, false);
});

test('note list round trip', () => {
  const { notes, errors } = parseNoteList('G3 A3:2 R/2 F#4 xyz');
  assert.deepEqual(errors, ['xyz']);
  assert.deepEqual(notes.map((n) => n.beats), [1, 2, 0.5, 1]);
  assert.equal(toNoteList(notes), 'G3 A3:2 R:0.5 F#4');
});

function sine(freq, sr = 44100, n = 2048, harmonics = [1]) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((amp, h) => { v += amp * Math.sin((2 * Math.PI * freq * (h + 1) * i) / sr); });
    buf[i] = 0.3 * v;
  }
  return buf;
}

test('pitch detection finds violin pitches', () => {
  for (const f of [196, 293.66, 440, 659.25, 987.77, 1318.5]) {
    const { freq } = detectPitch(sine(f), 44100);
    const cents = Math.abs(1200 * Math.log2(freq / f));
    assert.ok(cents < 5, `expected ${f} Hz, got ${freq} (${cents.toFixed(1)}¢)`);
  }
});

test('pitch detection handles harmonic-rich (violin-like) tones without octave errors', () => {
  // Strong 2nd harmonic, like a bowed string.
  for (const f of [196, 220, 440]) {
    const { freq } = detectPitch(sine(f, 48000, 2048, [0.6, 1, 0.5, 0.3, 0.2]), 48000);
    assert.equal(Math.round(freqToMidi(freq)), Math.round(freqToMidi(f)), `${f} detected as ${freq}`);
  }
});

test('pitch detection reports silence', () => {
  assert.equal(detectPitch(new Float32Array(2048), 44100).freq, -1);
});

test('ABC: key signature, octaves, lengths and accidentals', () => {
  assert.deepEqual(keySignature('D'), { F: 1, C: 1 });
  assert.deepEqual(keySignature('Gm'), { B: -1, E: -1 });
  assert.deepEqual(keySignature('ADor'), { F: 1 });
  const { title, notes } = parseABC(`X:1\nT:Test\nM:4/4\nL:1/8\nK:D\nD2 F A d | c =c ^c2 | A,4 z4 |]`);
  assert.equal(title, 'Test');
  assert.deepEqual(names(notes), ['D4', 'F#4', 'A4', 'D5', 'C#5', 'C5', 'C#5', 'A3', 'R']);
  assert.deepEqual(notes.map((n) => n.beats), [1, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 2, 2]);
});

test('ABC: broken rhythm, ties, chords and triplets', () => {
  const { notes } = parseABC('L:1/4\nK:C\nA>B c-|c [CEG]2 (3ABc');
  assert.deepEqual(names(notes), ['A4', 'B4', 'C5', 'C4', 'A4', 'B4', 'C5']);
  const beats = notes.map((n) => +n.beats.toFixed(3));
  assert.deepEqual(beats, [1.5, 0.5, 2, 2, 0.667, 0.667, 0.667]);
});

test('ABC sample file parses', () => {
  const { title, notes } = parseText(readFileSync(new URL('../samples/ode-to-joy.abc', import.meta.url), 'utf8'));
  assert.equal(title, 'Ode to Joy');
  assert.equal(names(notes).slice(0, 4).join(' '), 'F#4 F#4 G4 A4');
  assert.equal(notes.reduce((a, n) => a + n.beats, 0), 64);
});

const XML = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Mini &amp; Test</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>1</voice></note>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><tie type="start"/></note>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><tie type="stop"/></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      <note><chord/><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
      <note><rest/><duration>4</duration><voice>1</voice></note>
      <backup><duration>16</duration></backup>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>16</duration><voice>2</voice></note>
    </measure>
  </part>
</score-partwise>`;

test('MusicXML: ties merge, chords and other voices skipped', () => {
  const { title, notes } = parseMusicXML(XML);
  assert.equal(title, 'Mini & Test');
  assert.deepEqual(names(notes), ['G3', 'F#4', 'A4', 'R']);
  assert.deepEqual(notes.map((n) => n.beats), [1, 1, 1, 1]);
  assert.equal(noteLabel(notes[1]), 'F♯4');
});

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(text);
    const data = deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, data);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

test('compressed .mxl files are unzipped', async () => {
  const zip = makeZip([
    ['META-INF/container.xml', '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'],
    ['score.xml', XML],
  ]);
  const { notes } = await parseMXL(new Uint8Array(zip).buffer);
  assert.deepEqual(names(notes), ['G3', 'F#4', 'A4', 'R']);
});

test('MusicXML sample file parses', () => {
  const { title, notes, tempo } = parseText(readFileSync(new URL('../samples/hot-cross-buns.musicxml', import.meta.url), 'utf8'));
  assert.equal(title, 'Hot Cross Buns');
  assert.equal(tempo, 88);
  assert.equal(names(notes).slice(0, 3).join(' '), 'C#5 B4 A4');
});

test('teacher feedback', () => {
  const a = parseNoteName('A4');
  const b = parseNoteName('B4');
  assert.equal(feedbackFor(a, 69.1).status, 'in-tune');
  assert.equal(feedbackFor(b, 71.4).status, 'sharp');
  assert.match(feedbackFor(b, 71.4).message, /toward the scroll/);
  assert.equal(feedbackFor(b, 70.6).status, 'flat');
  assert.match(feedbackFor(b, 70.6).message, /toward the bridge/);
  assert.match(feedbackFor(a, 69.4).message, /tuning down/); // open string sharp → tune
  assert.equal(feedbackFor(a, 81).status, 'octave');
  const wrong = feedbackFor(b, 74);
  assert.equal(wrong.status, 'wrong-note');
  assert.match(wrong.message, /1st finger on the A string/);
});

test('practice session advances after holding the note in tune', () => {
  const { notes } = parseNoteList('A4 B4 R C#5');
  const s = new PracticeSession(notes, { tolerance: 25, holdMs: 300 });
  let t = 0;
  assert.equal(s.handleReading(69.0, t).status, 'in-tune');
  assert.ok(!s.handleReading(69.0, (t += 200)).advanced);
  assert.ok(s.handleReading(69.0, (t += 150)).advanced);
  assert.equal(s.index, 1);
  s.handleReading(72, (t += 100)); // wrong notes
  s.handleReading(72, (t += 100));
  s.handleReading(72, (t += 100));
  s.handleReading(71, (t += 100));
  assert.ok(s.handleReading(71, (t += 400)).advanced);
  s.skip(t); // rest
  s.skip(t); // skip C#5
  assert.ok(s.done);
  const sum = s.summary();
  assert.equal(sum.played, 2);
  assert.equal(sum.skipped, 1);
  assert.equal(sum.firstTry, 1);
  assert.equal(sum.accuracy, 50);
  assert.ok(sum.tips.length > 0);
});
