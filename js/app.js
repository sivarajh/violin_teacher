import { LESSONS } from './lessons.js';
import { parseFile, parseText } from './parsers.js';
import {
  describeFingering, fingeringFor, midiToName, noteLabel, parseNoteList, parseNoteName, STRINGS, toNoteList,
} from './notes.js';
import { PracticeSession } from './coach.js';
import { renderStaff, renderFingerboard, staffNoteX } from './render.js';
import { playTone, playSequence, PitchListener, audioContext } from './audio.js';
import { load, save, files } from './storage.js';

/* ------------------------------------------------------------ state */

const DEFAULT_SETTINGS = { a4: 440, tolerance: 25, holdMs: 300, bpm: 72, autoPlayRef: false, name: '' };
const state = {
  settings: { ...DEFAULT_SETTINGS, ...load('settings', {}) },
  progress: { completedLessons: [], days: [], ...load('progress', {}) },
  pieces: load('pieces', []),
  cleanup: [],
};

const saveSettings = () => save('settings', state.settings);
const saveProgress = () => save('progress', state.progress);
const savePieces = () => {
  if (!save('pieces', state.pieces)) toast('Could not save — your browser storage may be full.');
};

const $ = (sel, root = document) => root.querySelector(sel);
const main = () => $('#main');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3500);
}

function markPracticedToday() {
  const d = today();
  if (!state.progress.days.includes(d)) {
    state.progress.days.push(d);
    state.progress.days.sort();
    saveProgress();
  }
}

