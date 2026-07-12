import React, { useEffect, useRef } from 'react';
import { View, ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { Avatar } from './Avatar';
import { LatLng } from '../lib/routing';

interface Props {
  /** Route polyline coordinates (start → destination). */
  route?: LatLng[] | null;
  /** Live position of the traveler. */
  position?: LatLng | null;
  /** Destination pin. */
  destination?: (LatLng & { label?: string }) | null;
  /** Name/photo for the traveler marker. */
  travelerName?: string;
  travelerPhoto?: string | null;
  /** Keep the camera following the live position. */
  follow?: boolean;
  style?: ViewStyle;
}

export function TripMap({ route, position, destination, travelerName = '?', travelerPhoto, follow = true, style }: Props) {
  const t = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const fittedRef = useRef(false);

  // Initial fit: show the whole route (or position+destination).
  useEffect(() => {
    if (fittedRef.current || !mapRef.current) return;
    const pts: LatLng[] = [
      ...(route ?? []),
      ...(position ? [position] : []),
      ...(destination ? [destination] : []),
    ];
    if (pts.length < 2) return;
    fittedRef.current = true;
    mapRef.current.fitToCoordinates(pts, {
      edgePadding: { top: 60, bottom: 60, left: 40, right: 40 },
      animated: false,
    });
  }, [route, position, destination]);

  // Follow the live position.
  useEffect(() => {
    if (!follow || !position || !mapRef.current || !fittedRef.current) return;
    mapRef.current.animateCamera({ center: position }, { duration: 600 });
  }, [follow, position?.latitude, position?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const initial = position ?? destination ?? route?.[0] ?? { latitude: 59.3293, longitude: 18.0686 };

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={[{ flex: 1 }, style]}
      initialRegion={{ ...initial, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
    >
      {route && route.length > 1 && (
        <>
          {/* soft outline under the route for contrast */}
          <Polyline coordinates={route} strokeWidth={7} strokeColor="rgba(255,255,255,0.9)" />
          <Polyline coordinates={route} strokeWidth={4} strokeColor={t.colors.forest700} />
        </>
      )}
      {destination && (
        <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }} title={destination.label}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: palette.gold500,
                borderWidth: 3,
                borderColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: palette.forest900 }} />
            </View>
            <View style={{ width: 2, height: 8, backgroundColor: palette.gold500 }} />
          </View>
        </Marker>
      )}
      {position && (
        <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[{ borderRadius: 999, padding: 2, backgroundColor: t.colors.parchment }, t.shadows.soft]}>
            <Avatar name={travelerName} size={36} photoUri={travelerPhoto ?? undefined} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}
