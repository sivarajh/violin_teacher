import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme';

type Props = {
  /** Cents off target (clamped to ±50 for display), or null when nothing is heard. */
  cents: number | null;
  /** In-tune zone half-width in cents. */
  tolerance: number;
  status?: 'good' | 'near' | 'far';
  labels?: [string, string, string];
  caption?: string;
  tall?: boolean;
};

export function Meter({ cents, tolerance, status = 'far', labels = ['♭ flat', 'in tune', 'sharp ♯'], caption, tall }: Props) {
  const c = useColors();
  const pos = 50 + Math.max(-50, Math.min(50, cents ?? 0));
  const color = status === 'good' ? c.good : status === 'near' ? c.near : c.far;
  return (
    <View style={{ marginVertical: 10 }} accessibilityLabel={cents == null ? 'Not hearing a note' : `${Math.round(cents)} cents`}>
      <View style={styles.scale}>
        {labels.map((l) => <Text key={l} style={{ color: c.muted, fontSize: 12 }}>{l}</Text>)}
      </View>
      <View style={[styles.track, { height: tall ? 30 : 22, backgroundColor: c.bg, borderColor: c.border }]}>
        <View style={[styles.zone, { left: `${50 - tolerance}%`, width: `${tolerance * 2}%`, backgroundColor: c.good, opacity: 0.22 }]} />
        <View style={[styles.needle, { left: `${pos}%`, backgroundColor: color, opacity: cents == null ? 0.2 : 1 }]} />
      </View>
      {caption != null && <Text style={{ textAlign: 'center', color: c.muted, fontSize: 14, marginTop: 4 }}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  track: { borderWidth: 1, borderRadius: 11, position: 'relative' },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  needle: { position: 'absolute', top: -5, bottom: -5, width: 6, marginLeft: -3, borderRadius: 3 },
});
