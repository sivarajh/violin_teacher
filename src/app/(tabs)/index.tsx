import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, H1, H2, H3, Loading, P, Screen } from '../../components/ui';
import { LESSONS } from '../../lib/lessons';
import { streak, useStore } from '../../state/store';
import { useColors } from '../../theme';

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

export default function Home() {
  const { ready, progress, pieces, settings } = useStore();
  const c = useColors();
  if (!ready) return <Loading />;

  const s = streak(progress.days);
  const done = new Set(progress.completedLessons);
  const next = LESSONS.find((l) => !done.has(l.id)) || LESSONS[LESSONS.length - 1];
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const recent = [...pieces].sort((a, b) => (b.lastPracticed || b.created) - (a.lastPracticed || a.created)).slice(0, 3);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32 }}>🎻</Text>
        </View>
        <View style={{ flex: 1 }}>
          <H1>{greet}{settings.name ? `, ${settings.name}` : ''}!</H1>
          <P>
            {s ? `You're on a ${s}-day practice streak — keep it going!` : "Ready for some practice? Let's begin."}
            {done.size ? ` You've completed ${done.size} of ${LESSONS.length} lessons.` : ''}
          </P>
        </View>
      </View>

      <Card tone="accent">
        <H3>Today&apos;s lesson</H3>
        <P muted small>{next.level}</P>
        <H2>{next.title}</H2>
        <P>{next.summary}</P>
        <Button title="Start lesson" variant="primary" onPress={() => router.push(`/lesson/${next.id}`)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </Card>

      <Card>
        <H3>Your music</H3>
        {recent.length ? recent.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(p.notes.length ? `/practice/piece/${p.id}` : `/edit/${p.id}`)} style={{ paddingVertical: 6 }}>
            <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600' }}>{p.title}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {p.notes.length} notes{p.bestAccuracy != null ? ` · best ${p.bestAccuracy}%` : ''}
            </Text>
          </Pressable>
        )) : <P>Add the sheet music you&apos;re learning, and I&apos;ll teach it to you note by note.</P>}
        <Button title={recent.length ? 'All music' : 'Add music'} onPress={() => router.push('/music')} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </Card>

      <Card>
        <H3>Tune up</H3>
        <P>Always start by tuning your strings: G, D, A, E.</P>
        <Button title="Open tuner" onPress={() => router.push('/tuner')} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </Card>

      <Card tone="tip">
        <H3>Teacher&apos;s tip</H3>
        <P>{tip}</P>
      </Card>
    </Screen>
  );
}
