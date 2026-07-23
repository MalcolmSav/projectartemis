import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabase';

/**
 * One-shot: capture the current position and upsert it to public.presence.
 *
 * Used when answering a wellness check so the sender can see WHERE the
 * response came from on the map — even if the responder doesn't have
 * continuous location sharing turned on. Best-effort and fast: falls back to
 * the last known fix, and silently does nothing without permission.
 */
export async function shareCurrentPosition(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    let loc = await Location.getLastKnownPositionAsync();
    if (!loc || Date.now() - loc.timestamp > 60_000) {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    }
    if (!loc) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('presence').upsert(
      {
        user_id: session.user.id,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // best-effort — the response itself still goes through
  }
}
