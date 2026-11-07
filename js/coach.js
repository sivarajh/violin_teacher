// The "teacher": turns pitch readings into feedback and tracks a practice session.

import { describeFingering, fingeringFor, midiToName, noteLabel } from './notes.js';

/**
 * Compare a heard pitch with the target note.
 * @param {object} target note object
 * @param {number} heardMidi fractional MIDI number
 * @param {number} tolerance cents considered "in tune"
 */
export function feedbackFor(target, heardMidi, tolerance = 25) {
  const cents = (heardMidi - target.midi) * 100;
  const label = noteLabel(target);
  if (Math.abs(cents) <= tolerance) {
    return { status: 'in-tune', cents, message: `Lovely — that's ${label}. Hold it steady…` };
  }
  // Right note, wrong octave (common with a misplaced string or a harmonic).
  const octaveOff = Math.round(cents / 1200);
  if (octaveOff !== 0 && Math.abs(cents - octaveOff * 1200) <= Math.max(tolerance, 40)) {
    return { status: 'octave', cents,
      message: `Right note name, but ${octaveOff > 0 ? 'an octave too high' : 'an octave too low'}. ${describeFingering(target.midi)}.` };
  }
  if (Math.abs(cents) < 70) {
    const fing = fingeringFor(target.midi);
    const open = fing.inRange && fing.finger === 0;
    if (cents > 0) {
      return { status: 'sharp', cents, message: open
        ? `A little sharp (${Math.round(cents)}¢). Your ${fing.string} string may need tuning down slightly.`
        : `A little sharp (+${Math.round(cents)}¢). Slide your finger back toward the scroll.` };
    }
    return { status: 'flat', cents, message: open
      ? `A little flat (${Math.round(cents)}¢). Your ${fing.string} string may need tuning up slightly.`
      : `A little flat (${Math.round(cents)}¢). Move your finger up toward the bridge.` };
  }
  const heardName = midiToName(heardMidi);
  const dir = cents > 0 ? 'too high' : 'too low';
  return { status: 'wrong-note', cents,
    message: `I hear ${heardName.replace('#', '♯')} — that's ${dir}. For ${label}: ${describeFingering(target.midi)}.` };
}

export class PracticeSession {
  /**
   * @param {object[]} notes
   * @param {{tolerance?:number, holdMs?:number, startIndex?:number}} opts
   */
  constructor(notes, opts = {}) {
    this.notes = notes;
    this.tolerance = opts.tolerance ?? 25;
    this.holdMs = opts.holdMs ?? 300;
    this.index = opts.startIndex ?? 0;
    this.results = [];
    this.startedAt = null;
    this._beginNote(null);
  }

  get current() { return this.notes[this.index]; }
  get done() { return this.index >= this.notes.length; }

  _beginNote(now) {
    this.noteStart = now;
    this.inTuneSince = null;
    this.wrongReadings = 0;
    this.offsets = [];
  }

  /** Feed one pitch reading. Returns feedback (with `advanced: true` when the note is completed). */
  handleReading(heardMidi, now) {
    if (this.done) return { status: 'done' };
    const target = this.current;
    if (this.startedAt == null) this.startedAt = now;
    if (this.noteStart == null) this.noteStart = now;
    if (target.rest) return { status: 'rest', message: 'Rest — get ready for the next note.' };
    if (heardMidi == null) {
      this.inTuneSince = null;
      return { status: 'silent', message: `Play ${noteLabel(target)} — ${describeFingering(target.midi)}.` };
    }
    const fb = feedbackFor(target, heardMidi, this.tolerance);
    if (Math.abs(fb.cents) < 100) this.offsets.push(fb.cents);
    if (fb.status === 'in-tune') {
      if (this.inTuneSince == null) this.inTuneSince = now;
      if (now - this.inTuneSince >= this.holdMs) {
        this._record(now, true);
        return { ...fb, message: praise(this.results[this.results.length - 1]), advanced: true };
      }
    } else {
      this.inTuneSince = null;
      this.wrongReadings++;
    }
    return fb;
  }

