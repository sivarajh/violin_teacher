import { useState } from 'react';
import { Text, View } from 'react-native';
import { playTone } from '../../audio/tone';
import type { PitchReading } from '../../audio/types';
import { usePitchListener } from '../../audio/usePitch';
import { Meter } from '../../components/Meter';
import { Bubble, Button, Card, H3, P, Row, Screen } from '../../components/ui';
import { midiToName, prettyName, STRINGS } from '../../lib/notes';
import { useStore } from '../../state/store';
import { useColors } from '../../theme';

function advice(midi: number): string {
  const s = STRINGS.reduce((best, st) => (Math.abs(st.midi - midi) < Math.abs(best.midi - midi) ? st : best));
  const off = (midi - s.midi) * 100;
  if (Math.abs(off) > 150) return `That's not near an open string. The closest is the ${s.name} string.`;
  if (Math.abs(off) <= 5) return `✓ ${s.name} string is in tune!`;
  if (off > 0) return `${s.name} string is sharp (+${Math.round(off)}¢): ${off > 50 ? 'loosen the peg slightly' : 'turn the fine tuner anticlockwise (loosen)'}.`;
  return `${s.name} string is flat (${Math.round(off)}¢): ${off < -50 ? 'tighten the peg slightly, pushing it in as you turn' : 'turn the fine tuner clockwise (tighten)'}.`;
}

export default function Tuner() {
  const { settings } = useStore();
  const c = useColors();
  const [state, setState] = useState<{ note: string; detail: string; cents: number | null; tip: string }>({
    note: '—', detail: 'Press start and play a string', cents: null, tip: `Reference pitch: A4 = ${settings.a4} Hz`,
  });

  const onReading = (r: PitchReading) => {
    if (r.midi == null) { setState((s) => (s.cents == null ? s : { ...s, cents: null })); return; }
    const nearest = Math.round(r.midi);
    const cents = (r.midi - nearest) * 100;
    setState({
      note: prettyName(midiToName(nearest)),
      detail: `${r.freq.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${Math.round(cents)}¢`,
      cents,
      tip: advice(r.midi),
    });
  };
  const listener = usePitchListener(onReading, settings.a4);

  const toggle = async () => {
    if (listener.listening) { listener.stop(); return; }
    try {
      await listener.start();
    } catch (err) {
      setState((s) => ({ ...s, tip: `Microphone unavailable: ${(err as Error).message} Use the reference tones to tune by ear.` }));
    }
  };

  const abs = state.cents == null ? 99 : Math.abs(state.cents);
  return (
    <Screen>
      <P muted>Play one open string at a time with a long bow. Use the fine tuners for small changes, and the pegs only for big ones.</P>
      <Card style={{ alignItems: 'stretch' }}>
        <Text style={{ fontSize: 80, fontWeight: '700', color: c.text, textAlign: 'center' }}>{state.note}</Text>
        <Text style={{ color: c.muted, textAlign: 'center' }}>{state.detail}</Text>
        <Meter tall cents={state.cents} tolerance={5} labels={['−50¢', '0', '+50¢']} status={abs <= 5 ? 'good' : abs <= 15 ? 'near' : 'far'} />
        <Bubble>{state.tip}</Bubble>
        <Button big title={listener.listening ? '⏸ Stop tuner' : '🎤 Start tuner'} variant={listener.listening ? 'success' : 'primary'} onPress={toggle} />
        <View style={{ marginTop: 18, alignItems: 'center' }}>
          <H3>Reference tones</H3>
          <Row style={{ justifyContent: 'center' }}>
            {STRINGS.map((s) => (
              <Button key={s.name} title={s.name} big style={{ minWidth: 64 }} accessibilityLabel={`Play ${s.name} string reference`}
                onPress={() => playTone(s.midi, 2.5, settings.a4).catch(() => undefined)} />
            ))}
          </Row>
        </View>
      </Card>
    </Screen>
  );
}
