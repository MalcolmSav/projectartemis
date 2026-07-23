import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { useTrips } from './useTrips';
import { TRIP_LOCATION_TASK } from '../tasks/locationTask';

/**
 * Uber-style live tracking for the duration of an active trip.
 *
 * Starts a dedicated background location task when a trip is active and stops
 * it when the trip ends — independent of the general "share location" toggle,
 * so the buddy keeps seeing the traveler even when the app is closed or the
 * phone is locked. The task itself (src/tasks/locationTask.ts) upserts to
 * public.presence, which the follower screen already subscribes to.
 */
export function useTripBroadcast() {
  const { activeTrip, loading } = useTrips();

  useEffect(() => {
    if (Platform.OS === 'web' || loading) return;

    if (!activeTrip) {
      // No active trip (ended, cancelled, or ended while the app was killed) —
      // make sure the tracker is off.
      Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)
        .then((running) => { if (running) Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK); })
        .catch(() => {});
      return;
    }

    (async () => {
      try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') return;
        // Background ("Always Allow") keeps updates flowing with the app
        // closed; without it the trip still tracks while foregrounded.
        await Location.requestBackgroundPermissionsAsync();

        const already = await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK);
        if (already) return;

        // Cap at 15 s so the follower's marker moves like a ride-share app
        // even if the user picked a long presence interval.
        const intervalS = Math.min(activeTrip.location_interval ?? 60, 15);
        await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: intervalS * 1000,
          distanceInterval: 20, // metres — also push on movement
          showsBackgroundLocationIndicator: true, // iOS blue pill
          foregroundService: {
            notificationTitle: 'Artemis — trip in progress',
            notificationBody: 'Your buddy can follow your live location',
            notificationColor: '#D4A933',
          },
          pausesUpdatesAutomatically: false,
        });
      } catch {
        // best-effort — foreground timer in TripActiveScreen still works
      }
    })();
  }, [activeTrip?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps
}
