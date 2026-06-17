import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, Image } from 'react-native';
import MapView, { Marker, Circle as MapCircle, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Eyebrow, PillButton, BottomSheet, Toggle } from '../components';
import { RootStackParamList } from '../navigation/types';
import { ArtemisMark, IconLocate, IconWarn } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useReports, DBReport } from '../hooks/useReports';
import { useAuth } from '../state/Auth';
import { useCircle } from '../hooks/useCircle';
import { usePresence } from '../hooks/usePresence';
import { ReportKind } from '../data/demo';
import { palette } from '../theme/tokens';

const REPORT_HEX: Record<ReportKind, string> = {
  yellow: '#D4A933',
  red: '#C0392B',
  green: '#5A8F3C',
};

// Stockholm fallback if location denied
const FALLBACK = { latitude: 59.3293, longitude: 18.0686 };

// How close a report has to be (metres) to count as "near you".
const RISK_RADIUS_M = 500;

type LatLng = { latitude: number; longitude: number };

/** Great-circle distance between two coords, in metres. */
function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Pastel forest map style — mute saturation, ivory base, forest-green roads.
const MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#FAF7F0' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4A5240' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFDF8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D5E2C2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D5E2C2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFDF8' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#88A86B' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#4A7C2F' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
];

const MAP_STYLE_NIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#0F1A08' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C8CDB6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#16240D' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1F3010' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1F3010' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16240D' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#3D6A1F' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MapScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { reports, addReport, deleteReport } = useReports();
  const { members } = useCircle();
  const { byUser: presenceByUser } = usePresence();
  const [filter, setFilter] = useState<'all' | ReportKind>('all');
  const mapRef = useRef<MapView | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState<DBReport | null>(null);
  const [showLayer, setShowLayer] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Location picking mode
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<LatLng | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermDenied(true);
        setCoords(FALLBACK);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const visibleReports = filter === 'all' ? reports : reports.filter((r) => r.kind === filter);

  const circleCoords = useMemo(() => {
    return members
      .map((m) => {
        const p = presenceByUser[m.profile.id];
        if (!p) return null;
        const stale = Date.now() - new Date(p.updated_at).getTime() > 5 * 60_000;
        return {
          id: m.profile.id,
          name: m.profile.name ?? m.profile.email,
          avatar: m.profile.avatar_url,
          lat: p.lat,
          lng: p.lng,
          stale,
          updatedAt: p.updated_at,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        name: string;
        avatar: string | null;
        lat: number;
        lng: number;
        stale: boolean;
        updatedAt: string;
      }>;
  }, [members, presenceByUser]);

  // Reports near the user, used for the "risk near you" awareness card and the
  // danger-zone glow overlay. Pure client-side from existing report data.
  const nearby = useMemo(() => {
    if (!coords) return { red: 0, yellow: 0, green: 0, nearest: null as DBReport | null };
    let red = 0,
      yellow = 0,
      green = 0;
    let nearest: DBReport | null = null;
    let nearestDist = Infinity;
    for (const r of reports) {
      const d = distanceM(coords, { latitude: r.lat, longitude: r.lng });
      if (d > RISK_RADIUS_M) continue;
      if (r.kind === 'red') red++;
      else if (r.kind === 'yellow') yellow++;
      else green++;
      if ((r.kind === 'red' || r.kind === 'yellow') && d < nearestDist) {
        nearestDist = d;
        nearest = r;
      }
    }
    return { red, yellow, green, nearest };
  }, [coords, reports]);

  const riskLevel: 'alarm' | 'warn' | 'clear' =
    nearby.red > 0 ? 'alarm' : nearby.yellow > 0 ? 'warn' : 'clear';

  const recenter = () => {
    if (!coords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400,
    );
  };

  const enterPickMode = useCallback(() => {
    setPickedCenter(coords ?? FALLBACK);
    setPickingLocation(true);
  }, [coords]);

  const handleLongPress = useCallback((e: any) => {
    const { coordinate } = e.nativeEvent as { coordinate: LatLng };
    setPickedCenter(coordinate);
    setPickingLocation(true);
    mapRef.current?.animateToRegion(
      { ...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      300,
    );
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (pickingLocation) {
      setPickedCenter({ latitude: region.latitude, longitude: region.longitude });
    }
  }, [pickingLocation]);

  const confirmLocation = () => {
    setPickingLocation(false);
    setReportOpen(true);
  };

  const cancelPicking = () => {
    setPickingLocation(false);
    setPickedCenter(null);
  };

  const handleDeleteReport = async (id: string) => {
    setDeletingId(id);
    await deleteReport(id);
    setDeletingId(null);
    setSelected(null);
  };

  const reportLoc = pickedCenter ?? coords ?? FALLBACK;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      {coords && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={{ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterest={false}
          customMapStyle={t.mode === 'night' ? MAP_STYLE_NIGHT : MAP_STYLE_LIGHT}
          onRegionChangeComplete={handleRegionChangeComplete}
          onLongPress={handleLongPress}
        >
          {showLayer &&
            visibleReports.map((r) => (
              <React.Fragment key={r.id}>
                {/* Danger-zone glow — larger + softer for unsafe reports */}
                {(r.kind === 'red' || r.kind === 'yellow') && (
                  <MapCircle
                    center={{ latitude: r.lat, longitude: r.lng }}
                    radius={r.kind === 'red' ? 160 : 120}
                    strokeColor="transparent"
                    fillColor={`${REPORT_HEX[r.kind as ReportKind]}1A`}
                  />
                )}
                <MapCircle
                  center={{ latitude: r.lat, longitude: r.lng }}
                  radius={80}
                  strokeColor="transparent"
                  fillColor={`${REPORT_HEX[r.kind as ReportKind]}33`}
                />
                <Marker
                  coordinate={{ latitude: r.lat, longitude: r.lng }}
                  onPress={() => setSelected(r)}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: REPORT_HEX[r.kind as ReportKind],
                      borderWidth: 3,
                      borderColor: t.colors.parchment,
                    }}
                  />
                </Marker>
              </React.Fragment>
            ))}

          {circleCoords.map((p) => {
            const pinColor = p.stale ? t.colors.inkMute : palette.gold500;
            const staleLabel = p.stale
              ? (() => {
                  const mins = Math.round((Date.now() - new Date(p.updatedAt).getTime()) / 60_000);
                  if (mins < 1) return 'just now';
                  if (mins < 60) return `${mins}m ago`;
                  const hours = Math.floor(mins / 60);
                  if (hours < 24) return `${hours}h ago`;
                  return `${Math.floor(hours / 24)}d ago`;
                })()
              : null;
            return (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
                onPress={() => nav.navigate('CirclePerson', { id: p.id })}
              >
                <View style={{ alignItems: 'center', opacity: p.stale ? 0.55 : 1 }}>
                  {p.stale && (
                    <View
                      style={{
                        backgroundColor: t.colors.parchment,
                        borderRadius: 6,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ fontFamily: t.type.body, fontSize: 9, color: t.colors.inkMute }}>
                        {staleLabel}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      { borderRadius: 999, padding: 2, backgroundColor: t.colors.parchment },
                      t.shadows.soft,
                    ]}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: pinColor,
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pinColor,
                      }}
                    >
                      {p.avatar ? (
                        <Image source={{ uri: p.avatar }} style={{ width: 40, height: 40 }} />
                      ) : (
                        <LinearGradient
                          colors={p.stale ? [t.colors.moonlight, t.colors.hairline] : [palette.gold300, palette.gold500]}
                          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontFamily: t.type.display, fontSize: 16, color: p.stale ? t.colors.inkSoft : palette.forest900 }}>
                            {p.name[0]}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                  </View>
                  <View
                    style={{
                      width: 0,
                      height: 0,
                      borderLeftWidth: 5,
                      borderRightWidth: 5,
                      borderTopWidth: 7,
                      borderLeftColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderTopColor: pinColor,
                    }}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* Crosshair / drop-pin overlay during location picking */}
      {pickingLocation && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Pin body */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: palette.gold500,
              borderWidth: 3,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              elevation: 6,
            }}
          >
            <IconWarn size={16} color={palette.forest900} />
          </View>
          {/* Pin tail */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 7,
              borderRightWidth: 7,
              borderTopWidth: 11,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: palette.gold500,
            }}
          />
          {/* Ground shadow */}
          <View
            style={{
              width: 18,
              height: 5,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.12)',
              marginTop: 1,
            }}
          />
        </View>
      )}

      {/* Top floating chrome */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 12,
          paddingHorizontal: t.spacing.pageH,
          gap: 10,
        }}
      >
        {pickingLocation ? (
          /* Picking mode instruction banner */
          <View
            style={[
              {
                backgroundColor: t.colors.parchment,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: t.radii.md,
                alignItems: 'center',
              },
              t.shadows.soft,
            ]}
          >
            <Text variant="small" weight="semibold">Drag the map to place your pin</Text>
            <Text variant="meta" color={t.colors.inkMute} style={{ marginTop: 2 }}>
              Long-press anywhere to jump straight there
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: t.colors.parchment,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                  },
                  t.shadows.soft,
                ]}
              >
                <ArtemisMark size={18} moonColor={t.colors.forest700} />
                <Text variant="body" weight="semibold">
                  {permDenied ? 'Stockholm (default)' : 'Near you'}
                </Text>
              </View>
              <Pressable
                onPress={recenter}
                accessibilityRole="button"
                accessibilityLabel="Center map on my location"
                style={[
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: t.colors.parchment,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  t.shadows.soft,
                ]}
              >
                <IconLocate color={t.colors.forest700} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                if (nearby.nearest && mapRef.current) {
                  mapRef.current.animateToRegion(
                    { latitude: nearby.nearest.lat, longitude: nearby.nearest.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
                    500,
                  );
                  setSelected(nearby.nearest);
                }
              }}
              disabled={!nearby.nearest}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: t.colors.parchment,
                  padding: 12,
                  borderRadius: t.radii.md,
                  borderLeftWidth: 3,
                  borderLeftColor:
                    riskLevel === 'alarm' ? palette.crimson : riskLevel === 'warn' ? palette.statusWarn : palette.statusOk,
                },
                t.shadows.soft,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="small" weight="semibold">
                  {riskLevel === 'alarm'
                    ? 'Unsafe area nearby'
                    : riskLevel === 'warn'
                      ? 'Stay aware nearby'
                      : 'Clear around you'}
                </Text>
                <Text variant="meta" color={t.colors.inkMute}>
                  {coords
                    ? nearby.red + nearby.yellow > 0
                      ? `${[
                          nearby.red ? `${nearby.red} unsafe` : null,
                          nearby.yellow ? `${nearby.yellow} uneasy` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')} within ${RISK_RADIUS_M} m · tap to view`
                      : `No alerts within ${RISK_RADIUS_M} m · ${visibleReports.length} reports on map`
                    : `${visibleReports.length} reports nearby`}
                </Text>
              </View>
              <Toggle on={showLayer} onChange={setShowLayer} />
            </Pressable>

            {showLayer && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['all', 'red', 'yellow', 'green'] as const).map((k) => {
                  const active = filter === k;
                  const dot = k === 'all' ? null : (
                    <View
                      style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: REPORT_HEX[k as ReportKind], marginRight: 6 }}
                    />
                  );
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setFilter(k)}
                      style={[
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                        },
                        t.shadows.soft,
                      ]}
                    >
                      {dot}
                      <Text variant="meta" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                        {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {/* Friends-not-sharing hint */}
      {!pickingLocation && circleCoords.length === 0 && members.length > 0 && (
        <View
          style={[
            {
              position: 'absolute',
              left: t.spacing.pageH,
              right: t.spacing.pageH + 160,
              bottom: 100,
              backgroundColor: t.colors.parchment,
              padding: 12,
              borderRadius: t.radii.md,
            },
            t.shadows.soft,
          ]}
        >
          <Text variant="meta" weight="semibold" color={t.colors.gold700}>
            FRIENDS NOT SHARING
          </Text>
          <Text variant="meta" color={t.colors.inkSoft}>
            None of your circle has location sharing on right now.
          </Text>
        </View>
      )}

      {/* Picking mode bottom action bar — sits above the floating tab bar */}
      {pickingLocation && (
        <View
          style={[
            {
              position: 'absolute',
              bottom: t.spacing.tabBarBottom + 64 + 12,
              left: t.spacing.pageH,
              right: t.spacing.pageH,
              backgroundColor: t.colors.parchment,
              padding: 12,
              borderRadius: t.radii.lg,
            },
            t.shadows.card,
          ]}
        >
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PillButton variant="ghost" style={{ flex: 1 }} onPress={cancelPicking}>
              Cancel
            </PillButton>
            <PillButton style={{ flex: 1 }} onPress={confirmLocation}>
              Report here
            </PillButton>
          </View>
        </View>
      )}

      {/* Floating report button (normal mode) */}
      {!pickingLocation && (
        <Pressable
          onPress={enterPickMode}
          style={[
            {
              position: 'absolute',
              right: t.spacing.pageH,
              bottom: 100,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 999,
              backgroundColor: palette.gold500,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            },
            t.shadows.card,
          ]}
        >
          <IconWarn size={16} color={palette.forest900} />
          <Text variant="small" weight="semibold" color={palette.forest900}>
            Report this area
          </Text>
        </Pressable>
      )}

      {/* Selected report detail sheet */}
      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <View
                style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: REPORT_HEX[selected.kind as ReportKind] }}
              />
              <Text variant="body" weight="semibold">
                {selected.label}
              </Text>
              <View
                style={{
                  marginLeft: 'auto',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: `${REPORT_HEX[selected.kind as ReportKind]}22`,
                }}
              >
                <Text variant="meta" color={REPORT_HEX[selected.kind as ReportKind]}>
                  {selected.kind === 'red' ? 'Unsafe' : selected.kind === 'yellow' ? 'Uneasy' : 'Safe'}
                </Text>
              </View>
            </View>
            {selected.area ? (
              <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 4 }}>
                {selected.area}
              </Text>
            ) : null}
            <Text variant="meta" color={t.colors.inkMute} style={{ marginBottom: 16 }}>
              {selected.anon ? 'Anonymous report' : 'Community report'} · {new Date(selected.created_at).toLocaleString()}
            </Text>
            {selected.user_id && selected.user_id === user?.id && (
              <PillButton
                variant="ghost"
                block
                style={{ marginBottom: 8, borderColor: t.colors.crimson }}
                disabled={deletingId === selected.id}
                onPress={() => handleDeleteReport(selected.id)}
              >
                <Text variant="small" weight="semibold" color={t.colors.crimson}>
                  {deletingId === selected.id ? 'Deleting…' : 'Delete my report'}
                </Text>
              </PillButton>
            )}
            <PillButton block onPress={() => setSelected(null)}>
              Close
            </PillButton>
          </View>
        )}
      </BottomSheet>

      <ReportSheet
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setPickedCenter(null);
        }}
        onSubmit={async (r) => {
          const res = await addReport({
            kind: r.kind,
            label: r.label,
            notes: r.notes,
            lat: reportLoc.latitude,
            lng: reportLoc.longitude,
            anon: r.anon,
          });
          return res;
        }}
      />
    </View>
  );
}

function ReportSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (r: { kind: ReportKind; label: string; notes: string; anon: boolean }) => Promise<{ error?: string }>;
}) {
  const t = useTheme();
  const [kind, setKind] = useState<ReportKind>('yellow');
  const [type, setType] = useState('Followed');
  const [notes, setNotes] = useState('');
  const [anon, setAnon] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Reset state when sheet closes
  const handleClose = () => {
    setSubmitted(false);
    setSubmitErr(null);
    setKind('yellow');
    setType('Followed');
    setNotes('');
    setAnon(true);
    setBusy(false);
    onClose();
  };

  const handleSubmit = async () => {
    setBusy(true);
    setSubmitErr(null);
    const res = await onSubmit({ kind, label: type, notes, anon });
    setBusy(false);
    if (res.error) {
      setSubmitErr(res.error);
    } else {
      setSubmitted(true);
      setTimeout(handleClose, 1800);
    }
  };

  const SEVERITY: { id: ReportKind; label: string }[] = [
    { id: 'yellow', label: 'Felt uneasy' },
    { id: 'red', label: 'Unsafe' },
    { id: 'green', label: 'Safe area' },
  ];
  const TYPES = ['Followed', 'Harassment', 'Poorly lit', 'Other'];

  return (
    <BottomSheet visible={open} onClose={handleClose}>
      {submitted ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `${REPORT_HEX[kind]}22`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 24 }}>✓</Text>
          </View>
          <Text style={{ fontFamily: t.type.display, fontSize: 22, marginBottom: 6 }}>
            Report submitted
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center' }}>
            Thanks for helping keep the community safe.
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 4 }}>Report this area</Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
            Helps your circle and other Artemis users navigate safely.
          </Text>

          <Eyebrow style={{ marginBottom: 6 }}>SEVERITY</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            {SEVERITY.map((s) => {
              const active = kind === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setKind(s.id)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: active ? t.colors.forest700 : t.colors.moonlight,
                    alignItems: 'center',
                  }}
                >
                  <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Eyebrow style={{ marginBottom: 6 }}>WHAT HAPPENED</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {TYPES.map((tt) => {
              const active = type === tt;
              return (
                <Pressable
                  key={tt}
                  onPress={() => setType(tt)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: active ? t.colors.forest700 : t.colors.moonlight,
                  }}
                >
                  <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                    {tt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Eyebrow style={{ marginBottom: 6 }}>NOTES</Eyebrow>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional details — what made you uneasy?"
            placeholderTextColor={t.colors.inkMute}
            multiline
            style={{
              backgroundColor: t.colors.moonlight,
              borderRadius: t.radii.md,
              padding: 12,
              minHeight: 80,
              fontFamily: t.type.body,
              color: t.colors.ink,
              marginBottom: 12,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text variant="small">Submit anonymously</Text>
            <Toggle on={anon} onChange={setAnon} />
          </View>

          {submitErr && (
            <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
              {submitErr}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PillButton variant="ghost" style={{ flex: 1 }} onPress={handleClose} disabled={busy}>
              Cancel
            </PillButton>
            <PillButton style={{ flex: 1 }} onPress={handleSubmit} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </PillButton>
          </View>
        </>
      )}
    </BottomSheet>
  );
}
