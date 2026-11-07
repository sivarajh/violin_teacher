// The "teacher": turns pitch readings into feedback and tracks a practice session.

import { describeFingering, fingeringFor, midiToName, noteLabel, prettyName, type Note, type PitchedNote } from './notes';

export type FeedbackStatus = 'in-tune' | 'sharp' | 'flat' | 'octave' | 'wrong-note' | 'silent' | 'rest' | 'done';
export type Feedback = { status: FeedbackStatus; cents?: number; message?: string; advanced?: boolean };

/** Compare a heard pitch (fractional MIDI) with the target note. */
export function feedbackFor(target: PitchedNote, heardMidi: number, tolerance = 25): Feedback & { cents: number } {
  const cents = (heardMidi - target.midi) * 100;
  const label = noteLabel(target);
  if (Math.abs(cents) <= tolerance) {
    return { status: 'in-tune', cents, message: `Lovely — that's ${label}. Hold it steady…` };
  }
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
        ? `A little sharp (+${Math.round(cents)}¢). Your ${fing.string} string may need tuning down slightly.`
        : `A little sharp (+${Math.round(cents)}¢). Slide your finger back toward the scroll.` };
    }
    return { status: 'flat', cents, message: open
      ? `A little flat (${Math.round(cents)}¢). Your ${fing.string} string may need tuning up slightly.`
      : `A little flat (${Math.round(cents)}¢). Move your finger up toward the bridge.` };
  }
  const dir = cents > 0 ? 'too high' : 'too low';
  return { status: 'wrong-note', cents,
    message: `I hear ${prettyName(midiToName(heardMidi))} — that's ${dir}. For ${label}: ${describeFingering(target.midi)}.` };
}

export type NoteResult = {
  index: number;
  note: Note;
  played: boolean;
  timeMs: number;
  firstTry: boolean;
  meanCents: number;
};

export type Summary = {
  totalNotes: number;
  played: number;
  skipped: number;
  firstTry: number;
  accuracy: number;
  avgTimeMs: number;
  tendencyCents: number;
  hardest: { label: string; midi: number }[];
  tips: string[];
};

export class PracticeSession {
  notes: Note[];
  tolerance: number;
  holdMs: number;
  index: number;
  results: NoteResult[] = [];
  private noteStart: number | null = null;
  private inTuneSince: number | null = null;
  private wrongReadings = 0;
  private offsets: number[] = [];

  constructor(notes: Note[], opts: { tolerance?: number; holdMs?: number; startIndex?: number } = {}) {
    this.notes = notes;
    this.tolerance = opts.tolerance ?? 25;
    this.holdMs = opts.holdMs ?? 300;
    this.index = opts.startIndex ?? 0;
  }

  get current(): Note | undefined { return this.notes[this.index]; }
  get done(): boolean { return this.index >= this.notes.length; }

  private beginNote(now: number | null) {
    this.noteStart = now;
    this.inTuneSince = null;
    this.wrongReadings = 0;
    this.offsets = [];
  }

  /** Feed one pitch reading. `advanced: true` means the note was completed. */
  handleReading(heardMidi: number | null, now: number): Feedback {
    const target = this.current;
    if (!target) return { status: 'done' };
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
        const r = this.record(now, true);
        return { ...fb, message: praise(r), advanced: true };
      }
    } else {
      this.inTuneSince = null;
      this.wrongReadings++;
    }
    return fb;
  }

  private record(now: number, played: boolean): NoteResult {
    const offs = this.offsets;
    const r: NoteResult = {
      index: this.index,
      note: this.current!,
      played,
      timeMs: this.noteStart == null ? 0 : now - this.noteStart,
      firstTry: played && this.wrongReadings <= 2,
      meanCents: offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0,
    };
    this.results.push(r);
    this.index++;
    this.beginNote(now);
    return r;
  }

  /** The student says they played it (practice without a microphone). */
  confirm(now: number) {
    if (this.done) return;
    if (this.current!.rest) { this.index++; this.beginNote(now); return; }
    this.offsets = [];
    this.wrongReadings = 0;
    this.record(now, true);
  }

  /** Move on without hearing the note (rests, or the student taps "skip"). */
  skip(now: number) {
    if (this.done) return;
    if (this.current!.rest) { this.index++; this.beginNote(now); return; }
    this.record(now, false);
  }

  back(now: number) {
    if (this.index === 0) return;
    this.index--;
    while (this.results.length && this.results[this.results.length - 1].index >= this.index) this.results.pop();
    this.beginNote(now);
  }

  summary(): Summary {
    const played = this.results.filter((r) => r.played);
    const skipped = this.results.filter((r) => !r.played);
    const firstTry = played.filter((r) => r.firstTry).length;
    const avgTime = played.length ? played.reduce((a, r) => a + r.timeMs, 0) / played.length : 0;
    const tendency = played.length ? played.reduce((a, r) => a + r.meanCents, 0) / played.length : 0;

    const byNote = new Map<string, { label: string; midi: number; total: number; count: number; misses: number }>();
    for (const r of this.results) {
      if (r.note.rest) continue;
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
      .slice(0, 3)
      .map(({ label, midi }) => ({ label, midi }));

    const tips: string[] = [];
    const pct = played.length ? Math.round((firstTry / played.length) * 100) : 0;
    if (pct >= 85) tips.push('Excellent accuracy! Try raising the tempo or tightening the tolerance in Settings.');
    else if (pct >= 60) tips.push('Good work. Repeat the passages with your trickiest notes slowly, then play the whole piece again.');
    else tips.push("This piece is still new — that's normal. Practise it in short chunks of 4–8 notes: tap a note on the staff to start from there.");
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

function praise(result: NoteResult): string {
  if (result.firstTry && result.timeMs < 2500) return pick(['Spot on!', 'Beautiful!', 'Perfect pitch there.', 'Yes! Right in tune.']);
  if (result.firstTry) return pick(['Good — nice and steady.', 'Well done.', "That's it."]);
  return pick(['Got there — well listened!', 'Nice correction.', "Good adjusting — that's how ears grow."]);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
