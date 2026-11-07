import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, useWindowDimensions, View } from 'react-native';
import { playMelody, playTone, type StopFn } from '../../../audio/tone';
import type { PitchReading } from '../../../audio/types';
import { usePitchListener } from '../../../audio/usePitch';
import { Fingerboard } from '../../../components/Fingerboard';
import { Meter } from '../../../components/Meter';
import { Staff, type NoteMark } from '../../../components/Staff';
import { Bubble, Button, Card, H2, H3, Loading, P, Pill, Row, Screen } from '../../../components/ui';
import { PracticeSession, type Summary } from '../../../lib/coach';
import { LESSONS, type Lesson } from '../../../lib/lessons';
import { describeFingering, fingeringFor, midiToName, noteLabel, parseNoteList, prettyName, type Note } from '../../../lib/notes';
import { useStore, type Piece } from '../../../state/store';
import { useColors } from '../../../theme';

export default function PracticeScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const { ready, pieces } = useStore();
  const lesson = kind === 'lesson' ? LESSONS.find((l) => l.id === id) : undefined;
  const piece = kind === 'piece' ? pieces.find((p) => p.id === id) : undefined;
  const pieceNotes = piece?.notes;
  const notes: Note[] = useMemo(
    () => (lesson?.exercise ? parseNoteList(lesson.exercise).notes : pieceNotes ?? []),
    [lesson, pieceNotes],
  );

  if (!ready) return <Loading />;
  if (!notes.length) {
    return (
      <Screen>
        <P>There are no notes to practise here yet.</P>
        {piece && <Button title="Add notes" variant="primary" onPress={() => router.replace(`/edit/${piece.id}`)} />}
      </Screen>
    );
  }
  // A new session starts whenever the notes change.
  return <PracticeView key={`${kind}/${id}/${notes.length}`} notes={notes} lesson={lesson} piece={piece} />;
}

type ReadingView = { cents: number | null; status: 'good' | 'near' | 'far'; heard: string };
type SessionView = { index: number; done: boolean; marks: Record<number, NoteMark> };

function snapshot(s: PracticeSession): SessionView {
  const marks: Record<number, NoteMark> = {};
  for (const r of s.results) marks[r.index] = r.played ? (r.firstTry ? 'good' : 'ok') : 'skipped';
  return { index: s.index, done: s.done, marks };
}

