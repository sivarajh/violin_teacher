// SVG renderers: a treble staff for the piece and a first-position fingerboard.

import { fingeringFor, staffIndex, STRINGS } from './notes.js';

const NS = 'http://www.w3.org/2000/svg';
const LINE_GAP = 10;
const TOP_LINE_Y = 60; // F5 (index 38)
const NOTE_SPACING = 44;
const LEFT = 64;

function yFor(idx) {
  return TOP_LINE_Y + (38 - idx) * (LINE_GAP / 2);
}

function el(name, attrs = {}, text) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

const ACC = { '-2': '𝄫', '-1': '♭', 1: '♯', 2: '𝄪' };

/**
 * Render a staff with all notes. Returns the <svg>; clicking a note calls onSelect(i).
 */
export function renderStaff(notes, currentIndex, { onSelect, results = [] } = {}) {
  const width = LEFT + Math.max(1, notes.length) * NOTE_SPACING + 30;
  const height = 175;
  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'staff', role: 'img',
    'aria-label': 'Sheet music' });

  for (let k = 0; k < 5; k++) {
    const y = TOP_LINE_Y + k * LINE_GAP;
    svg.appendChild(el('line', { x1: 8, x2: width - 8, y1: y, y2: y, class: 'staff-line' }));
  }
  svg.appendChild(el('text', { x: 12, y: TOP_LINE_Y + 37, class: 'clef' }, '𝄞'));

  const resultByIndex = new Map(results.map((r) => [r.index, r]));
  notes.forEach((n, i) => {
    const x = LEFT + i * NOTE_SPACING + NOTE_SPACING / 2;
    const g = el('g', { class: 'note' + (i === currentIndex ? ' current' : ''), 'data-index': i, tabindex: 0 });
    const r = resultByIndex.get(i);
    if (r) g.classList.add(r.played ? (r.firstTry ? 'good' : 'ok') : 'skipped');
    g.appendChild(el('rect', { x: x - NOTE_SPACING / 2, y: 4, width: NOTE_SPACING, height: height - 8, class: 'hit' }));

    if (n.rest) {
      g.appendChild(el('text', { x: x - 6, y: TOP_LINE_Y + 26, class: 'rest' }, n.beats >= 4 ? '𝄻' : n.beats >= 2 ? '𝄼' : n.beats >= 1 ? '𝄽' : '𝄾'));
    } else {
      const idx = staffIndex(n);
      const y = yFor(idx);
      for (let li = 28; li >= idx; li -= 2) g.appendChild(el('line', { x1: x - 10, x2: x + 10, y1: yFor(li), y2: yFor(li), class: 'ledger' }));
      for (let li = 40; li <= idx; li += 2) g.appendChild(el('line', { x1: x - 10, x2: x + 10, y1: yFor(li), y2: yFor(li), class: 'ledger' }));
      const hollow = n.beats >= 2;
      g.appendChild(el('ellipse', { cx: x, cy: y, rx: 6.5, ry: 4.8, transform: `rotate(-20 ${x} ${y})`,
        class: hollow ? 'head hollow' : 'head' }));
      if (n.beats < 4) {
        const up = idx < 34;
        g.appendChild(el('line', up
          ? { x1: x + 6, x2: x + 6, y1: y, y2: y - 32, class: 'stem' }
          : { x1: x - 6, x2: x - 6, y1: y, y2: y + 32, class: 'stem' }));
        if (n.beats <= 0.5) {
          const fy = up ? y - 32 : y + 32;
          g.appendChild(el('path', { d: up ? `M${x + 6} ${fy} q 10 8 6 20` : `M${x - 6} ${fy} q 10 -8 6 -20`, class: 'flag' }));
        }
      }
      if (n.beats % 1.5 === 0 || n.beats === 0.75 || n.beats === 3) {
        g.appendChild(el('circle', { cx: x + 11, cy: y - (idx % 2 === 0 ? 3 : 0), r: 1.8, class: 'dot' }));
      }
      if (n.alter) g.appendChild(el('text', { x: x - 20, y: y + 5, class: 'acc' }, ACC[n.alter]));
      const f = fingeringFor(n.midi);
      g.appendChild(el('text', { x, y: height - 22, class: 'finger', 'text-anchor': 'middle' },
        f.inRange ? String(f.finger) : '↑'));
      g.appendChild(el('text', { x, y: height - 8, class: 'string-label', 'text-anchor': 'middle' }, f.string || ''));
    }
    g.addEventListener('click', () => onSelect && onSelect(i));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSelect && onSelect(i); });
    svg.appendChild(g);
  });
  return svg;
}

export function staffNoteX(i) {
  return LEFT + i * NOTE_SPACING + NOTE_SPACING / 2;
}

/* ---------------------------------------------------------- fingerboard */

const FB_W = 200;
const FB_H = 360;
const NUT_Y = 40;
const SCALE = 900; // px for the whole (virtual) string length
const STRING_X = [50, 83, 117, 150];

function offsetY(semitones) {
  return NUT_Y + SCALE * (1 - Math.pow(2, -semitones / 12));
}

/** Render a first-position fingerboard highlighting where to play `midi`. */
export function renderFingerboard(midi) {
  const svg = el('svg', { viewBox: `0 0 ${FB_W} ${FB_H}`, class: 'fingerboard', role: 'img',
    'aria-label': 'Fingerboard diagram' });
  svg.appendChild(el('path', {
    d: `M30 ${NUT_Y} L170 ${NUT_Y} L178 ${FB_H - 10} L22 ${FB_H - 10} Z`, class: 'board' }));
  svg.appendChild(el('rect', { x: 26, y: NUT_Y - 8, width: 148, height: 8, rx: 2, class: 'nut' }));

  // Beginner tapes: 1st finger, high 2nd, 3rd finger.
  [[2, '1'], [4, '2'], [5, '3']].forEach(([s, label]) => {
    const y = offsetY(s);
    svg.appendChild(el('line', { x1: 30, x2: 170, y1: y, y2: y, class: 'tape' }));
    svg.appendChild(el('text', { x: 182, y: y + 4, class: 'tape-label' }, label));
  });

  const f = midi == null ? null : fingeringFor(midi);
  STRINGS.forEach((s, i) => {
    const active = f && f.stringIndex === i;
    svg.appendChild(el('line', { x1: STRING_X[i], x2: STRING_X[i], y1: NUT_Y - 8, y2: FB_H - 10,
      class: 'string' + (active ? ' active' : ''), 'stroke-width': 3.2 - i * 0.5 }));
    svg.appendChild(el('text', { x: STRING_X[i], y: 22, class: 'string-name' + (active ? ' active' : ''),
      'text-anchor': 'middle' }, s.name));
  });

  if (f && f.stringIndex != null) {
    const x = STRING_X[f.stringIndex];
    if (!f.inRange) {
      svg.appendChild(el('text', { x, y: FB_H - 24, class: 'marker-text', 'text-anchor': 'middle' }, '↑ shift'));
    } else if (f.finger === 0) {
      svg.appendChild(el('circle', { cx: x, cy: NUT_Y - 4, r: 12, class: 'marker open' }));
      svg.appendChild(el('text', { x, y: NUT_Y, class: 'marker-text', 'text-anchor': 'middle' }, '0'));
    } else {
      const y = offsetY(f.offset);
      svg.appendChild(el('circle', { cx: x, cy: y, r: 13, class: 'marker' }));
      svg.appendChild(el('text', { x, y: y + 5, class: 'marker-text', 'text-anchor': 'middle' }, String(f.finger)));
    }
  }
  return svg;
}
