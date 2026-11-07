import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { playTone } from '../../audio/tone';
import { Staff } from '../../components/Staff';
import { Button, Card, confirmAsync, H3, P, Row, Screen } from '../../components/ui';
import { fingeringFor, midiToName, parseNoteList, prettyName, STRINGS, toNoteList } from '../../lib/notes';
import { loadImage } from '../../state/files';
import { useStore } from '../../state/store';
import { useColors } from '../../theme';

const LENGTHS = [
  { beats: 4, label: 'whole' },
  { beats: 3, label: 'dotted half' },
  { beats: 2, label: 'half' },
  { beats: 1.5, label: 'dotted ¼' },
  { beats: 1, label: 'quarter' },
  { beats: 0.5, label: 'eighth' },
  { beats: 0.25, label: '16th' },
];

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pieces, updatePiece, settings, showToast } = useStore();
  const piece = pieces.find((p) => p.id === id);
  const c = useColors();
  const [title, setTitle] = useState(piece?.title ?? '');
  const [text, setText] = useState(piece ? toNoteList(piece.notes) : '');
  const [beats, setBeats] = useState(1);
  const [flats, setFlats] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1.3);

  useEffect(() => {
    if (!piece?.hasImage) return;
    loadImage(piece.id).then((uri) => {
      setImage(uri);
      if (uri) Image.getSize(uri, (w, h) => setAspect(w / h), () => undefined);
    });
  }, [piece?.id, piece?.hasImage]);

  const parsed = useMemo(() => parseNoteList(text), [text]);

  if (!piece) return <Screen><P>This piece no longer exists.</P></Screen>;

  const append = (tok: string) => setText((t) => (t.trim() + ' ' + tok).trim());
  const tokenFor = (name: string) => (beats === 1 ? name : `${name}:${beats}`);

  const save = (andPractise: boolean) => {
    const notes = parsed.notes;
    updatePiece(piece.id, {
      title: title.trim() || piece.title,
      notes,
      format: notes.length ? piece.format.replace('(transcribe)', '(transcribed)') : piece.format,
    });
    if (andPractise) {
      if (!notes.length) { showToast('Add some notes first.'); return; }
      router.replace(`/practice/piece/${piece.id}`);
    } else showToast('Saved.');
  };

  const input = { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, color: c.text, backgroundColor: c.bg, fontSize: 15, marginVertical: 6 } as const;

  const padRows: { label: string; keys: number[] }[] = STRINGS.map((s, i) => {
    const max = i === 3 ? 7 : 6;
    const keys = [];
    for (let o = 0; o <= max; o++) keys.push(s.midi + o);
    return { label: s.name, keys };
  });
  padRows.push({ label: '↑', keys: [84, 85, 86, 88] });

  return (
    <Screen>
      <Stack.Screen options={{ title: piece.notes.length ? 'Edit notes' : 'Transcribe' }} />
      {image && (
        <Card style={{ padding: 8 }}>
          <Image source={{ uri: image }} style={{ width: '100%', aspectRatio: aspect, borderRadius: 8 }} resizeMode="contain" accessibilityLabel="Your sheet music" />
        </Card>
      )}
      <Card>
        <Text style={{ color: c.muted, fontSize: 14 }}>Title</Text>
        <TextInput style={input} value={title} onChangeText={setTitle} />
        {piece.hasImage && <P muted small>Read the notes from your photo and tap them on the pad. Pick the note length first.</P>}

        <H3 style={{ marginTop: 8 }}>Note length</H3>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {LENGTHS.map((l) => (
            <Pressable key={l.beats} onPress={() => setBeats(l.beats)} accessibilityRole="radio" accessibilityState={{ selected: beats === l.beats }}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: beats === l.beats ? c.accent : c.border, backgroundColor: beats === l.beats ? c.accentSoft : c.surface }}>
              <Text style={{ color: beats === l.beats ? c.accent : c.text, fontSize: 13, fontWeight: '600' }}>{l.label} ({l.beats})</Text>
            </Pressable>
          ))}
        </View>
        <Row>
          <Switch value={flats} onValueChange={setFlats} trackColor={{ true: c.accent, false: c.border }} />
          <Text style={{ color: c.text }}>Use flats (♭)</Text>
        </Row>

        <View style={{ gap: 4, marginVertical: 6 }}>
          {padRows.map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ width: 18, color: c.muted, fontWeight: '700' }}>{row.label}</Text>
              {row.keys.map((midi) => {
                const name = midiToName(midi, flats);
                const f = fingeringFor(midi);
                return (
                  <Pressable
                    key={midi}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${prettyName(name)}`}
                    onPress={() => { append(tokenFor(name)); playTone(midi, 0.5, settings.a4).catch(() => undefined); }}
                    style={({ pressed }) => ({
                      flex: 1, minWidth: 0, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
                      borderWidth: 1, borderColor: f.finger === 0 ? c.accent : c.border,
                      backgroundColor: pressed ? c.accentSoft : name.length > 2 ? c.bg : c.surface,
                    })}
                  >
                    <Text style={{ color: c.text, fontSize: 12 }} numberOfLines={1}>{prettyName(name)}</Text>
                    {f.inRange && <Text style={{ color: c.muted, fontSize: 10 }}>{f.finger}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Row>
          <Button title="Rest" onPress={() => append(tokenFor('R'))} />
          <Button title="⌫ Undo" onPress={() => setText((t) => t.trim().split(/\s+/).slice(0, -1).join(' '))} />
          <Button title="Clear" variant="ghost" onPress={async () => { if (await confirmAsync('Clear all notes?', '', 'Clear')) setText(''); }} />
        </Row>

        <Text style={{ color: c.muted, fontSize: 14, marginTop: 6 }}>Notes (you can also type here)</Text>
        <TextInput
          style={[input, { minHeight: 80, textAlignVertical: 'top', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }]}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          value={text}
          onChangeText={setText}
        />
        {parsed.errors.length > 0 && <Text style={{ color: c.far, fontSize: 13 }}>Not recognised: {parsed.errors.join(' ')}</Text>}
        {parsed.notes.length > 0 && <Staff notes={parsed.notes} current={parsed.notes.length - 1} />}
        <Row>
          <Button title="Save & practise" variant="primary" onPress={() => save(true)} />
          <Button title="Save" onPress={() => save(false)} />
        </Row>
      </Card>
    </Screen>
  );
}
