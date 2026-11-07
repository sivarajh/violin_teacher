import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { P, Screen } from '../../components/ui';
import { LESSONS } from '../../lib/lessons';
import { useStore } from '../../state/store';
import { useColors } from '../../theme';

export default function Lessons() {
  const { progress } = useStore();
  const c = useColors();
  const done = new Set(progress.completedLessons);
  return (
    <Screen>
      <P muted>A step-by-step beginner course. Lessons with 🎤 exercises use your microphone to check your playing.</P>
      {LESSONS.map((l, i) => {
        const isDone = done.has(l.id);
        return (
          <Pressable
            key={l.id}
            onPress={() => router.push(`/lesson/${l.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, marginTop: 10,
              borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? c.good : c.accentSoft }}>
              <Text style={{ color: isDone ? '#fff' : c.accent, fontWeight: '700' }}>{isDone ? '✓' : i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{l.title}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{l.level} · {l.summary}{l.exercise ? ' · 🎤' : ''}</Text>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}
