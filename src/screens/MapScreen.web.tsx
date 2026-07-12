import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, TextInput, ScrollView, Image } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, PillButton, BottomSheet, Toggle } from '../components';
import { RootStackParamList } from '../navigation/types';
import { ArtemisMark, IconLocate, IconWarn } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';
import { useReports, DBReport } from '../hooks/useReports';
import { useCircle } from '../hooks/useCircle';
import { usePresence } from '../hooks/usePresence';
import { ReportKind } from '../data/demo';
import { palette } from '../theme/tokens';
import { personName } from '../lib/person';

const REPORT_HEX: Record<ReportKind, string> = {
  yellow: '#D4A933',
  red: '#C0392B',
  green: '#5A8F3C',
};

// Stockholm fallback if location denied
const FALLBACK = { latitude: 59.3293, longitude: 18.0686 };

// How close a report has to be (metres) to count as "near you".
const RISK_RADIUS_M = 500;

/** Great-circle distance between two coords, in metres. */
function distanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MapScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const { reports, addReport } = useReports();
  const { members } = useCircle();
  const { byUser: presenceByUser } = usePresence();
  const [filter, setFilter] = useState<'all' | ReportKind>('all');
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
  const reportCoords = filter === 'all' ? reports : reports.filter((r) => r.kind === filter);

  // Proximity risk awareness (same as native): reports near the user.
  const nearby = useMemo(() => {
    if (!coords) return { red: 0, yellow: 0, nearest: null as DBReport | null };
    let red = 0,
      yellow = 0;
    let nearest: DBReport | null = null;
    let nearestDist = Infinity;
    for (const r of reports) {
      const d = distanceM(coords, { latitude: r.lat, longitude: r.lng });
      if (d > RISK_RADIUS_M) continue;
      if (r.kind === 'red') red++;
      else if (r.kind === 'yellow') yellow++;
      if ((r.kind === 'red' || r.kind === 'yellow') && d < nearestDist) {
        nearestDist = d;
        nearest = r;
      }
    }
    return { red, yellow, nearest };
  }, [coords, reports]);

  const riskLevel: 'alarm' | 'warn' | 'clear' =
    nearby.red > 0 ? 'alarm' : nearby.yellow > 0 ? 'warn' : 'clear';

  // Real circle members — pull live coords from presence table (include stale for last-known pin).
  const circleCoords = useMemo(() => {
    return members
      .map((m) => {
        const p = presenceByUser[m.profile.id];
        if (!p) return null;
        const stale = Date.now() - new Date(p.updated_at).getTime() > 5 * 60_000;
        return {
          id: m.profile.id,
          name: personName(m.profile),
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

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View
        style={{
          paddingTop: 60,
          paddingHorizontal: 16,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
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
              {permDenied ? tr('Stockholm (default)') : tr('Near you')}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            if (nearby.nearest) setSelected(nearby.nearest);
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
                ? tr('Unsafe area nearby')
                : riskLevel === 'warn'
                  ? tr('Stay aware nearby')
                  : tr('Clear around you')}
            </Text>
            <Text variant="meta" color={t.colors.inkMute}>
              {coords
                ? nearby.red + nearby.yellow > 0
                  ? `${[nearby.red ? `${nearby.red} unsafe` : null, nearby.yellow ? `${nearby.yellow} uneasy` : null]
                      .filter(Boolean)
                      .join(' · ')} within ${RISK_RADIUS_M} m · tap to view`
                  : `No alerts within ${RISK_RADIUS_M} m · ${reportCoords.length} reports on map`
                : `${reportCoords.length} reports nearby`}
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
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: REPORT_HEX[k as ReportKind],
                    marginRight: 6,
                  }}
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
                  <Text
                    variant="meta"
                    weight="semibold"
                    color={active ? palette.gold300 : t.colors.inkSoft}
                  >
                    {k === 'all' ? tr('All') : tr(k.charAt(0).toUpperCase() + k.slice(1) as any)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Circle Members Section */}
        {circleCoords.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: t.type.display,
                fontSize: 18,
                marginBottom: 12,
                color: t.colors.inkSoft,
              }}
            >
              {tr('Circle Members')}
            </Text>
            {circleCoords.map((p) => {
              const pinColor = p.stale ? t.colors.inkMute : palette.gold500;
              const staleLabel = p.stale
                ? (() => {
                    const mins = Math.round(
                      (Date.now() - new Date(p.updatedAt).getTime()) / 60_000
                    );
                    if (mins < 1) return tr('just now');
                    if (mins < 60) return tr('{m} min ago', { m: mins });
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) return tr('{h} hr ago', { h: hours });
                    return tr('{d}d ago', { d: Math.floor(hours / 24) });
                  })()
                : null;

              return (
                <Pressable
                  key={p.id}
                  onPress={() => nav.navigate('CirclePerson', { id: p.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: t.colors.parchment,
                    padding: 12,
                    borderRadius: t.radii.md,
                    marginBottom: 8,
                    opacity: p.stale ? 0.6 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
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
                      <Image source={{ uri: p.avatar }} style={{ width: 44, height: 44 }} />
                    ) : (
                      <LinearGradient
                        colors={
                          p.stale
                            ? [t.colors.moonlight, t.colors.hairline]
                            : [palette.gold300, palette.gold500]
                        }
                        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text
                          style={{
                            fontFamily: t.type.display,
                            fontSize: 16,
                            color: p.stale ? t.colors.inkSoft : palette.forest900,
                          }}
                        >
                          {p.name[0]}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">
                      {p.name}
                    </Text>
                    {staleLabel && (
                      <Text variant="meta" color={t.colors.inkMute}>
                        {tr('Last seen {time}', { time: staleLabel })}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Reports Section */}
        {showLayer && reportCoords.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: t.type.display,
                fontSize: 18,
                marginBottom: 12,
                color: t.colors.inkSoft,
              }}
            >
              {tr('Safety Reports')}
            </Text>
            {reportCoords.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setSelected(r)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: t.colors.parchment,
                  padding: 12,
                  borderRadius: t.radii.md,
                  marginBottom: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: REPORT_HEX[r.kind as ReportKind],
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: REPORT_HEX[r.kind as ReportKind],
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">
                    {r.label}
                  </Text>
                  <Text variant="meta" color={t.colors.inkMute}>
                    {r.area ?? 'Unknown area'} · {new Date(r.created_at).toLocaleString()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Friends-not-sharing hint */}
        {circleCoords.length === 0 && members.length > 0 && (
          <View
            style={{
              backgroundColor: t.colors.parchment,
              padding: 12,
              borderRadius: t.radii.md,
              marginBottom: 24,
            }}
          >
            <Text variant="meta" weight="semibold" color={t.colors.gold700}>
              {tr('FRIENDS NOT SHARING')}
            </Text>
            <Text variant="meta" color={t.colors.inkSoft}>
              {tr('None of your circle has location sharing on right now.')}
            </Text>
          </View>
        )}

        {/* Spacer for floating button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating report button */}
      <View
        style={{
          position: 'absolute',
          right: 16,
          bottom: 100,
        }}
      >
        <Pressable
          onPress={() => setReportOpen(true)}
          style={[
            {
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
            {tr('Report this area')}
          </Text>
        </Pressable>
      </View>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  backgroundColor: REPORT_HEX[selected.kind as ReportKind],
                }}
              />
              <Text variant="body" weight="semibold">
                {selected.label}
              </Text>
            </View>
            <Text variant="small" color={t.colors.inkSoft}>
              {selected.area ?? 'Unknown area'} · {new Date(selected.created_at).toLocaleString()}
            </Text>
            <PillButton block style={{ marginTop: 16 }} onPress={() => setSelected(null)}>
              {tr('Close')}
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
            notes: r.notes,
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
  onSubmit: (r: { kind: ReportKind; label: string; notes: string; anon: boolean }) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const [kind, setKind] = useState<ReportKind>('yellow');
  const [type, setType] = useState('Followed');
  const [notes, setNotes] = useState('');
  const [anon, setAnon] = useState(true);

  const SEVERITY: { id: ReportKind; label: string }[] = [
    { id: 'yellow', label: tr('Felt uneasy') },
    { id: 'red', label: tr('Unsafe') },
    { id: 'green', label: tr('Safe area') },
  ];
  const TYPES = [tr('Followed'), tr('Harassment'), tr('Poorly lit'), tr('Other')];

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 4 }}>
        {tr('Report this area')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        {tr('Helps your circle and other Artemis users navigate safely.')}
      </Text>

      <Eyebrow style={{ marginBottom: 6 }}>{tr('SEVERITY')}</Eyebrow>
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
              <Text
                variant="small"
                weight="semibold"
                color={active ? palette.gold300 : t.colors.inkSoft}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Eyebrow style={{ marginBottom: 6 }}>{tr('TYPE')}</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
        {TYPES.map((t2) => {
          const active = type === t2;
          return (
            <Pressable
              key={t2}
              onPress={() => setType(t2)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: active ? t.colors.forest700 : t.colors.moonlight,
                alignItems: 'center',
              }}
            >
              <Text
                variant="small"
                weight="semibold"
                color={active ? palette.gold300 : t.colors.inkSoft}
              >
                {t2}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Eyebrow style={{ marginBottom: 6 }}>{tr('NOTES')}</Eyebrow>
      <TextInput
        placeholder={tr('Add any details (optional)')}
        placeholderTextColor={t.colors.inkMute}
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{
          borderWidth: 1,
          borderColor: t.colors.hairline,
          borderRadius: t.radii.md,
          padding: 12,
          color: t.colors.inkSoft,
          fontFamily: t.type.body,
          minHeight: 80,
          marginBottom: 16,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Toggle on={anon} onChange={setAnon} />
        <Text variant="body" color={t.colors.inkSoft}>
          {tr('Report anonymously')}
        </Text>
      </View>

      <PillButton
        block
        onPress={() =>
          onSubmit({
            kind,
            label: type,
            notes,
            anon,
          })
        }
      >
        {tr('Submit Report')}
      </PillButton>
    </BottomSheet>
  );
}
