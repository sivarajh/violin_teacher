import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Button, Card, confirmAsync, H3, Loading, P, Row, Screen } from '../../components/ui';
import { classifyFile, parseMXL, parseText, type ParsedScore } from '../../lib/parsers';
import { SAMPLES } from '../../lib/samples';
import { deleteImage, readAssetBytes, readAssetText, saveImage } from '../../state/files';
import { useStore } from '../../state/store';
import { useColors } from '../../theme';

export default function Music() {
  const store = useStore();
  const { ready, pieces, addPiece, deletePiece, updatePiece, showToast } = store;
  const c = useColors();
  const [pasteTitle, setPasteTitle] = useState('');
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ready) return <Loading />;

  const addScore = (res: ParsedScore, fallbackTitle: string) => {
    if (!res.notes.length) throw new Error('No notes found in this file.');
    return addPiece({ title: res.title || fallbackTitle, format: res.format, notes: res.notes, tempo: res.tempo });
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
    if (result.canceled) return;
    setBusy(true);
    let lastId: string | null = null;
    let count = 0;
    for (const asset of result.assets) {
      const base = asset.name.replace(/\.[^.]+$/, '');
      try {
        const kind = classifyFile(asset.name, asset.mimeType);
        if (kind === 'pdf') throw new Error("PDFs can't be read directly. Take a photo or screenshot of the page and add it with \"Photo of sheet music\".");
        if (kind === 'image') {
          const piece = addPiece({ title: base, format: 'Photo (transcribe)', notes: [], hasImage: true });
          await saveImage(piece.id, { uri: asset.uri, mimeType: asset.mimeType });
          lastId = piece.id;
          if (result.assets.length === 1) { setBusy(false); router.push(`/edit/${piece.id}`); return; }
        } else if (kind === 'mxl') {
          lastId = addScore({ format: 'MusicXML (compressed)', ...parseMXL(await readAssetBytes(asset)) }, base).id;
        } else {
          const res = parseText(await readAssetText(asset));
          lastId = addScore(res, base).id;
          if (res.errors?.length) showToast(`Ignored unrecognised: ${res.errors.slice(0, 5).join(', ')}`);
        }
        count++;
      } catch (err) {
        showToast(`${asset.name}: ${(err as Error).message}`);
      }
    }
    setBusy(false);
    if (count === 1 && lastId) router.push(`/practice/piece/${lastId}`);
    else if (count > 1) showToast(`Added ${count} pieces.`);
  };

  const pickPhoto = async (camera: boolean) => {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { showToast('Camera permission is needed to take a photo.'); return; }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: Platform.OS === 'web' };
    const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const piece = addPiece({ title: `Sheet music ${new Date().toLocaleDateString()}`, format: 'Photo (transcribe)', notes: [], hasImage: true });
    try {
      await saveImage(piece.id, { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
    } catch (err) {
      updatePiece(piece.id, { hasImage: false });
      showToast((err as Error).message);
    }
    router.push(`/edit/${piece.id}`);
  };

  const addPasted = () => {
    if (!paste.trim()) return;
    try {
      const res = parseText(paste);
      const piece = addPiece({ title: pasteTitle.trim() || res.title || 'Untitled piece', format: res.format, notes: res.notes, tempo: res.tempo });
      if (res.errors?.length) showToast(`Ignored unrecognised: ${res.errors.slice(0, 5).join(', ')}`);
      setPaste('');
      setPasteTitle('');
      setShowPaste(false);
      router.push(`/practice/piece/${piece.id}`);
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const remove = async (id: string, title: string, hasImage?: boolean) => {
    if (!(await confirmAsync(`Delete "${title}"?`, '', 'Delete'))) return;
    deletePiece(id);
    if (hasImage) deleteImage(id).catch(() => undefined);
  };

  const input = { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, color: c.text, backgroundColor: c.bg, fontSize: 15, marginVertical: 6 } as const;

  return (
    <Screen>
      <P muted>Add the notes you want to learn. I&apos;ll show you how to finger each one, play it for you, and listen as you play.</P>
      <Card>
        <H3>Add sheet music</H3>
        <Row>
          <Button title={busy ? 'Reading…' : '📄 Upload a file'} variant="primary" onPress={pickFile} disabled={busy} />
          <Button title="📷 Photo of sheet music" onPress={() => pickPhoto(Platform.OS !== 'web')} />
          {Platform.OS !== 'web' && <Button title="🖼 Choose photo" onPress={() => pickPhoto(false)} />}
          <Button title="⌨️ Type / paste notes" variant="ghost" onPress={() => setShowPaste((v) => !v)} />
        </Row>
        <P muted small>Files: MusicXML (.musicxml, .xml, .mxl), ABC (.abc) or a note list (.txt). Photos open a note pad so you can tap in the notes.</P>
        {showPaste && (
          <View style={{ marginTop: 8 }}>
            <TextInput style={input} placeholder="Title (optional)" placeholderTextColor={c.muted} value={pasteTitle} onChangeText={setPasteTitle} />
            <TextInput
              style={[input, { minHeight: 110, textAlignVertical: 'top', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }]}
              multiline
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={'Paste ABC or MusicXML, or type notes like:\nD4 E4 F#4 G4 A4:2   (":2" = two beats, R = rest)'}
              placeholderTextColor={c.muted}
              value={paste}
              onChangeText={setPaste}
            />
            <Button title="Add piece" variant="primary" onPress={addPasted} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
        <Row>
          <Text style={{ color: c.muted, fontSize: 14 }}>Try a sample:</Text>
          {SAMPLES.map((s) => (
            <Button key={s.label} title={s.label} variant="ghost" onPress={() => {
              const res = parseText(s.text);
              addPiece({ title: res.title || s.label, format: res.format, notes: res.notes, tempo: res.tempo });
              showToast(`Added "${res.title || s.label}"`);
            }} />
          ))}
        </Row>
      </Card>

      <H3 style={{ marginTop: 8 }}>Library</H3>
      {!pieces.length && <P muted>No music yet. Add a file above or try a sample.</P>}
      {pieces.map((p) => (
        <Card key={p.id}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{p.title}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {p.format} · {p.notes.filter((n) => !n.rest).length} notes
            {p.bestAccuracy != null ? ` · best ${p.bestAccuracy}%` : ''}
            {p.lastPracticed ? ` · practised ${new Date(p.lastPracticed).toLocaleDateString()}` : ''}
          </Text>
          <Row>
            {p.notes.length > 0 && <Button title="Practise" variant="primary" onPress={() => router.push(`/practice/piece/${p.id}`)} />}
            <Button title={p.notes.length ? 'Edit notes' : 'Transcribe'} onPress={() => router.push(`/edit/${p.id}`)} />
            <Button title="🗑 Delete" variant="ghost" accessibilityLabel={`Delete ${p.title}`} onPress={() => remove(p.id, p.title, p.hasImage)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
