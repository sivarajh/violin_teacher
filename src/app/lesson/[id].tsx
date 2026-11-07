import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playMelody, type StopFn } from '../../audio/tone';
import { Staff } from '../../components/Staff';
import { Button, Card, H1, H3, P, RichText, Row, Screen } from '../../components/ui';
import { LESSONS } from '../../lib/lessons';
import { parseNoteList } from '../../lib/notes';
import { useStore } from '../../state/store';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { progress, completeLesson, settings, showToast } = useStore();
  const idx = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[idx];
  const notes = useMemo(() => (lesson?.exercise ? parseNoteList(lesson.exercise).notes : []), [lesson]);
  const [playing, setPlaying] = useState<number | null>(null);
  const stopRef = useRef<StopFn | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  if (!lesson) {
    return <Screen><P>Lesson not found.</P><Button title="All lessons" onPress={() => router.replace('/lessons')} /></Screen>;
  }
  const done = progress.completedLessons.includes(lesson.id);
  const next = LESSONS[idx + 1];

  const toggleHear = async () => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; setPlaying(null); return; }
    setPlaying(-1);
    stopRef.current = await playMelody(notes, settings.bpm, {
      a4: settings.a4,
      onNote: (i) => setPlaying(i),
      onEnd: () => { stopRef.current = null; setPlaying(null); },
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Lesson ${idx + 1}` }} />
      <Card>
        <P muted small>Lesson {idx + 1} · {lesson.level}</P>
        <H1>{lesson.title}</H1>
        <RichText source={lesson.body} />
        {notes.length > 0 && (
          <>
            <H3 style={{ marginTop: 16 }}>Exercise</H3>
            <Staff notes={notes} current={playing ?? -1} />
            <Row>
              <Button title="🎤 Practise with me" variant="primary" onPress={() => { stopRef.current?.(); router.push(`/practice/lesson/${lesson.id}`); }} />
              <Button title={playing != null ? '■ Stop' : '▶ Hear it'} onPress={toggleHear} />
            </Row>
          </>
        )}
        <Row style={{ marginTop: 16 }}>
          <Button
            title={done ? '✓ Completed' : 'Mark as complete'}
            variant={done ? 'success' : 'default'}
            onPress={() => { completeLesson(lesson.id); showToast('Lesson complete — well done!'); }}
          />
          {next && <Button title={`Next: ${next.title} →`} variant="ghost" onPress={() => router.replace(`/lesson/${next.id}`)} />}
        </Row>
      </Card>
    </Screen>
  );
}
