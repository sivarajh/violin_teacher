import { expect, test } from '@jest/globals';
import { strToU8, zipSync } from 'fflate';
import { feedbackFor, PracticeSession } from '../coach';
import { LESSONS } from '../lessons';
import { fingeringFor, freqToMidi, midiToName, noteLabel, parseNoteList, parseNoteName, toNoteList, type Note } from '../notes';
import { classifyFile, keySignature, parseABC, parseMusicXML, parseMXL, parseText } from '../parsers';
import { detectPitch, SampleWindow } from '../pitch';
import { SAMPLES } from '../samples';
import { melodyWav, toneWav } from '../wav';

const names = (notes: Note[]) => notes.map((n) => (n.rest ? 'R' : midiToName(n.midi)));
const pn = (s: string) => parseNoteName(s)!;

test('note names parse to MIDI', () => {
  expect(pn('A4').midi).toBe(69);
  expect(pn('C#5').midi).toBe(73);
  expect(pn('Bb3').midi).toBe(58);
  expect(pn('G3').midi).toBe(55);
  expect(parseNoteName('nope')).toBeNull();
  expect(midiToName(61, true)).toBe('Db4');
});

test('first-position fingering', () => {
  const f = (n: string) => fingeringFor(pn(n).midi);
  expect([f('G3').string, f('G3').finger]).toEqual(['G', 0]);
  expect([f('B4').string, f('B4').finger]).toEqual(['A', 1]);
  expect([f('C#5').string, f('C#5').finger, f('C#5').offset]).toEqual(['A', 2, 4]);
  expect([f('C5').string, f('C5').finger, f('C5').offset]).toEqual(['A', 2, 3]);
  expect([f('D5').string, f('D5').finger]).toEqual(['A', 3]);
  expect([f('E5').string, f('E5').finger]).toEqual(['E', 0]);
  expect([f('B5').string, f('B5').finger]).toEqual(['E', 4]);
  expect(f('C6').inRange).toBe(false);
  expect(f('F3').inRange).toBe(false);
});

test('note list round trip', () => {
  const { notes, errors } = parseNoteList('G3 A3:2 R/2 F#4 xyz');
  expect(errors).toEqual(['xyz']);
  expect(notes.map((n) => n.beats)).toEqual([1, 2, 0.5, 1]);
  expect(toNoteList(notes)).toBe('G3 A3:2 R:0.5 F#4');
});

function wave(freq: number, sr = 44100, n = 2048, harmonics = [1]) {
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
    const { freq } = detectPitch(wave(f), 44100);
    expect(Math.abs(1200 * Math.log2(freq / f))).toBeLessThan(5);
  }
});

test('pitch detection handles harmonic-rich tones at the phone sample rate', () => {
  for (const f of [196, 220, 440, 880]) {
    const { freq } = detectPitch(wave(f, 24000, 2048, [0.6, 1, 0.5, 0.3, 0.2]), 24000);
    expect(Math.round(freqToMidi(freq))).toBe(Math.round(freqToMidi(f)));
  }
});

test('pitch detection reports silence', () => {
  expect(detectPitch(new Float32Array(2048), 44100).freq).toBe(-1);
});

test('sample window keeps the latest samples', () => {
  const w = new SampleWindow(4);
  w.push(new Float32Array([1, 2, 3]));
  expect(w.ready).toBe(false);
  w.push(new Float32Array([4, 5]));
  expect(w.ready).toBe(true);
  expect(Array.from(w.data)).toEqual([2, 3, 4, 5]);
  w.push(new Float32Array([6, 7, 8, 9, 10]));
  expect(Array.from(w.data)).toEqual([7, 8, 9, 10]);
});

test('synthesized reference tones are detected at the right pitch', () => {
  const wav = toneWav(69, 0.5, 440, 22050);
  expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
  const dv = new DataView(wav.buffer);
  const samples = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) samples[i] = dv.getInt16(44 + (3000 + i) * 2, true) / 32768;
  const { freq } = detectPitch(samples, 22050);
  expect(Math.abs(1200 * Math.log2(freq / 440))).toBeLessThan(15); // vibrato allows a little drift
  const mel = melodyWav(parseNoteList('A4 B4:2').notes, 60, 440, 8000);
  expect(mel.length).toBe(44 + Math.ceil((0.1 + 1 + 2) * 8000) * 2);
});