function streak() {
  const days = new Set(state.progress.days);
  let count = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

/* ------------------------------------------------------------ routing */

const routes = [
  [/^#\/?$|^#\/home$/, viewHome],
  [/^#\/lessons$/, viewLessons],
  [/^#\/lesson\/([\w-]+)$/, viewLesson],
  [/^#\/music$/, viewMusic],
  [/^#\/edit\/([\w-]+)$/, viewEdit],
  [/^#\/practice\/(piece|lesson)\/([\w-]+)$/, viewPractice],
  [/^#\/tuner$/, viewTuner],
  [/^#\/settings$/, viewSettings],
];

function route() {
  state.cleanup.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  state.cleanup = [];
  const hash = location.hash || '#/home';
  for (const [re, fn] of routes) {
    const m = re.exec(hash);
    if (m) {
      document.querySelectorAll('nav a').forEach((a) => {
        const target = a.getAttribute('href');
        a.classList.toggle('active', hash === target || (target !== '#/home' && hash.startsWith(target.replace(/s$/, ''))));
      });
      main().innerHTML = '';
      window.scrollTo(0, 0);
      fn(...m.slice(1));
      return;
    }
  }
  location.hash = '#/home';
}

/* ------------------------------------------------------------ home */

const TIPS = [
  'Short, daily practice beats one long session a week. Even 15 minutes counts.',
  'Tune your violin every time you play — a well-tuned violin trains your ear.',
  'Slow practice is the fastest way to learn. If you make a mistake, slow down.',
  'Relax your left thumb. Squeezing the neck makes shifting and vibrato harder later.',
  'Keep your bow halfway between the bridge and the fingerboard for a clear tone.',
  'Record yourself once a week. Listening back is like having a second teacher.',
  'Sing the melody before you play it. If you can hear it in your head, your fingers will find it.',
  'Check your posture: violin up, scroll pointing slightly left, shoulders relaxed.',
];

function viewHome() {
  const s = streak();
  const done = new Set(state.progress.completedLessons);
  const next = LESSONS.find((l) => !done.has(l.id)) || LESSONS[LESSONS.length - 1];
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const recent = [...state.pieces].sort((a, b) => (b.lastPracticed || b.created) - (a.lastPracticed || a.created)).slice(0, 3);
  const name = state.settings.name ? `, ${esc(state.settings.name)}` : '';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  main().innerHTML = `
  <section class="hero">
    <div class="teacher-avatar" aria-hidden="true">🎻</div>
    <div>
      <h1>${greet}${name}!</h1>
      <p class="speech">${s ? `You're on a <b>${s}-day</b> practice streak — keep it going!` : 'Ready for some practice? Let\'s begin.'}
        ${done.size ? ` You've completed ${done.size} of ${LESSONS.length} lessons.` : ''}</p>
    </div>
  </section>
  <div class="grid">
    <article class="card accent">
      <h3>Today's lesson</h3>
      <p class="muted">${esc(next.level)}</p>
      <h2>${esc(next.title)}</h2>
      <p>${esc(next.summary)}</p>
      <a class="btn primary" href="#/lesson/${next.id}">Start lesson</a>
    </article>
    <article class="card">
      <h3>Your music</h3>
      ${recent.length ? `<ul class="plain">${recent.map((p) => `
        <li><a href="#/practice/piece/${p.id}">${esc(p.title)}</a>
          <span class="muted">${p.notes.length} notes${p.bestAccuracy != null ? ` · best ${p.bestAccuracy}%` : ''}</span></li>`).join('')}</ul>`
        : '<p>Upload the sheet music you\'re learning, and I\'ll teach it to you note by note.</p>'}
      <a class="btn" href="#/music">${recent.length ? 'All music' : 'Upload music'}</a>
    </article>
    <article class="card">
      <h3>Tune up</h3>
      <p>Always start by tuning your strings: G, D, A, E.</p>
      <a class="btn" href="#/tuner">Open tuner</a>
    </article>
    <article class="card tip-card">
      <h3>Teacher's tip</h3>
      <p>${esc(tip)}</p>
    </article>
  </div>`;
}

/* ------------------------------------------------------------ lessons */

function viewLessons() {
  const done = new Set(state.progress.completedLessons);
  main().innerHTML = `
  <h1>Lessons</h1>
  <p class="muted">A step-by-step beginner course. Lessons with exercises use your microphone to check your playing.</p>
  <ol class="lesson-list">
    ${LESSONS.map((l, i) => `
    <li class="card lesson-item ${done.has(l.id) ? 'done' : ''}">
      <span class="num">${done.has(l.id) ? '✓' : i + 1}</span>
      <div>
        <a href="#/lesson/${l.id}"><b>${esc(l.title)}</b></a>
        <div class="muted">${esc(l.level)} · ${esc(l.summary)}${l.exercise ? ' · 🎤 exercise' : ''}</div>
      </div>
    </li>`).join('')}
  </ol>`;
}

function viewLesson(id) {
  const idx = LESSONS.findIndex((l) => l.id === id);
  if (idx < 0) { location.hash = '#/lessons'; return; }
  const l = LESSONS[idx];
  const done = state.progress.completedLessons.includes(l.id);
  const next = LESSONS[idx + 1];
  main().innerHTML = `
  <a href="#/lessons" class="back">← All lessons</a>
  <article class="card lesson">
    <p class="muted">Lesson ${idx + 1} · ${esc(l.level)}</p>
    <h1>${esc(l.title)}</h1>
    ${l.body}
    ${l.exercise ? `<h4>Exercise</h4><div id="exercise-staff" class="staff-wrap"></div>
      <div class="row">
        <a class="btn primary" href="#/practice/lesson/${l.id}">🎤 Practise with me</a>
        <button class="btn" id="hear">▶ Hear it</button>
      </div>` : ''}
    <div class="row lesson-footer">
      <button class="btn" id="complete">${done ? '✓ Completed' : 'Mark as complete'}</button>
      ${next ? `<a class="btn ghost" href="#/lesson/${next.id}">Next: ${esc(next.title)} →</a>` : ''}
    </div>
  </article>`;
  if (l.exercise) {
    const notes = parseNoteList(l.exercise).notes;
    $('#exercise-staff').appendChild(renderStaff(notes, -1));
    let stop = null;
    $('#hear').onclick = () => {
      if (stop) { stop(); stop = null; $('#hear').textContent = '▶ Hear it'; return; }
      $('#hear').textContent = '■ Stop';
      stop = playSequence(notes, state.settings.bpm, { a4: state.settings.a4,
        onEnd: () => { stop = null; $('#hear') && ($('#hear').textContent = '▶ Hear it'); } });
    };
    state.cleanup.push(() => stop && stop());
  }
  $('#complete').onclick = () => {
    completeLesson(l.id);
    $('#complete').textContent = '✓ Completed';
    toast('Lesson complete — well done!');
  };
}

function completeLesson(id) {
  if (!state.progress.completedLessons.includes(id)) {
    state.progress.completedLessons.push(id);
    saveProgress();
  }
}

/* ------------------------------------------------------------ music library */

const SAMPLES = [
  { file: 'samples/ode-to-joy.abc', label: 'Ode to Joy (ABC)' },
  { file: 'samples/hot-cross-buns.musicxml', label: 'Hot Cross Buns (MusicXML)' },
];

function viewMusic() {
  main().innerHTML = `
  <h1>My Music</h1>
  <p class="muted">Upload the notes you want to learn. I'll show you how to finger each one, play it for you, and listen as you play.</p>
  <section class="card">
    <h3>Upload sheet music</h3>
    <label class="dropzone" id="drop">
      <input type="file" id="file" multiple accept=".musicxml,.xml,.mxl,.abc,.txt,.pdf,image/*">
      <span>📄 Drop files here or <u>choose files</u></span>
      <small>MusicXML (.musicxml/.xml/.mxl), ABC (.abc), a note list (.txt), or a photo/PDF of sheet music</small>
    </label>
    <details>
      <summary>…or paste / type notes</summary>
      <input id="paste-title" placeholder="Title (optional)">
      <textarea id="paste" rows="5" placeholder="Paste ABC notation or MusicXML, or type notes like:  D4 E4 F#4 G4 A4:2  (':2' = two beats, R = rest)"></textarea>
      <button class="btn primary" id="paste-add">Add piece</button>
    </details>
    <p class="muted small">Try a sample: ${SAMPLES.map((s, i) => `<button class="link" data-sample="${i}">${esc(s.label)}</button>`).join(' · ')}</p>
  </section>
  <section>
    <h3>Library</h3>
    <div id="library"></div>
  </section>`;

  renderLibrary();
  const input = $('#file');
  input.onchange = () => handleFiles(input.files);
  const drop = $('#drop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); handleFiles(e.dataTransfer.files); };
  $('#paste-add').onclick = () => {
    const text = $('#paste').value;
    if (!text.trim()) return;
    try {
      const res = parseText(text);
      const piece = addPiece({ title: $('#paste-title').value.trim() || res.title || 'Untitled piece', format: res.format, notes: res.notes, tempo: res.tempo });
      if (res.errors && res.errors.length) toast(`Ignored unrecognised: ${res.errors.slice(0, 5).join(', ')}`);
      location.hash = `#/practice/piece/${piece.id}`;
    } catch (err) { toast(err.message); }
  };
  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.onclick = async () => {
      const s = SAMPLES[+b.dataset.sample];
      try {
        const text = await (await fetch(s.file)).text();
        const res = parseText(text);
        addPiece({ title: res.title || s.label, format: res.format, notes: res.notes, tempo: res.tempo });
        renderLibrary();
        toast(`Added "${res.title || s.label}"`);
      } catch (err) { toast('Could not load sample: ' + err.message); }
    };
  });
}

function addPiece(p) {
  const piece = { id: uid(), created: Date.now(), lastPracticed: null, bestAccuracy: null, ...p };
  state.pieces.push(piece);
  savePieces();
  return piece;
}

async function handleFiles(list) {
  let lastId = null;
  let count = 0;
  for (const file of list) {
    try {
      const res = await parseFile(file);
      if (res.kind === 'image') {
        const piece = addPiece({ title: res.title, format: res.mime.includes('pdf') ? 'PDF (transcribe)' : 'Image (transcribe)', notes: [], hasFile: true, mime: res.mime });
        await files.put(piece.id, file);
        lastId = piece.id;
        if (list.length === 1) { location.hash = `#/edit/${piece.id}`; return; }
      } else {
        if (!res.notes.length) throw new Error('no notes found');
        const piece = addPiece({ title: res.title, format: res.format, notes: res.notes, tempo: res.tempo });
        lastId = piece.id;
      }
      count++;
    } catch (err) {
      toast(`${file.name}: ${err.message}`);
    }
  }
  if (count === 1 && lastId) location.hash = `#/practice/piece/${lastId}`;
  else { renderLibrary(); if (count) toast(`Added ${count} pieces.`); }
}

function renderLibrary() {
  const lib = $('#library');
  if (!lib) return;
  if (!state.pieces.length) {
    lib.innerHTML = '<p class="muted">No music yet. Upload a file above or try a sample.</p>';
    return;
  }
  lib.innerHTML = state.pieces.map((p) => `
    <div class="card piece">
      <div class="piece-info">
        <b>${esc(p.title)}</b>
        <div class="muted small">${esc(p.format || '')} · ${p.notes.filter((n) => !n.rest).length} notes
          ${p.bestAccuracy != null ? ` · best ${p.bestAccuracy}%` : ''}
          ${p.lastPracticed ? ` · practised ${new Date(p.lastPracticed).toLocaleDateString()}` : ''}</div>
      </div>
      <div class="row">
        ${p.notes.length ? `<a class="btn primary" href="#/practice/piece/${p.id}">Practise</a>` : ''}
        <a class="btn" href="#/edit/${p.id}">${p.notes.length ? 'Edit' : 'Transcribe'}</a>
        <button class="btn ghost" data-del="${p.id}" aria-label="Delete ${esc(p.title)}">🗑</button>
      </div>
    </div>`).join('');
  lib.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const p = state.pieces.find((x) => x.id === b.dataset.del);
      if (!p || !confirm(`Delete "${p.title}"?`)) return;
      state.pieces = state.pieces.filter((x) => x !== p);
      if (p.hasFile) files.delete(p.id);
      savePieces();
      renderLibrary();
    };
  });
}

/* ------------------------------------------------------------ editor / transcriber */

const PAD_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PAD_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function padName(midi, flats) {
  const names = flats ? PAD_FLATS : PAD_SHARPS;
  return names[midi % 12] + (Math.floor(midi / 12) - 1);
}

function viewEdit(id) {
  const piece = state.pieces.find((p) => p.id === id);
  if (!piece) { location.hash = '#/music'; return; }
  main().innerHTML = `
  <a href="#/music" class="back">← My Music</a>
  <h1>${piece.notes.length ? 'Edit notes' : 'Transcribe your music'}</h1>
  <div class="edit-layout ${piece.hasFile ? 'with-file' : ''}">
    ${piece.hasFile ? `<section class="card file-view"><div id="file-view" class="muted">Loading…</div></section>` : ''}
    <section class="card">
      <label>Title <input id="title" value="${esc(piece.title)}"></label>
      ${piece.hasFile ? '<p class="muted small">Read the notes from your sheet music and tap them on the pad below. Choose the length first (♩ = 1 beat).</p>' : ''}
      <div class="row pad-controls">
        <label>Length
          <select id="dur">
            <option value="4">𝅝 whole (4)</option><option value="3">𝅗𝅥. dotted half (3)</option>
            <option value="2">𝅗𝅥 half (2)</option><option value="1.5">♩. dotted quarter (1.5)</option>
            <option value="1" selected>♩ quarter (1)</option><option value="0.5">♪ eighth (½)</option>
            <option value="0.25">𝅘𝅥𝅯 sixteenth (¼)</option>
          </select></label>
        <label class="check"><input type="checkbox" id="flats"> Use flats (♭)</label>
      </div>
      <div class="pad" id="pad"></div>
      <div class="row">
        <button class="btn" id="pad-rest">Rest</button>
        <button class="btn" id="pad-undo">⌫ Undo</button>
        <button class="btn ghost" id="pad-clear">Clear</button>
      </div>
      <label>Notes (you can also type here)
        <textarea id="notes-text" rows="4" spellcheck="false">${esc(toNoteList(piece.notes))}</textarea></label>
      <div id="parse-errors" class="error small"></div>
      <div class="staff-wrap" id="preview"></div>
      <div class="row">
        <button class="btn primary" id="save">Save & practise</button>
        <button class="btn" id="save-only">Save</button>
      </div>
    </section>
  </div>`;

  if (piece.hasFile) {
    files.get(piece.id).then((blob) => {
      const holder = $('#file-view');
      if (!holder) return;
      if (!blob) { holder.textContent = 'The original file is not available on this device.'; return; }
      const url = URL.createObjectURL(blob);
      state.cleanup.push(() => URL.revokeObjectURL(url));
      holder.className = '';
      holder.innerHTML = (piece.mime || '').includes('pdf')
        ? `<object data="${url}" type="application/pdf" class="pdf"><a href="${url}" target="_blank">Open PDF</a></object>`
        : `<img src="${url}" alt="Uploaded sheet music" class="sheet-img">`;
    });
  }

  const text = $('#notes-text');
  const buildPad = () => {
    const flats = $('#flats').checked;
    const rows = STRINGS.map((s, i) => {
      const max = i === 3 ? 7 : 6;
      const keys = [];
      for (let o = 0; o <= max; o++) {
        const midi = s.midi + o;
        const f = fingeringFor(midi);
        keys.push(`<button class="key ${o === 0 ? 'open' : ''} ${[1, 3, 6].includes(o) || padName(midi, false).includes('#') ? 'accidental' : ''}"
          data-name="${padName(midi, flats)}" title="${esc(describeFingering(midi))}">
          ${padName(midi, flats).replace('#', '♯').replace(/b(?=\d)/, '♭')}<small>${f.finger}</small></button>`);
      }
      return `<div class="pad-row"><span class="pad-label">${s.name}</span>${keys.join('')}</div>`;
    });
    rows.push(`<div class="pad-row"><span class="pad-label">↑</span>${[84, 85, 86, 88].map((m) =>
      `<button class="key" data-name="${padName(m, flats)}" title="Above first position">${padName(m, flats).replace('#', '♯').replace(/b(?=\d)/, '♭')}</button>`).join('')}</div>`);
    $('#pad').innerHTML = rows.join('');
    $('#pad').querySelectorAll('.key').forEach((k) => {
      k.onclick = () => {
        const dur = parseFloat($('#dur').value);
        append(dur === 1 ? k.dataset.name : `${k.dataset.name}:${dur}`);
        const n = parseNoteName(k.dataset.name);
        if (n) playTone(n.midi, 0.5, { a4: state.settings.a4 });
      };
    });
  };
  const append = (tok) => {
    text.value = (text.value.trim() + ' ' + tok).trim();
    refresh();
  };
  const refresh = () => {
    const { notes, errors } = parseNoteList(text.value);
    $('#parse-errors').textContent = errors.length ? `Not recognised: ${errors.join(' ')}` : '';
    const prev = $('#preview');
    prev.innerHTML = '';
    if (notes.length) {
      prev.appendChild(renderStaff(notes, notes.length - 1));
      prev.scrollLeft = prev.scrollWidth;
    }
    return notes;
  };
  buildPad();
  refresh();
  $('#flats').onchange = buildPad;
  text.oninput = refresh;
  $('#pad-rest').onclick = () => { const d = parseFloat($('#dur').value); append(d === 1 ? 'R' : `R:${d}`); };
  $('#pad-undo').onclick = () => { text.value = text.value.trim().split(/\s+/).slice(0, -1).join(' '); refresh(); };
  $('#pad-clear').onclick = () => { if (confirm('Clear all notes?')) { text.value = ''; refresh(); } };
  const doSave = () => {
    piece.title = $('#title').value.trim() || piece.title;
    piece.notes = refresh();
    if (piece.format && piece.format.includes('transcribe') && piece.notes.length) piece.format = piece.format.replace('(transcribe)', '(transcribed)');
    savePieces();
    return piece.notes.length > 0;
  };
  $('#save').onclick = () => {
    if (doSave()) location.hash = `#/practice/piece/${piece.id}`;
    else toast('Add some notes first.');
  };
  $('#save-only').onclick = () => { doSave(); toast('Saved.'); };
}

/* ------------------------------------------------------------ practice */

function viewPractice(kind, id) {
  let title;
  let notes;
  let piece = null;
  let lesson = null;
  if (kind === 'lesson') {
    lesson = LESSONS.find((l) => l.id === id);
    if (!lesson || !lesson.exercise) { location.hash = '#/lessons'; return; }
    title = lesson.title;
    notes = parseNoteList(lesson.exercise).notes;
  } else {
    piece = state.pieces.find((p) => p.id === id);
    if (!piece) { location.hash = '#/music'; return; }
    if (!piece.notes.length) { location.hash = `#/edit/${id}`; return; }
    title = piece.title;
    notes = piece.notes;
  }
  const { settings } = state;
  const bpm = (piece && piece.tempo) || settings.bpm;

  main().innerHTML = `
  <a href="${lesson ? `#/lesson/${lesson.id}` : '#/music'}" class="back">← ${lesson ? 'Back to lesson' : 'My Music'}</a>
  <div class="practice-head">
    <h1>${esc(title)}</h1>
    <div class="row">
      <label class="small">Tempo <input type="number" id="bpm" min="30" max="200" value="${bpm}" class="num-input"> bpm</label>
      <button class="btn" id="listen-all">▶ Play whole piece</button>
    </div>
  </div>
  <div class="staff-wrap" id="staff"></div>
  <p class="muted small">Numbers under each note = finger (0 = open string), letters = string. Tap a note to start from there.</p>
  <div class="practice-grid">
    <section class="card now">
      <div class="progress-line"><span id="pos"></span><div class="bar"><div id="bar-fill"></div></div></div>
      <div class="note-big" id="note-big"></div>
      <div class="fingering" id="fingering"></div>
      <div class="meter" id="meter" aria-live="off">
        <div class="meter-scale"><span>♭</span><span>in tune</span><span>♯</span></div>
        <div class="meter-track"><div class="meter-zone" id="meter-zone"></div><div class="needle idle" id="needle"></div></div>
        <div class="heard" id="heard">—</div>
      </div>
      <div class="bubble" id="bubble" aria-live="polite">Press <b>Start listening</b> and play the note shown. I'll tell you if it's in tune.</div>
      <div class="row controls">
        <button class="btn primary big" id="mic">🎤 Start listening</button>
        <button class="btn" id="hear">🔊 Hear note</button>
      </div>
      <div class="row controls">
        <button class="btn ghost" id="back">⟵ Back</button>
        <button class="btn ghost" id="played">✓ I played it</button>
        <button class="btn ghost" id="skip">Skip ⟶</button>
        <button class="btn ghost" id="restart">↺ Restart</button>
      </div>
    </section>
    <section class="card board-card">
      <h3>Where to put your finger</h3>
      <div id="board"></div>
    </section>
  </div>
  <div id="summary"></div>`;

  let session = new PracticeSession(notes, { tolerance: settings.tolerance, holdMs: settings.holdMs });
  let listener = null;
  let ignoreUntil = 0;
  let stopPlayback = null;
  let restTimer = null;

  const zone = $('#meter-zone');
  zone.style.left = `${50 - settings.tolerance}%`;
  zone.style.width = `${settings.tolerance * 2}%`;

  const scrollToCurrent = (i) => {
    const wrap = $('#staff');
    const x = staffNoteX(i);
    wrap.scrollTo({ left: Math.max(0, x - wrap.clientWidth / 2), behavior: 'smooth' });
  };

  const drawStaff = (highlight = session.index) => {
    const wrap = $('#staff');
    wrap.innerHTML = '';
    wrap.appendChild(renderStaff(notes, highlight, { results: session.results, onSelect: (i) => {
      session = new PracticeSession(notes, { tolerance: settings.tolerance, holdMs: settings.holdMs, startIndex: i });
      $('#summary').innerHTML = '';
      update();
      say(`Starting from note ${i + 1}.`);
    } }));
    scrollToCurrent(highlight);
  };

  const say = (html) => { $('#bubble').innerHTML = html; };

  const update = () => {
    drawStaff();
    const total = notes.length;
    $('#pos').textContent = session.done ? 'Finished' : `Note ${session.index + 1} of ${total}`;
    $('#bar-fill').style.width = `${(session.index / total) * 100}%`;
    const n = session.current;
    const board = $('#board');
    board.innerHTML = '';
    if (!n) { board.appendChild(renderFingerboard(null)); return; }
    if (n.rest) {
      $('#note-big').innerHTML = '<span class="rest-big">𝄽</span> Rest';
      $('#fingering').textContent = `Rest for ${n.beats} beat${n.beats === 1 ? '' : 's'}.`;
      board.appendChild(renderFingerboard(null));
      if (listener) {
        clearTimeout(restTimer);
        restTimer = setTimeout(() => { session.skip(performance.now()); afterAdvance(); }, Math.min(1500, (n.beats * 60000) / currentBpm()));
      }
      return;
    }
    const f = fingeringFor(n.midi);
    $('#note-big').innerHTML = `${esc(noteLabel(n).replace(/\d+$/, ''))}<sub>${n.octave}</sub>`;
    $('#fingering').innerHTML = f.inRange
      ? `<span class="pill">${f.string} string</span> <span class="pill">${f.finger === 0 ? 'Open' : `Finger ${f.finger}`}</span>
         <div>${esc(describeFingering(n.midi))}</div>`
      : `<div>${esc(f.text)}</div>`;
    board.appendChild(renderFingerboard(n.midi));
  };

  const currentBpm = () => Math.max(30, Math.min(200, parseInt($('#bpm').value, 10) || bpm));

  const hear = (midi, secs = 1.2) => {
    ignoreUntil = performance.now() + secs * 1000 + 250; // don't "hear" our own reference tone
    playTone(midi, secs, { a4: settings.a4 });
  };

  const afterAdvance = () => {
    update();
    if (session.done) { finish(); return; }
    if (settings.autoPlayRef && session.current && !session.current.rest) setTimeout(() => hear(session.current.midi), 350);
  };

  const finish = () => {
    stopMic();
    markPracticedToday();
    const sum = session.summary();
    if (piece) {
      piece.lastPracticed = Date.now();
      if (sum.played >= Math.min(4, notes.length) && (piece.bestAccuracy == null || sum.accuracy > piece.bestAccuracy)) piece.bestAccuracy = sum.accuracy;
      savePieces();
    }
    if (lesson && sum.played > 0) completeLesson(lesson.id);
    say(sum.accuracy >= 85 ? 'Bravo! That was wonderful playing. 👏' : sum.accuracy >= 60 ? 'Nicely done — you finished the piece!' : 'You made it to the end — every run-through makes it easier.');
    $('#summary').innerHTML = `
      <section class="card summary">
        <h2>Lesson notes from your teacher</h2>
        <div class="stats">
          <div><b>${sum.accuracy}%</b><span>first-try accuracy</span></div>
          <div><b>${sum.played}/${sum.totalNotes}</b><span>notes played</span></div>
          <div><b>${(sum.avgTimeMs / 1000).toFixed(1)}s</b><span>avg. time to find a note</span></div>
          <div><b>${sum.tendencyCents > 0 ? '+' : ''}${Math.round(sum.tendencyCents)}¢</b><span>average tuning</span></div>
        </div>
        <ul>${sum.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="row">
          <button class="btn primary" id="again">↺ Practise again</button>
          ${sum.hardest.length ? '<button class="btn" id="drill">Drill tricky notes</button>' : ''}
          ${lesson ? `<a class="btn ghost" href="#/lessons">Back to lessons</a>` : ''}
        </div>
      </section>`;
    $('#summary').scrollIntoView({ behavior: 'smooth' });
    $('#again').onclick = restart;
    const drill = $('#drill');
    if (drill) {
      drill.onclick = () => {
        const drillNotes = [];
        sum.hardest.forEach((h) => {
          const src = notes.find((n) => !n.rest && noteLabel(n) === h.label);
          for (let k = 0; k < 3; k++) drillNotes.push({ ...src, beats: 2 });
        });
        const p = addPiece({ title: `Drill: ${title}`, format: 'Drill', notes: drillNotes });
        location.hash = `#/practice/piece/${p.id}`;
      };
    }
  };

  const onReading = ({ midi, time }) => {
    const needle = $('#needle');
    if (!needle) return;
    if (time < ignoreUntil) return;
    const n = session.current;
    if (!n || session.done) return;
    if (midi == null) {
      needle.classList.add('idle');
      $('#heard').textContent = '—';
      return;
    }
    needle.classList.remove('idle');
    $('#heard').textContent = midiToName(midi).replace('#', '♯') + (n.rest ? '' : ` (${Math.round((midi - Math.round(midi)) * 100) >= 0 ? '+' : ''}${Math.round((midi - Math.round(midi)) * 100)}¢)`);
    if (n.rest) return;
    const fb = session.handleReading(midi, time);
    const cents = Math.max(-50, Math.min(50, fb.cents ?? 0));
    needle.style.left = `${50 + cents}%`;
    needle.className = 'needle ' + (fb.status === 'in-tune' ? 'good' : Math.abs(fb.cents) < 70 ? 'near' : 'far');
    if (fb.message) say(esc(fb.message));
    if (fb.advanced) afterAdvance();
  };

  const startMic = async () => {
    try {
      audioContext();
      listener = new PitchListener(onReading);
      listener.a4 = settings.a4;
      await listener.start();
      $('#mic').textContent = '⏸ Stop listening';
      $('#mic').classList.add('listening');
      say(`I'm listening. Play ${esc(session.current && !session.current.rest ? noteLabel(session.current) : 'the next note')} with a long, steady bow.`);
      update();
    } catch (err) {
      listener = null;
      say(`I couldn't use the microphone (${esc(err.message)}). You can still practise: play each note and press <b>✓ I played it</b>.`);
    }
  };
  const stopMic = () => {
    clearTimeout(restTimer);
    if (listener) listener.stop();
    listener = null;
    const b = $('#mic');
    if (b) { b.textContent = '🎤 Start listening'; b.classList.remove('listening'); }
  };
  const restart = () => {
    session = new PracticeSession(notes, { tolerance: settings.tolerance, holdMs: settings.holdMs });
    $('#summary').innerHTML = '';
    update();
    say('From the top! Take a breath and play the first note.');
  };

  $('#mic').onclick = () => (listener ? stopMic() : startMic());
  $('#hear').onclick = () => { const n = session.current; if (n && !n.rest) hear(n.midi); };
  $('#skip').onclick = () => { session.skip(performance.now()); afterAdvance(); };
  $('#played').onclick = () => { session.confirm(performance.now()); afterAdvance(); };
  $('#back').onclick = () => { session.back(performance.now()); $('#summary').innerHTML = ''; update(); };
  $('#restart').onclick = restart;
  $('#bpm').onchange = () => {
    if (piece) { piece.tempo = currentBpm(); savePieces(); }
  };
  $('#listen-all').onclick = () => {
    if (stopPlayback) { stopPlayback(); stopPlayback = null; $('#listen-all').textContent = '▶ Play whole piece'; drawStaff(); return; }
    const from = session.done ? 0 : session.index;
    const seq = notes.slice(from);
    const spb = 60 / currentBpm();
    ignoreUntil = performance.now() + seq.reduce((a, n) => a + n.beats, 0) * spb * 1000 + 500;
    $('#listen-all').textContent = '■ Stop';
    say('Listen carefully — try to sing along in your head.');
    stopPlayback = playSequence(seq, currentBpm(), {
      a4: settings.a4,
      onNote: (i) => { drawStaff(from + i); },
      onEnd: () => { stopPlayback = null; ignoreUntil = 0; const b = $('#listen-all'); if (b) { b.textContent = '▶ Play whole piece'; drawStaff(); } },
    });
  };

  state.cleanup.push(() => { stopMic(); if (stopPlayback) stopPlayback(); });
  update();
}

