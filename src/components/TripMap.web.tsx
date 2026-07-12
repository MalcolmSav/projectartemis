import React, { useMemo, useRef, useState } from 'react';
import { View, Image, Text as RNText, ViewStyle } from 'react-native';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { Avatar } from './Avatar';
import { LatLng } from '../lib/routing';

// Web fallback map: OSM raster tiles + an SVG overlay for the route and markers.
// No native map library needed — works in the Expo web preview.

interface Props {
  route?: LatLng[] | null;
  position?: LatLng | null;
  destination?: (LatLng & { label?: string }) | null;
  travelerName?: string;
  travelerPhoto?: string | null;
  follow?: boolean;
  style?: ViewStyle;
}

const TILE = 256;

function lngToWorldX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * TILE * 2 ** zoom;
}
function latToWorldY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** zoom;
}

export function TripMap({ route, position, destination, travelerName = '?', travelerPhoto, follow = true, style }: Props) {
  const t = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const zoomRef = useRef<number | null>(null);

  const allPoints = useMemo(() => {
    const pts: LatLng[] = [...(route ?? [])];
    if (position) pts.push(position);
    if (destination) pts.push(destination);
    return pts;
  }, [route, position, destination]);

  const view = useMemo(() => {
    if (!size || allPoints.length === 0) return null;

    // Fit zoom once (from the full route bbox), then keep it stable while following.
    if (zoomRef.current === null) {
      const lats = allPoints.map((p) => p.latitude);
      const lngs = allPoints.map((p) => p.longitude);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      let zoom = 17;
      while (zoom > 3) {
        const wpx = lngToWorldX(maxLng, zoom) - lngToWorldX(minLng, zoom);
        const hpx = latToWorldY(minLat, zoom) - latToWorldY(maxLat, zoom);
        if (wpx <= size.w - 80 && hpx <= size.h - 80) break;
        zoom--;
      }
      zoomRef.current = zoom;
    }
    const zoom = zoomRef.current;

    // Center: follow the live position when available, else bbox center.
    const center = follow && position
      ? position
      : {
          latitude: (Math.min(...allPoints.map((p) => p.latitude)) + Math.max(...allPoints.map((p) => p.latitude))) / 2,
          longitude: (Math.min(...allPoints.map((p) => p.longitude)) + Math.max(...allPoints.map((p) => p.longitude))) / 2,
        };

    const cx = lngToWorldX(center.longitude, zoom);
    const cy = latToWorldY(center.latitude, zoom);
    const originX = cx - size.w / 2;
    const originY = cy - size.h / 2;

    // Visible tile range.
    const tx0 = Math.floor(originX / TILE);
    const ty0 = Math.floor(originY / TILE);
    const tx1 = Math.floor((originX + size.w) / TILE);
    const ty1 = Math.floor((originY + size.h) / TILE);
    const maxTile = 2 ** zoom - 1;
    const tiles: { x: number; y: number; left: number; top: number }[] = [];
    for (let x = tx0; x <= tx1; x++) {
      for (let y = ty0; y <= ty1; y++) {
        if (x < 0 || y < 0 || x > maxTile || y > maxTile) continue;
        tiles.push({ x, y, left: x * TILE - originX, top: y * TILE - originY });
      }
    }

    const project = (p: LatLng) => ({
      x: lngToWorldX(p.longitude, zoom) - originX,
      y: latToWorldY(p.latitude, zoom) - originY,
    });

    return { zoom, tiles, project };
  }, [size, allPoints, follow, position]);

  const routePoints = view && route && route.length > 1
    ? route.map((p) => { const { x, y } = view.project(p); return `${x},${y}`; }).join(' ')
    : null;

  const posPx = view && position ? view.project(position) : null;
  const destPx = view && destination ? view.project(destination) : null;

  return (
    <View
      style={[{ flex: 1, overflow: 'hidden', backgroundColor: t.colors.moonlight }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {view?.tiles.map((tile) => (
        <Image
          key={`${view.zoom}/${tile.x}/${tile.y}`}
          source={{ uri: `https://tile.openstreetmap.org/${view.zoom}/${tile.x}/${tile.y}.png` }}
          style={{ position: 'absolute', left: tile.left, top: tile.top, width: TILE, height: TILE }}
        />
      ))}

      {size && routePoints && (
        <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={size.w} height={size.h} pointerEvents="none">
          <SvgPolyline points={routePoints} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          <SvgPolyline points={routePoints} fill="none" stroke={t.colors.forest700} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      )}

      {destPx && (
        <View style={{ position: 'absolute', left: destPx.x - 14, top: destPx.y - 34, alignItems: 'center' }} pointerEvents="none">
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
      )}

      {posPx && (
        <View style={{ position: 'absolute', left: posPx.x - 20, top: posPx.y - 20 }} pointerEvents="none">
          <View style={[{ borderRadius: 999, padding: 2, backgroundColor: t.colors.parchment }, t.shadows.soft]}>
            <Avatar name={travelerName} size={36} photoUri={travelerPhoto ?? undefined} />
          </View>
        </View>
      )}

      {/* OSM attribution (required) */}
      <View style={{ position: 'absolute', right: 4, bottom: 2, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 3 }}>
        <RNText style={{ fontSize: 9, color: '#333' }}>© OpenStreetMap</RNText>
      </View>
    </View>
  );
}