test('ABC: key signature, octaves, lengths and accidentals', () => {
  expect(keySignature('D')).toEqual({ F: 1, C: 1 });
  expect(keySignature('Gm')).toEqual({ B: -1, E: -1 });
  expect(keySignature('ADor')).toEqual({ F: 1 });
  const { title, notes } = parseABC('X:1\nT:Test\nM:4/4\nL:1/8\nK:D\nD2 F A d | c =c ^c2 | A,4 z4 |]');
  expect(title).toBe('Test');
  expect(names(notes)).toEqual(['D4', 'F#4', 'A4', 'D5', 'C#5', 'C5', 'C#5', 'A3', 'R']);
  expect(notes.map((n) => n.beats)).toEqual([1, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 2, 2]);
});

test('ABC: broken rhythm, ties, chords and triplets', () => {
  const { notes } = parseABC('L:1/4\nK:C\nA>B c-|c [CEG]2 (3ABc');
  expect(names(notes)).toEqual(['A4', 'B4', 'C5', 'C4', 'A4', 'B4', 'C5']);
  expect(notes.map((n) => +n.beats.toFixed(3))).toEqual([1.5, 0.5, 2, 2, 0.667, 0.667, 0.667]);
});

test('bundled samples parse', () => {
  const ode = parseText(SAMPLES[0].text);
  expect(ode.title).toBe('Ode to Joy');
  expect(names(ode.notes).slice(0, 4).join(' ')).toBe('F#4 F#4 G4 A4');
  expect(ode.notes.reduce((a, n) => a + n.beats, 0)).toBe(64);
  const buns = parseText(SAMPLES[1].text);
  expect(buns.title).toBe('Hot Cross Buns');
  expect(buns.tempo).toBe(88);
  expect(names(buns.notes).slice(0, 3).join(' ')).toBe('C#5 B4 A4');
});

test('every lesson exercise parses cleanly', () => {
  for (const l of LESSONS) {
    if (!l.exercise) continue;
    expect(parseNoteList(l.exercise).errors).toEqual([]);
  }
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
  expect(title).toBe('Mini & Test');
  expect(names(notes)).toEqual(['G3', 'F#4', 'A4', 'R']);
  expect(notes.map((n) => n.beats)).toEqual([1, 1, 1, 1]);
  expect(noteLabel(notes[1])).toBe('F♯4');
});

test('compressed .mxl files are unzipped', () => {
  const zip = zipSync({
    'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'),
    'score.xml': strToU8(XML),
  });
  expect(names(parseMXL(zip).notes)).toEqual(['G3', 'F#4', 'A4', 'R']);
  expect(() => parseMXL(new Uint8Array([1, 2, 3]))).toThrow(/valid/);
});

test('file classification', () => {
  expect(classifyFile('song.mxl')).toBe('mxl');
  expect(classifyFile('page.PDF')).toBe('pdf');
  expect(classifyFile('IMG_1.HEIC')).toBe('image');
  expect(classifyFile('x', 'image/jpeg')).toBe('image');
  expect(classifyFile('tune.abc')).toBe('text');
});

test('teacher feedback', () => {
  const a = pn('A4');
  const b = pn('B4');
  expect(feedbackFor(a, 69.1).status).toBe('in-tune');
  expect(feedbackFor(b, 71.4).status).toBe('sharp');
  expect(feedbackFor(b, 71.4).message).toMatch(/toward the scroll/);
  expect(feedbackFor(b, 70.6).status).toBe('flat');
  expect(feedbackFor(b, 70.6).message).toMatch(/toward the bridge/);
  expect(feedbackFor(a, 69.4).message).toMatch(/tuning down/);
  expect(feedbackFor(a, 81).status).toBe('octave');
  const wrong = feedbackFor(b, 74);
  expect(wrong.status).toBe('wrong-note');
  expect(wrong.message).toMatch(/1st finger on the A string/);
});

test('practice session advances after holding the note in tune', () => {
  const s = new PracticeSession(parseNoteList('A4 B4 R C#5').notes, { tolerance: 25, holdMs: 300 });
  let t = 0;
  expect(s.handleReading(69.0, t).status).toBe('in-tune');
  expect(s.handleReading(69.0, (t += 200)).advanced).toBeFalsy();
  expect(s.handleReading(69.0, (t += 150)).advanced).toBe(true);
  expect(s.index).toBe(1);
  for (let k = 0; k < 3; k++) s.handleReading(72, (t += 100));
  s.handleReading(71, (t += 100));
  expect(s.handleReading(71, (t += 400)).advanced).toBe(true);
  s.skip(t); // rest
  s.skip(t); // C#5
  expect(s.done).toBe(true);
  const sum = s.summary();
  expect(sum).toMatchObject({ played: 2, skipped: 1, firstTry: 1, accuracy: 50 });
  expect(sum.tips.length).toBeGreaterThan(0);
  s.back(t);
  expect(s.index).toBe(3);
  expect(s.results.length).toBe(2);
});
