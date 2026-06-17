import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const KEY = 'artemis.home_place';

export interface HomePlace {
  lat: number;
  lng: number;
  label: string;
}

/**
 * A single saved "home" location used for geofenced auto check-in: when a trip
 * reaches this spot, Artemis can mark you arrived without any tapping.
 */
export function useHomePlace() {
  const [home, setHome] = useState<HomePlace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) {
        try {
          setHome(JSON.parse(v));
        } catch {
          // ignore corrupt value
        }
      }
      setLoading(false);
    });
  }, []);

  /** Save the device's current position as home. Returns an error string on failure. */
  const setFromCurrentLocation = useCallback(async (): Promise<{ error?: string }> => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { error: 'Location permission is needed to set your home.' };
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let label = 'Home';
      try {
        const geo = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        const g = geo[0];
        if (g) label = [g.name ?? g.street, g.city].filter(Boolean).join(', ') || 'Home';
      } catch {
        // keep default label
      }
      const next: HomePlace = { lat: loc.coords.latitude, lng: loc.coords.longitude, label };
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      setHome(next);
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const clearHome = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
    setHome(null);
  }, []);

  return { home, loading, setFromCurrentLocation, clearHome };
}