  _record(now, played) {
    const offs = this.offsets;
    this.results.push({
      index: this.index,
      note: this.current,
      played,
      timeMs: this.noteStart == null ? 0 : now - this.noteStart,
      firstTry: played && this.wrongReadings <= 2,
      meanCents: offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0,
    });
    this.index++;
    this._beginNote(now);
  }

  /** The student says they played it (practice without a microphone). */
  confirm(now) {
    if (this.done) return;
    if (this.current.rest) { this.index++; this._beginNote(now); return; }
    this.offsets = [];
    this.wrongReadings = 0;
    this._record(now, true);
  }

  /** Move on without hearing the note (rests, or the student taps "skip"). */
  skip(now) {
    if (this.done) return;
    if (this.current.rest) { this.index++; this._beginNote(now); return; }
    this._record(now, false);
  }

  back(now) {
    if (this.index === 0) return;
    this.index--;
    while (this.results.length && this.results[this.results.length - 1].index >= this.index) this.results.pop();
    this._beginNote(now);
  }

  summary() {
    const played = this.results.filter((r) => r.played);
    const skipped = this.results.filter((r) => !r.played);
    const firstTry = played.filter((r) => r.firstTry).length;
    const avgTime = played.length ? played.reduce((a, r) => a + r.timeMs, 0) / played.length : 0;
    const tendency = played.length ? played.reduce((a, r) => a + r.meanCents, 0) / played.length : 0;

    const byNote = new Map();
    for (const r of this.results) {
      const key = noteLabel(r.note);
      const e = byNote.get(key) || { label: key, midi: r.note.midi, total: 0, count: 0, misses: 0 };
      e.total += r.played ? r.timeMs : 10000;
      e.count++;
      if (!r.firstTry) e.misses++;
      byNote.set(key, e);
    }
    const hardest = [...byNote.values()]
      .filter((e) => e.misses > 0)
      .sort((a, b) => b.total / b.count - a.total / a.count)
      .slice(0, 3);

    const tips = [];
    const pct = played.length ? Math.round((firstTry / played.length) * 100) : 0;
    if (pct >= 85) tips.push('Excellent accuracy! Try raising the tempo or tightening the tolerance in Settings.');
    else if (pct >= 60) tips.push('Good work. Repeat the passages with your trickiest notes slowly, then play the whole piece again.');
    else tips.push('This piece is still new — that\'s normal. Practise it in short chunks of 4–8 notes, using "Start from note".');
    if (tendency > 8) tips.push(`You tend to play slightly sharp (about +${Math.round(tendency)}¢). Let your fingers fall a little closer to the scroll.`);
    if (tendency < -8) tips.push(`You tend to play slightly flat (about ${Math.round(tendency)}¢). Reach your fingers a little further toward the bridge — especially 3rd finger.`);
    for (const h of hardest) {
      tips.push(`Practise ${h.label}: ${describeFingering(h.midi)}. Play it alongside the reference tone until they blend.`);
    }
    if (skipped.length) tips.push(`${skipped.length} note${skipped.length > 1 ? 's were' : ' was'} skipped — come back to ${skipped.length > 1 ? 'them' : 'it'} next time.`);

    return {
      totalNotes: this.results.length,
      played: played.length,
      skipped: skipped.length,
      firstTry,
      accuracy: pct,
      avgTimeMs: avgTime,
      tendencyCents: tendency,
      hardest,
      tips,
    };
  }
}

function praise(result) {
  if (result.firstTry && result.timeMs < 2500) return pick(['Spot on!', 'Beautiful!', 'Perfect pitch there.', 'Yes! Right in tune.']);
  if (result.firstTry) return pick(['Good — nice and steady.', 'Well done.', 'That\'s it.']);
  return pick(['Got there — well listened!', 'Nice correction.', 'Good adjusting — that\'s how ears grow.']);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
