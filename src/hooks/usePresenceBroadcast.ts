import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useAppState } from '../state/AppState';

const INTERVAL_MS = 30_000;

/**
 * While the user has location sharing on, push their coords to public.presence
 * every 30s. Foreground only (Expo Go limitation).
 */
export function usePresenceBroadcast() {
  const { user } = useAuth();
  const { sharing } = useAppState();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !sharing) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const ask = await Location.requestForegroundPermissionsAsync();
          if (ask.status !== 'granted') return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        await supabase.from('presence').upsert(
          { user_id: user.id, lat: loc.coords.latitude, lng: loc.coords.longitude, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      } catch {
        // best-effort
      }
    };

    tick();
    timer.current = setInterval(tick, INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [user, sharing]);
}
