// File helpers for iOS/Android.

import type { DocumentPickerAsset } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

export async function readAssetBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  return new File(asset.uri).bytes();
}

export async function readAssetText(asset: DocumentPickerAsset): Promise<string> {
  return new File(asset.uri).text();
}

function sheetsDir(): Directory {
  const dir = new Directory(Paths.document, 'sheets');
  if (!dir.exists) dir.create();
  return dir;
}

function imageFile(id: string): File {
  return new File(sheetsDir(), `${id}.jpg`);
}

/** Keep a copy of a picked photo with the app's data. */
export async function saveImage(id: string, asset: { uri: string; base64?: string | null; mimeType?: string | null }): Promise<void> {
  const dest = imageFile(id);
  if (dest.exists) dest.delete();
  await new File(asset.uri).copy(dest);
}

/** Returns a URI usable as an <Image> source, or null. */
export async function loadImage(id: string): Promise<string | null> {
  const f = imageFile(id);
  return f.exists ? f.uri : null;
}

export async function deleteImage(id: string): Promise<void> {
  const f = imageFile(id);
  if (f.exists) f.delete();
}
