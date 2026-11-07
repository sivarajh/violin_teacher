import { Fragment, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useColors } from '../theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const inner = <View style={styles.inner}>{children}</View>;
  if (!scroll) return <View style={[styles.screen, { backgroundColor: c.bg }]}>{inner}</View>;
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export function Card({ children, style, tone = 'plain' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'plain' | 'accent' | 'tip' }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tone === 'accent' ? c.accentSoft : c.surface, borderColor: tone === 'accent' ? 'transparent' : c.border },
        tone === 'tip' && { borderLeftWidth: 4, borderLeftColor: c.accent },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'default' | 'ghost' | 'success';
  big?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ title, onPress, variant = 'default', big, disabled, style, accessibilityLabel }: BtnProps) {
  const c = useColors();
  const bg = variant === 'primary' ? c.accent : variant === 'success' ? c.good : variant === 'ghost' ? 'transparent' : c.surface;
  const fg = variant === 'primary' ? c.accentInk : variant === 'success' ? '#fff' : c.text;
  const border = variant === 'primary' ? c.accent : variant === 'success' ? c.good : c.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        big && styles.btnBig,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, big && { fontSize: 17 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text accessibilityRole="header" style={[styles.h1, { color: c.text }]}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text accessibilityRole="header" style={[styles.h2, { color: c.text }]}>{children}</Text>;
}

export function H3({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text accessibilityRole="header" style={[styles.h3, { color: c.text }, style]}>{children}</Text>;
}

export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[styles.p, { color: muted ? c.muted : c.text }, small && { fontSize: 14 }, style]}>{children}</Text>;
}

export function Pill({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: c.accentSoft }]}>
      <Text style={{ color: c.accent, fontWeight: '600', fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Bubble({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.bubble, { backgroundColor: c.accentSoft }]} accessibilityLiveRegion="polite">
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

/** Inline **bold** support. */
function Inline({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <Text key={i} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>
          : <Fragment key={i}>{part}</Fragment>,
      )}
    </Text>
  );
}

/** Renders the lesson markup: "## h", "- bullet", "1. item", "> tip", paragraphs. */
export function RichText({ source }: { source: string }) {
  const c = useColors();
  const base = { color: c.text, fontSize: 16, lineHeight: 24 };
  return (
    <View>
      {source.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <View key={i} style={{ height: 8 }} />;
        if (t.startsWith('## ')) return <H3 key={i} style={{ marginTop: 12 }}>{t.slice(3)}</H3>;
        if (t.startsWith('> ')) {
          return (
            <View key={i} style={[styles.tip, { backgroundColor: c.accentSoft }]}>
              <Inline style={base} text={`**Teacher's tip:** ${t.slice(2)}`} />
            </View>
          );
        }
        const bullet = /^(-|\d+\.)\s+(.*)$/.exec(t);
        if (bullet) {
          return (
            <View key={i} style={styles.li}>
              <Text style={[base, styles.liMark]}>{bullet[1] === '-' ? '•' : bullet[1]}</Text>
              <Inline style={[base, { flex: 1 }]} text={bullet[2]} />
            </View>
          );
        }
        return <Inline key={i} style={[base, { marginVertical: 2 }]} text={t} />;
      })}
    </View>
  );
}

/** Cross-platform confirm dialog. */
export function confirmAsync(title: string, message = '', okText = 'OK'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnBig: { paddingVertical: 14, paddingHorizontal: 20 },
  btnText: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginVertical: 6 },
  h1: { fontSize: 26, fontWeight: '700', marginVertical: 6 },
  h2: { fontSize: 21, fontWeight: '700', marginVertical: 4 },
  h3: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  p: { fontSize: 16, lineHeight: 23, marginVertical: 2 },
  pill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  bubble: { borderRadius: 12, padding: 12, marginVertical: 10, minHeight: 50 },
  tip: { borderRadius: 10, padding: 12, marginVertical: 10 },
  li: { flexDirection: 'row', marginVertical: 2, paddingLeft: 4 },
  liMark: { width: 24 },
});
