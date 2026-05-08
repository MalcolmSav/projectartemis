import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/**
 * Pick an image from the gallery, upload it to Supabase Storage under
 * `avatars/{userId}/avatar.jpg`, and update the profile's avatar_url.
 * Returns the public URL on success.
 */
export async function pickAndUploadAvatar(userId: string): Promise<{ url?: string; error?: string }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: 'Photo library permission denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return {};

  const asset = result.assets[0];
  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${userId}/avatar.${ext === 'heic' ? 'jpg' : ext}`;

  // Convert base64 → ArrayBuffer (RN-friendly upload path)
  if (!asset.base64) return { error: 'No image data' };
  const arrayBuffer = base64ToArrayBuffer(asset.base64);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, {
      contentType: `image/${ext === 'jpg' || ext === 'heic' ? 'jpeg' : ext}`,
      upsert: true,
    });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so the new image shows immediately
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: e2 } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (e2) return { error: e2.message };

  return { url };
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = globalThis.atob ? globalThis.atob(b64) : decodeBase64Polyfill(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Minimal base64 decoder for RN environments without atob
function decodeBase64Polyfill(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = input.replace(/=+$/, '');
  let out = '';
  for (let i = 0, bc = 0, bs = 0, buffer; (buffer = s.charAt(i++)); ) {
    const idx = chars.indexOf(buffer);
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) out += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return out;
}