function PracticeView({ notes, lesson, piece }: { notes: Note[]; lesson?: Lesson; piece?: Piece }) {
  const { settings, updatePiece, addPiece, completeLesson, markPracticedToday } = useStore();
  const c = useColors();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const title = lesson?.title ?? piece?.title ?? 'Practice';

  const makeSession = useCallback(
    (startIndex = 0) => new PracticeSession(notes, { tolerance: settings.tolerance, holdMs: settings.holdMs, startIndex }),
    [notes, settings.tolerance, settings.holdMs],
  );
  // The session is a mutable object changed in event handlers; `view` mirrors what the screen shows.
  const [session, setSession] = useState(() => makeSession());
  const [view, setView] = useState<SessionView>(() => snapshot(session));
  const [message, setMessage] = useState('Press "Start listening" and play the note shown. I\'ll tell you if it\'s in tune.');
  const [reading, setReading] = useState<ReadingView>({ cents: null, status: 'far', heard: '—' });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [playIndex, setPlayIndex] = useState<number | null>(null);
  const [bpmText, setBpmText] = useState(String(piece?.tempo || settings.bpm));
  const ignoreUntil = useRef(0);
  const stopPlayback = useRef<StopFn | null>(null);
  const finished = useRef(false);
  const handler = useRef<(r: PitchReading) => void>(() => undefined);

  const listener = usePitchListener((r) => handler.current(r), settings.a4);

  const bpm = () => Math.max(30, Math.min(200, parseInt(bpmText, 10) || settings.bpm));
  const sync = (s: PracticeSession = session) => setView(snapshot(s));

  const hear = (midi: number, secs = 1.2) => {
    ignoreUntil.current = performance.now() + secs * 1000 + 300; // don't "hear" our own tone
    playTone(midi, secs, settings.a4).catch(() => undefined);
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    listener.stop();
    markPracticedToday();
    const sum = session.summary();
    if (piece) {
      const better = sum.played >= Math.min(4, notes.length) && (piece.bestAccuracy == null || sum.accuracy > piece.bestAccuracy);
      updatePiece(piece.id, { lastPracticed: Date.now(), ...(better ? { bestAccuracy: sum.accuracy } : {}) });
    }
    if (lesson && sum.played > 0) completeLesson(lesson.id);
    setMessage(sum.accuracy >= 85 ? 'Bravo! That was wonderful playing. 👏' : sum.accuracy >= 60 ? 'Nicely done — you finished the piece!' : 'You made it to the end — every run-through makes it easier.');
    setSummary(sum);
  };

  const afterAdvance = () => {
    sync();
    if (session.done) { finish(); return; }
    const n = session.current;
    if (settings.autoPlayRef && n && !n.rest) setTimeout(() => hear(n.midi), 350);
  };

  const onReading = (r: PitchReading) => {
    if (r.time < ignoreUntil.current) return;
    const n = session.current;
    if (!n || session.done) return;
    if (r.midi == null) {
      setReading((prev) => (prev.cents == null && prev.heard === '—' ? prev : { cents: null, status: 'far', heard: '—' }));
      return;
    }
    const nearest = Math.round(r.midi);
    const off = Math.round((r.midi - nearest) * 100);
    const heard = `${prettyName(midiToName(nearest))} (${off >= 0 ? '+' : ''}${off}¢)`;
    if (n.rest) { setReading({ cents: null, status: 'far', heard }); return; }
    const fb = session.handleReading(r.midi, r.time);
    const cents = fb.cents ?? 0;
    setReading({ cents, heard, status: fb.status === 'in-tune' ? 'good' : Math.abs(cents) < 70 ? 'near' : 'far' });
    if (fb.message) setMessage(fb.message);
    if (fb.advanced) afterAdvance();
  };
  useLayoutEffect(() => { handler.current = onReading; });

  const startFrom = (i: number, msg = `Starting from note ${i + 1}.`) => {
    const s = makeSession(i);
    finished.current = false;
    setSession(s);
    sync(s);
    setSummary(null);
    setMessage(msg);
  };

  const n: Note | undefined = notes[view.index];

  // Rests advance by themselves while listening.
  const restBeats = n?.rest ? n.beats : null;
  const skipRest = useRef<() => void>(() => undefined);
  useLayoutEffect(() => { skipRest.current = () => { session.skip(performance.now()); afterAdvance(); }; });
  useEffect(() => {
    if (!listener.listening || restBeats == null) return;
    const t = setTimeout(() => skipRest.current(), Math.min(1500, (restBeats * 60000) / bpm()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.index, listener.listening, restBeats]);

  useEffect(() => () => { stopPlayback.current?.(); }, []);

  const toggleMic = async () => {
    if (listener.listening) { listener.stop(); setMessage('Paused. Press "Start listening" when you\'re ready.'); return; }
    try {
      await listener.start();
      setMessage(n && !n.rest ? `I'm listening. Play ${noteLabel(n)} with a long, steady bow.` : "I'm listening.");
    } catch (err) {
      setMessage(`I couldn't use the microphone (${(err as Error).message}). You can still practise: play each note and press "✓ I played it".`);
    }
  };

  const togglePlayAll = async () => {
    if (stopPlayback.current) { stopPlayback.current(); stopPlayback.current = null; setPlayIndex(null); return; }
    const from = view.done ? 0 : view.index;
    const seq = notes.slice(from);
    const total = seq.reduce((a, x) => a + Math.max(0.12, (x.beats * 60) / bpm()), 0);
    ignoreUntil.current = performance.now() + total * 1000 + 800;
    setMessage('Listen carefully — try to sing along in your head.');
    setPlayIndex(from);
    stopPlayback.current = await playMelody(seq, bpm(), {
      a4: settings.a4,
      onNote: (i) => setPlayIndex(from + i),
      onEnd: () => { stopPlayback.current = null; ignoreUntil.current = 0; setPlayIndex(null); },
    });
  };

  const drillTrickyNotes = (sum: Summary) => {
    const drill: Note[] = [];
    for (const h of sum.hardest) {
      const src = notes.find((x) => !x.rest && noteLabel(x) === h.label);
      if (src) for (let k = 0; k < 3; k++) drill.push({ ...src, beats: 2 });
    }
    const p = addPiece({ title: `Drill: ${title}`, format: 'Drill', notes: drill });
    router.replace(`/practice/piece/${p.id}`);
  };

  const f = n && !n.rest ? fingeringFor(n.midi) : null;

  const nowCard = (
    <Card style={wide ? { flex: 1.4 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>{view.done ? 'Finished' : `Note ${view.index + 1} of ${notes.length}`}</Text>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' }}>
          <View style={{ width: `${(view.index / notes.length) * 100}%`, height: '100%', backgroundColor: c.accent }} />
        </View>
      </View>
      {!n ? (
        <Text style={{ fontSize: 36, fontWeight: '700', textAlign: 'center', color: c.text, marginVertical: 12 }}>🎉 Done!</Text>
      ) : n.rest ? (
        <>
          <Text style={{ fontSize: 48, fontWeight: '700', textAlign: 'center', color: c.text, marginTop: 8 }}>Rest</Text>
          <P style={{ textAlign: 'center' }}>Rest for {n.beats} beat{n.beats === 1 ? '' : 's'}.</P>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 64, fontWeight: '700', textAlign: 'center', color: c.text, marginTop: 4 }} accessibilityLabel={`Play ${noteLabel(n)}`}>
            {noteLabel(n).replace(/-?\d+$/, '')}
            <Text style={{ fontSize: 24, color: c.muted }}>{n.octave}</Text>
          </Text>
          {f?.inRange ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <Pill>{f.string} string</Pill>
              <Pill>{f.finger === 0 ? 'Open' : `Finger ${f.finger}`}</Pill>
            </View>
          ) : null}
          <P style={{ textAlign: 'center', marginTop: 4 }}>{describeFingering(n.midi)}</P>
        </>
      )}
      <Meter cents={reading.cents} tolerance={settings.tolerance} status={reading.status} caption={reading.heard} />
      <Bubble>{message}</Bubble>
      <Row style={{ justifyContent: 'center' }}>
        <Button big title={listener.listening ? '⏸ Stop listening' : '🎤 Start listening'} variant={listener.listening ? 'success' : 'primary'} onPress={toggleMic} />
        <Button big title="🔊 Hear note" onPress={() => { if (n && !n.rest) hear(n.midi); }} disabled={!n || n.rest} />
      </Row>
      <Row style={{ justifyContent: 'center' }}>
        <Button title="⟵ Back" variant="ghost" onPress={() => { session.back(performance.now()); finished.current = false; setSummary(null); sync(); }} />
        <Button title="✓ I played it" variant="ghost" onPress={() => { session.confirm(performance.now()); afterAdvance(); }} disabled={view.done} />
        <Button title="Skip ⟶" variant="ghost" onPress={() => { session.skip(performance.now()); afterAdvance(); }} disabled={view.done} />
        <Button title="↺ Restart" variant="ghost" onPress={() => startFrom(0, 'From the top! Take a breath and play the first note.')} />
      </Row>
    </Card>
  );

  const boardCard = (
    <Card style={[{ alignItems: 'center' }, wide ? { flex: 1 } : undefined]}>
      <H3>Where to put your finger</H3>
      <Fingerboard midi={n && !n.rest ? n.midi : null} width={wide ? 220 : 180} />
    </Card>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Text style={{ color: c.text }}>Tempo</Text>
          <TextInput
            value={bpmText}
            onChangeText={setBpmText}
            onEndEditing={() => piece && updatePiece(piece.id, { tempo: bpm() })}
            keyboardType="number-pad"
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, width: 64, color: c.text, backgroundColor: c.surface }}
            accessibilityLabel="Tempo in beats per minute"
          />
          <Text style={{ color: c.text }}>bpm</Text>
        </Row>
        <Button title={playIndex != null ? '■ Stop' : '▶ Play whole piece'} onPress={togglePlayAll} />
      </Row>
      <Staff notes={notes} current={playIndex ?? view.index} marks={view.marks} onSelect={startFrom} />
      <P muted small>Numbers under each note = finger (0 = open string), letters = string. Tap a note to start from there.</P>
      {wide ? <View style={{ flexDirection: 'row', gap: 14 }}>{nowCard}{boardCard}</View> : <>{nowCard}{boardCard}</>}

      {summary && (
        <Card>
          <H2>Lesson notes from your teacher</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
            {[
              [`${summary.accuracy}%`, 'first-try accuracy'],
              [`${summary.played}/${summary.totalNotes}`, 'notes played'],
              [`${(summary.avgTimeMs / 1000).toFixed(1)}s`, 'avg. time per note'],
              [`${summary.tendencyCents > 0 ? '+' : ''}${Math.round(summary.tendencyCents)}¢`, 'average tuning'],
            ].map(([big, label]) => (
              <View key={label} style={{ flexGrow: 1, flexBasis: 130, backgroundColor: c.bg, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{big}</Text>
                <Text style={{ fontSize: 12, color: c.muted }}>{label}</Text>
              </View>
            ))}
          </View>
          {summary.tips.map((t) => <P key={t}>• {t}</P>)}
          <Row>
            <Button title="↺ Practise again" variant="primary" onPress={() => startFrom(0, 'From the top!')} />
            {summary.hardest.length > 0 && <Button title="Drill tricky notes" onPress={() => drillTrickyNotes(summary)} />}
            {lesson && <Button title="Back to lessons" variant="ghost" onPress={() => router.replace('/lessons')} />}
          </Row>
        </Card>
      )}
    </Screen>
  );
}
