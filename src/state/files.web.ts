// File helpers for the web build.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DocumentPickerAsset } from 'expo-document-picker';

async function blobOf(asset: DocumentPickerAsset): Promise<Blob> {
  if (asset.file) return asset.file;
  return (await fetch(asset.uri)).blob();
}

export async function readAssetBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  return new Uint8Array(await (await blobOf(asset)).arrayBuffer());
}

export async function readAssetText(asset: DocumentPickerAsset): Promise<string> {
  return (await blobOf(asset)).text();
}

const key = (id: string) => `vt.image.${id}`;

async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function saveImage(id: string, asset: { uri: string; base64?: string | null; mimeType?: string | null }): Promise<void> {
  const data = asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : await toDataUrl(asset.uri);
  try {
    await AsyncStorage.setItem(key(id), data);
  } catch {
    throw new Error('This photo is too large to save in the browser. Try a smaller photo or screenshot.');
  }
}

export async function loadImage(id: string): Promise<string | null> {
  return AsyncStorage.getItem(key(id));
}

export async function deleteImage(id: string): Promise<void> {
  await AsyncStorage.removeItem(key(id));
}
