import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Thin, crash-proof bridge to the native iOS Live Activity (Dynamic Island +
 * lock-screen card) for an active trip.
 *
 * The native module (`ArtemisLiveActivity`) lives in native-staging/ and is
 * NOT linked until you follow native-staging/live-activity/README.md and run an
 * EAS build. Until then — and on Android/web, and on iOS < 16.2 — every call
 * here is a safe no-op: `requireOptionalNativeModule` returns null and each
 * function swallows any error. So this can be wired into the trip lifecycle
 * today without affecting the current build at all.
 */
const Native = Platform.OS === 'ios' ? requireOptionalNativeModule('ArtemisLiveActivity') : null;

export interface TripActivityState {
  /** ETA clock string, e.g. "21:30" or "—". */
  etaText: string;
  /** Unix seconds the trip is expected to end — drives the native self-ticking
   *  countdown so it stays smooth without JS updates. null when no ETA/route. */
  endEpochSec: number | null;
  /** "1.2 km left" or "" when unknown. */
  distanceText: string;
  /** 0–1 progress along the route. */
  progress: number;
  /** Buddy's display name for the "👀 {name} is watching" line. */
  buddyName: string;
  /** True once the buddy has opened the trip (followed_at set). */
  isFollowing: boolean;
  status: 'on_the_way' | 'arrived' | 'escalated';
}

export function isLiveActivitiesSupported(): boolean {
  try {
    return !!Native && Native.isSupported() === true;
  } catch {
    return false;
  }
}

/** Begin a Live Activity for a trip. Returns an opaque id (or null if unavailable). */
export function startTripActivity(input: {
  destination: string;
  transport: string;
  state: TripActivityState;
}): string | null {
  try {
    if (!Native) return null;
    return (Native.start(input.destination, input.transport, input.state) as string | null) ?? null;
  } catch {
    return null;
  }
}

export function updateTripActivity(id: string | null, state: TripActivityState): void {
  try {
    if (Native && id) Native.update(id, state);
  } catch {
    // best-effort
  }
}

export function endTripActivity(id: string | null): void {
  try {
    if (Native && id) Native.end(id);
  } catch {
    // best-effort
  }
}
