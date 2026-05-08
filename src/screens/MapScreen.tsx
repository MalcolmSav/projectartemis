import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, Platform } from 'react-native';
import MapView, { Marker, Circle as MapCircle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Eyebrow, PillButton, BottomSheet, Toggle } from '../components';
import { ArtemisMark, IconLocate, IconWarn } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useReports, DBReport } from '../hooks/useReports';
import { useCircle } from '../hooks/useCircle';
import { ReportKind } from '../data/demo';
import { palette } from '../theme/tokens';

const REPORT_HEX: Record<ReportKind, string> = {
  yellow: '#D4A933',
  red: '#C0392B',
  green: '#5A8F3C',
};

// Stockholm fallback if location denied
const FALLBACK = { latitude: 59.3293, longitude: 18.0686 };

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

export function MapScreen() {
  const t = useTheme();
  const { reports, addReport } = useReports();
  const { members } = useCircle();
  const mapRef = useRef<MapView | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState<DBReport | null>(null);
  const [showLayer, setShowLayer] = useState(true);

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

  // Reports already have real lat/lng from the DB.
  const reportCoords = reports;

  // Real circle members — but we don't have their location yet (no live geo).
  // For now, show no circle pins until we wire location sharing → DB.
  const circleCoords: Array<{ id: string; name: string; lat: number; lng: number }> = useMemo(
    () => [],
    [members],
  );

  const recenter = () => {
    if (!coords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400,
    );
  };

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
        >
          {showLayer &&
            reportCoords.map((r) => (
              <React.Fragment key={r.id}>
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

          {circleCoords.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={{ alignItems: 'center' }}>
                <View
                  style={[
                    { borderRadius: 999, padding: 2, backgroundColor: t.colors.parchment },
                    t.shadows.soft,
                  ]}
                >
                  <LinearGradient
                    colors={[palette.gold300, palette.gold500]}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: palette.gold500,
                    }}
                  >
                    <Text style={{ fontFamily: t.type.display, fontSize: 16, color: palette.forest900 }}>
                      {p.name[0]}
                    </Text>
                  </LinearGradient>
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
                    borderTopColor: palette.gold500,
                  }}
                />
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Top floating chrome */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 60,
          paddingHorizontal: t.spacing.pageH,
          gap: 10,
        }}
      >
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

        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: t.colors.parchment,
              padding: 12,
              borderRadius: t.radii.md,
            },
            t.shadows.soft,
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="small" weight="semibold">
              Community Safety Layer
            </Text>
            <Text variant="meta" color={t.colors.inkMute}>
              {reports.length} reports nearby
            </Text>
          </View>
          <Toggle on={showLayer} onChange={setShowLayer} />
        </View>
      </View>

      {/* Floating report button */}
      <Pressable
        onPress={() => setReportOpen(true)}
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
            </View>
            <Text variant="small" color={t.colors.inkSoft}>
              {selected.area ?? 'Unknown area'} · {new Date(selected.created_at).toLocaleString()}
            </Text>
            <PillButton block style={{ marginTop: 16 }} onPress={() => setSelected(null)}>
              Close
            </PillButton>
          </View>
        )}
      </BottomSheet>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={async (r) => {
          if (!coords) return;
          await addReport({
            kind: r.kind,
            label: r.label,
            area: r.area,
            lat: coords.latitude,
            lng: coords.longitude,
            anon: r.anon,
          });
          setReportOpen(false);
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
  onSubmit: (r: { kind: ReportKind; label: string; area: string; anon: boolean }) => void;
}) {
  const t = useTheme();
  const [kind, setKind] = useState<ReportKind>('yellow');
  const [type, setType] = useState('Followed');
  const [notes, setNotes] = useState('');
  const [anon, setAnon] = useState(true);

  const SEVERITY: { id: ReportKind; label: string }[] = [
    { id: 'yellow', label: 'Felt uneasy' },
    { id: 'red', label: 'Unsafe' },
    { id: 'green', label: 'Safe area' },
  ];
  const TYPES = ['Followed', 'Harassment', 'Poorly lit', 'Other'];

  return (
    <BottomSheet visible={open} onClose={onClose}>
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
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text variant="small">Submit anonymously</Text>
        <Toggle on={anon} onChange={setAnon} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={onClose}>
          Cancel
        </PillButton>
        <PillButton
          style={{ flex: 1 }}
          onPress={() =>
            onSubmit({
              kind,
              label: type,
              area: 'Near you',
              anon,
            })
          }
        >
          Submit
        </PillButton>
      </View>
    </BottomSheet>
  );
}
