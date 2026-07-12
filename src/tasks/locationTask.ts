import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { supabase } from '../lib/supabase';

export const LOCATION_TASK = 'artemis-background-location';

// This file must be imported at the root of App.tsx (top-level, outside any
// component) so that TaskManager.defineTask runs before the OS ever tries to
// wake the app to deliver a location update.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[LocationTask]', error.message);
    return;
  }
  const locations = (data as any)?.locations as Location.LocationObject[] | undefined;
  if (!locations?.length) return;

  // Use the session persisted in AsyncStorage — works without React context.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const loc = locations[locations.length - 1];
  let battery_level: number | null = null;
  try { battery_level = await Battery.getBatteryLevelAsync(); } catch { /* best-effort */ }
  try {
    await supabase.from('presence').upsert(
      {
        user_id: session.user.id,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        updated_at: new Date().toISOString(),
        ...(battery_level !== null ? { battery_level } : {}),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // best-effort — don't crash the background task
  }
});
