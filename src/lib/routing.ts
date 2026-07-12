// Free OSM-based place search + routing.
//  - Geocoding: Nominatim (https://nominatim.org) — usage policy: max 1 req/s, debounce searches.
//  - Routing:   OSRM via routing.openstreetmap.de — profiles for car / bike / foot.
// No API keys needed.

import { Platform } from 'react-native';

export type TravelMode = 'walk' | 'bike' | 'car';

export interface Place {
  name: string;        // short display name (first segment)
  fullName: string;    // complete formatted address
  lat: number;
  lng: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Route {
  coords: LatLng[];    // route geometry, ready for a Polyline
  distanceM: number;   // metres
  durationS: number;   // seconds
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM_BASE = 'https://routing.openstreetmap.de';

const OSRM_PROFILE: Record<TravelMode, string> = {
  car: 'routed-car',
  bike: 'routed-bike',
  walk: 'routed-foot',
};

// Browsers forbid setting User-Agent; native fetch allows it (Nominatim asks for one).
const headers: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'Artemis-Safety-App/1.0 (se.embelstudio.artemis)' };

/** Search for places by free-text query. Biased toward the given location if provided. */
export async function searchPlaces(query: string, near?: LatLng): Promise<Place[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: '6',
    addressdetails: '0',
  });
  // viewbox bias: ~50 km box around the user, preferred but not restricted
  if (near) {
    const d = 0.45;
    params.set('viewbox', `${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`);
    params.set('bounded', '0');
  }
  const res = await fetch(`${NOMINATIM}?${params}`, { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((d) => ({
    name: d.display_name.split(',')[0],
    fullName: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }));
}

/** Fetch a route between two points for the given travel mode. */
export async function getRoute(from: LatLng, to: LatLng, mode: TravelMode): Promise<Route | null> {
  const profile = OSRM_PROFILE[mode];
  const url =
    `${OSRM_BASE}/${profile}/route/v1/driving/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates) return null;
    return {
      coords: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      })),
      distanceM: route.distance as number,
      durationS: route.duration as number,
    };
  } catch {
    return null;
  }
}

/** "1.2 km" / "850 m" */
export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** "1 hr 5 min" / "12 min" */
export function formatDuration(s: number): string {
  const mins = Math.max(1, Math.round(s / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} hr ${mins % 60} min`;
}

/** Arrival clock time from a duration, e.g. "18:42". */
export function arrivalTime(durationS: number, from: Date = new Date()): string {
  const t = new Date(from.getTime() + durationS * 1000);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
