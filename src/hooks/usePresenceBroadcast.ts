import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../state/Auth';
import { useAppState } from '../state/AppState';
import { LOCATION_TASK } from '../tasks/locationTask';

/**
 * Starts / stops the background location task based on the sharing toggle.
 *
 * Uses startLocationUpdatesAsync so presence updates keep flowing even when
 * the app is backgrounded. The actual upsert to public.presence is done
 * inside the TaskManager task (src/tasks/locationTask.ts), which the OS can
 * wake the app to run even when it is not in the foreground.
 *
 * On iOS the system shows a blue status-bar indicator while location is active.
 * On Android a persistent foreground-service notification is shown (required
 * by the OS to keep the task alive).
 */
export function usePresenceBroadcast() {
  const { user } = useAuth();
  const { sharing } = useAppState();

  useEffect(() => {
    if (!user) return;

    if (!sharing) {
      // Turn off — stop the background task if it's running.
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
        .then((running) => { if (running) Location.stopLocationUpdatesAsync(LOCATION_TASK); })
        .catch(() => {});
      return;
    }

    (async () => {
      try {
        // Foreground permission is required before we can ask for background.
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') return;

        // Background ("Always Allow") permission — the app still works with
        // foreground-only, just won't update while the screen is off.
        await Location.requestBackgroundPermissionsAsync();

        // Avoid double-registering (e.g. hot reload in dev).
        const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
        if (already) return;

        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,     // at most every 10 s
          distanceInterval: 10,     // or when moved ≥10 m
          showsBackgroundLocationIndicator: true,  // iOS blue pill
          foregroundService: {
            // Android: keeps the task alive as a foreground service
            notificationTitle: 'Artemis — sharing location',
            notificationBody: 'Your circle can see your location',
            notificationColor: '#D4A933',
          },
          pausesUpdatesAutomatically: false,
        });
      } catch {
        // best-effort
      }
    })();

    // Do NOT stop on unmount — the task needs to outlive the component.
    // It's stopped above when sharing flips to false.
  }, [user, sharing]);
}