/* ------------------------------------------------------------ tuner */

function viewTuner() {
  const { settings } = state;
  main().innerHTML = `
  <h1>Tuner</h1>
  <p class="muted">Play one open string at a time with a long bow. Use the fine tuners for small changes, and the pegs only for big ones.</p>
  <section class="card tuner">
    <div class="tuner-note" id="t-note">—</div>
    <div class="tuner-freq" id="t-freq">Press start and play a string</div>
    <div class="meter big-meter">
      <div class="meter-scale"><span>−50¢</span><span>0</span><span>+50¢</span></div>
      <div class="meter-track"><div class="meter-zone" style="left:45%;width:10%"></div><div class="needle idle" id="t-needle"></div></div>
    </div>
    <div class="bubble" id="t-advice">Reference pitch: A4 = ${settings.a4} Hz</div>
    <button class="btn primary big" id="t-mic">🎤 Start tuner</button>
    <h3>Reference tones</h3>
    <div class="row">${STRINGS.map((s) => `<button class="btn string-btn" data-midi="${s.midi}">${s.name}</button>`).join('')}</div>
  </section>`;

  let listener = null;
  const onReading = ({ freq, midi }) => {
    const needle = $('#t-needle');
    if (!needle) return;
    if (midi == null) { needle.classList.add('idle'); return; }
    const nearest = Math.round(midi);
    const cents = (midi - nearest) * 100;
    needle.classList.remove('idle');
    needle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
    needle.className = 'needle ' + (Math.abs(cents) <= 5 ? 'good' : Math.abs(cents) <= 15 ? 'near' : 'far');
    $('#t-note').textContent = midiToName(nearest).replace('#', '♯');
    $('#t-freq').textContent = `${freq.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${Math.round(cents)}¢`;
    const s = STRINGS.reduce((best, st) => (Math.abs(st.midi - midi) < Math.abs(best.midi - midi) ? st : best));
    const off = (midi - s.midi) * 100;
    let advice;
    if (Math.abs(off) > 150) advice = `That's not near an open string. Closest is the ${s.name} string.`;
    else if (Math.abs(off) <= 5) advice = `✓ ${s.name} string is in tune!`;
    else if (off > 0) advice = `${s.name} string is sharp (+${Math.round(off)}¢): ${off > 50 ? 'loosen the peg slightly' : 'turn the fine tuner anticlockwise (loosen)'}.`;
    else advice = `${s.name} string is flat (${Math.round(off)}¢): ${off < -50 ? 'tighten the peg slightly, pushing it in as you turn' : 'turn the fine tuner clockwise (tighten)'}.`;
    $('#t-advice').textContent = advice;
  };
  const stop = () => { if (listener) listener.stop(); listener = null; const b = $('#t-mic'); if (b) b.textContent = '🎤 Start tuner'; };
  $('#t-mic').onclick = async () => {
    if (listener) { stop(); return; }
    try {
      listener = new PitchListener(onReading);
      listener.a4 = settings.a4;
      await listener.start();
      $('#t-mic').textContent = '⏸ Stop tuner';
    } catch (err) {
      listener = null;
      $('#t-advice').textContent = `Microphone unavailable: ${err.message}. Use the reference tones to tune by ear.`;
    }
  };
  document.querySelectorAll('.string-btn').forEach((b) => {
    b.onclick = () => playTone(+b.dataset.midi, 2.5, { a4: settings.a4 });
  });
  state.cleanup.push(stop);
}

