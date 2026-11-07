import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, confirmAsync, H3, P, Row, Screen } from '../../components/ui';
import { useStore } from '../../state/store';
import { useColors } from '../../theme';

function Stepper({ label, value, display, onChange, step, min, max }: {
  label: string; value: number; display: string; onChange: (v: number) => void; step: number; min: number; max: number;
}) {
  const c = useColors();
  const btn = (txt: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Increase' : 'Decrease'} ${label}`}
      onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}
    >
      <Text style={{ fontSize: 20, color: c.text }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ color: c.text, fontSize: 15, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {btn('−', -step)}
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', minWidth: 80, textAlign: 'center' }}>{display}</Text>
        {btn('+', step)}
      </View>
    </View>
  );
}

export default function Settings() {
  const { settings, updateSettings, resetProgress, showToast } = useStore();
  const c = useColors();
  return (
    <Screen>
      <Card>
        <Text style={{ color: c.text, fontSize: 15 }}>Your name</Text>
        <TextInput
          value={settings.name}
          onChangeText={(name) => updateSettings({ name })}
          placeholder="So I can greet you"
          placeholderTextColor={c.muted}
          style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, color: c.text, backgroundColor: c.bg, fontSize: 15, marginVertical: 6 }}
        />
        <Stepper label="How strict should I be about tuning?" value={settings.tolerance} display={`±${settings.tolerance}¢`} step={5} min={10} max={50}
          onChange={(tolerance) => updateSettings({ tolerance })} />
        <P muted small>Beginners: ±30¢. Getting comfortable: ±20¢. Advanced: ±10¢.</P>
        <Stepper label="Hold each note for" value={settings.holdMs} display={`${settings.holdMs} ms`} step={100} min={100} max={1500}
          onChange={(holdMs) => updateSettings({ holdMs })} />
        <Stepper label="Default tempo" value={settings.bpm} display={`${settings.bpm} bpm`} step={4} min={30} max={200}
          onChange={(bpm) => updateSettings({ bpm })} />
        <Stepper label="Tuning reference (A4)" value={settings.a4} display={`${settings.a4} Hz`} step={1} min={415} max={466}
          onChange={(a4) => updateSettings({ a4 })} />
        <Row style={{ marginTop: 8 }}>
          <Switch value={settings.autoPlayRef} onValueChange={(autoPlayRef) => updateSettings({ autoPlayRef })} trackColor={{ true: c.accent, false: c.border }} />
          <Text style={{ color: c.text, flex: 1 }}>Play each note for me before I play it</Text>
        </Row>
        <P muted small>Tip: use headphones with this option, or I may hear my own reference tone.</P>
        <Button title="Reset lesson progress" variant="ghost" style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={async () => {
          if (await confirmAsync('Reset lesson progress and practice streak?', '', 'Reset')) { resetProgress(); showToast('Progress reset.'); }
        }} />
      </Card>
      <Card>
        <H3>Privacy</H3>
        <P small>Everything stays on this device. Microphone audio is analysed live and never recorded or uploaded.</P>
      </Card>
    </Screen>
  );
}