/* ------------------------------------------------------------ settings */

function viewSettings() {
  const s = state.settings;
  main().innerHTML = `
  <h1>Settings</h1>
  <section class="card form">
    <label>Your name <input id="s-name" value="${esc(s.name)}" placeholder="So I can greet you"></label>
    <label>Tuning reference (A4) <span><input type="number" id="s-a4" min="415" max="466" value="${s.a4}" class="num-input"> Hz</span></label>
    <label>How strict should I be about tuning? <span><input type="range" id="s-tol" min="8" max="50" value="${s.tolerance}"> <b id="s-tol-v">±${s.tolerance}¢</b></span></label>
    <p class="muted small">Beginners: ±30¢. Getting comfortable: ±20¢. Advanced: ±10¢.</p>
    <label>Hold each note for <span><input type="range" id="s-hold" min="100" max="1500" step="50" value="${s.holdMs}"> <b id="s-hold-v">${s.holdMs} ms</b></span></label>
    <label>Default tempo <span><input type="number" id="s-bpm" min="30" max="200" value="${s.bpm}" class="num-input"> bpm</span></label>
    <label class="check"><input type="checkbox" id="s-auto" ${s.autoPlayRef ? 'checked' : ''}> Play each note for me before I play it</label>
    <p class="muted small">Tip: use headphones with this option, or I may hear my own reference tone.</p>
    <div class="row">
      <button class="btn primary" id="s-save">Save</button>
      <button class="btn ghost" id="s-reset">Reset lesson progress</button>
    </div>
  </section>
  <section class="card">
    <h3>Privacy</h3>
    <p class="small">Everything stays on this device. Microphone audio is analysed live in your browser and never recorded or uploaded.</p>
  </section>`;
  $('#s-tol').oninput = () => { $('#s-tol-v').textContent = `±${$('#s-tol').value}¢`; };
  $('#s-hold').oninput = () => { $('#s-hold-v').textContent = `${$('#s-hold').value} ms`; };
  $('#s-save').onclick = () => {
    Object.assign(s, {
      name: $('#s-name').value.trim(),
      a4: Math.max(415, Math.min(466, parseFloat($('#s-a4').value) || 440)),
      tolerance: parseInt($('#s-tol').value, 10),
      holdMs: parseInt($('#s-hold').value, 10),
      bpm: Math.max(30, Math.min(200, parseInt($('#s-bpm').value, 10) || 72)),
      autoPlayRef: $('#s-auto').checked,
    });
    saveSettings();
    toast('Settings saved.');
  };
  $('#s-reset').onclick = () => {
    if (!confirm('Reset lesson progress and practice streak?')) return;
    state.progress = { completedLessons: [], days: [] };
    saveProgress();
    toast('Progress reset.');
  };
}

/* ------------------------------------------------------------ boot */

window.addEventListener('hashchange', route);
route();
