import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar, BottomSheet } from '../components';
import { IconChevron, IconClock, IconLocate } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useCircle } from '../hooks/useCircle';
import { useGroups } from '../hooks/useGroups';
import { useTrips } from '../hooks/useTrips';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { personName } from '../lib/person';
import { useT } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import {
  searchPlaces,
  getRoute,
  formatDistance,
  formatDuration,
  arrivalTime,
  Place,
  Route,
  TravelMode,
  LatLng,
} from '../lib/routing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TRANSPORTS: { id: TravelMode; label: string; emoji: string }[] = [
  { id: 'walk', label: 'Walking', emoji: '🚶' },
  { id: 'bike', label: 'Biking', emoji: '🚴' },
  { id: 'car', label: 'Driving', emoji: '🚗' },
];

export function TripSetupScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const { members } = useCircle();
  const { groups } = useGroups();
  const { user } = useAuth();
  const { activeTrip, loading, start } = useTrips();

  // Place search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Route
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routing, setRouting] = useState(false);

  const [transport, setTransport] = useState<TravelMode>('walk');
  const [etaHour, setEtaHour] = useState<number | null>(null);
  const [etaMinute, setEtaMinute] = useState<number | null>(null);
  const [etaOpen, setEtaOpen] = useState(false);
  // Multiple followers now — the first selected is the primary buddy (ETA-miss
  // escalation), everyone selected can watch the live trip.
  const [buddyIds, setBuddyIds] = useState<string[]>(members[0] ? [members[0].profile.id] : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const manualEta = etaHour !== null && etaMinute !== null
    ? `${String(etaHour).padStart(2, '0')}:${String(etaMinute).padStart(2, '0')}`
    : null;
  // Auto ETA from the computed route; manual override wins.
  const autoEta = route ? arrivalTime(route.durationS) : null;
  const etaString = manualEta ?? autoEta;

  useEffect(() => {
    if (!loading && activeTrip) nav.replace('TripActive');
  }, [activeTrip, loading, nav]);

  useEffect(() => {
    if (buddyIds.length === 0 && members[0]) setBuddyIds([members[0].profile.id]);
  }, [members]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBuddy = (id: string) =>
    setBuddyIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));

  // Grab current location once — used to bias search and as route origin.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMyPos({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // best-effort
      }
    })();
  }, []);

  // Debounced place search (Nominatim asks for ≤1 req/s).
  const onQueryChange = (text: string) => {
    setQuery(text);
    setPlace(null);
    setRoute(null);
    setNoResults(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlaces(text, myPos ?? undefined);
      setSearching(false);
      setResults(found);
      setNoResults(found.length === 0);
    }, 500);
  };

  const pickPlace = (p: Place) => {
    setPlace(p);
    setQuery(p.name);
    setResults([]);
    setNoResults(false);
  };

  // Compute the route whenever place or transport changes.
  useEffect(() => {
    if (!place || !myPos) { setRoute(null); return; }
    let cancelled = false;
    (async () => {
      setRouting(true);
      const r = await getRoute(myPos, { latitude: place.lat, longitude: place.lng }, transport);
      if (!cancelled) {
        setRoute(r);
        setRouting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [place, transport, myPos]);

  const submit = async () => {
    if (!place && !query.trim()) return setErr(tr('Destination is required'));
    setBusy(true);
    setErr(null);
    const res = await start({
      destination: place?.name ?? query.trim(),
      eta: etaString ?? undefined,
      buddyIds,
      transport,
      // Live tracking is always as fast as possible — no user knob.
      locationInterval: 5,
      destLat: place?.lat,
      destLng: place?.lng,
      route: route ? route.coords.map((c) => [c.longitude, c.latitude] as [number, number]) : undefined,
      distanceM: route?.distanceM,
      durationS: route?.durationS,
    });
    setBusy(false);
    if (res.error) return setErr(res.error);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Chat heads-up to every follower so they know they can watch.
    if (user && buddyIds.length > 0) {
      const etaText = etaString ? ` (ETA ${etaString})` : '';
      const body = `🧭 I just started a trip to ${place?.name ?? query.trim()}${etaText}. You can follow my live location in Artemis.`;
      supabase
        .from('messages')
        .insert(buddyIds.map((b) => ({ sender_id: user.id, recipient_id: b, body })))
        .then(() => {});
    }

    nav.replace('TripActive');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }} accessibilityLabel="Back">
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          {tr('Trip Mode')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>{tr('DESTINATION')}</Eyebrow>
        <Card style={{ marginBottom: results.length > 0 || searching || noResults ? 4 : 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={tr('Search for a place or address…')}
              placeholderTextColor={t.colors.inkMute}
              style={{ flex: 1, fontFamily: t.type.body, fontSize: 16, color: t.colors.ink }}
            />
            {place && (
              <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: palette.gold500, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: palette.forest900 }}>✓</Text>
              </View>
            )}
          </View>
        </Card>

        {/* No-results hint — still allows starting the trip with just a name */}
        {noResults && !searching && results.length === 0 && (
          <Card style={{ marginBottom: 14 }}>
            <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center' }}>
              {tr('No places found — check the spelling, or start the trip with just a name (no route or map).')}
            </Text>
          </Card>
        )}

        {/* Search results dropdown */}
        {(results.length > 0 || searching) && (
          <Card style={{ marginBottom: 14, paddingVertical: 4 }}>
            {searching ? (
              <ActivityIndicator color={t.colors.forest700} style={{ paddingVertical: 12 }} />
            ) : (
              results.map((r, i) => (
                <Pressable
                  key={`${r.lat},${r.lng}`}
                  onPress={() => pickPlace(r)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: i < results.length - 1 ? 1 : 0,
                    borderBottomColor: t.colors.hairline,
                  }}
                >
                  <IconLocate size={14} color={t.colors.inkMute} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" numberOfLines={1}>{r.name}</Text>
                    <Text variant="meta" color={t.colors.inkMute} numberOfLines={1}>{r.fullName}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        )}

        <Eyebrow style={{ marginBottom: 6 }}>{tr('HOW ARE YOU TRAVELLING?')}</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {TRANSPORTS.map((trns) => {
            const active = transport === trns.id;
            return (
              <Pressable
                key={trns.id}
                onPress={() => setTransport(trns.id)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderRadius: t.radii.md,
                  backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                }}
              >
                <Text style={{ fontSize: 24 }}>{trns.emoji}</Text>
                <Text variant="meta" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft} style={{ marginTop: 4 }}>
                  {tr(trns.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Route preview: distance · duration · arrival */}
        {(routing || route) && (
          <Card style={{ marginBottom: 14, backgroundColor: t.colors.forest700 }}>
            {routing ? (
              <ActivityIndicator color={palette.gold300} style={{ paddingVertical: 6 }} />
            ) : route ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Eyebrow color="rgba(242,226,187,0.6)">{tr('DISTANCE')}</Eyebrow>
                  <Text style={{ fontFamily: t.type.display, fontSize: 20, color: '#fff', paddingTop: 4 }}>
                    {formatDistance(route.distanceM)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Eyebrow color="rgba(242,226,187,0.6)">{tr('TIME')}</Eyebrow>
                  <Text style={{ fontFamily: t.type.display, fontSize: 20, color: palette.gold300, paddingTop: 4 }}>
                    {formatDuration(route.durationS)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Eyebrow color="rgba(242,226,187,0.6)">{tr('ARRIVE')}</Eyebrow>
                  <Text style={{ fontFamily: t.type.display, fontSize: 20, color: '#fff', paddingTop: 4 }}>
                    ~{arrivalTime(route.durationS)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>
        )}
        {place && !routing && !route && (
          <Text variant="meta" color={t.colors.inkMute} style={{ marginBottom: 14, textAlign: 'center' }}>
            {tr("Couldn't compute a route — trip will still work with your manual ETA.")}
          </Text>
        )}

        <Eyebrow style={{ marginBottom: 6 }}>ETA {route ? tr('(AUTO — TAP TO OVERRIDE)') : tr('(OPTIONAL)')}</Eyebrow>
        <Pressable onPress={() => setEtaOpen(true)}>
          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="body" color={etaString ? t.colors.ink : t.colors.inkMute}>
                {etaString ? `${etaString}${!manualEta && autoEta ? `  ·  ${tr('auto')}` : ''}` : tr('Set arrival time…')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {manualEta && (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); setEtaHour(null); setEtaMinute(null); }}
                    hitSlop={12}
                  >
                    <Text variant="meta" color={t.colors.inkMute}>✕</Text>
                  </Pressable>
                )}
                <IconClock size={16} color={t.colors.inkSoft} />
              </View>
            </View>
          </Card>
        </Pressable>

        <Eyebrow style={{ marginBottom: 6 }}>{tr('WHO FOLLOWS THIS TRIP')}</Eyebrow>
        {members.length === 0 ? (
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 18 }}>
            {tr('Add a friend in the Circle tab first — Trip Mode needs a buddy.')}
          </Text>
        ) : (
          <>
            {/* Group quick-select — tap "Family" to add everyone in it at once. */}
            {groups.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {groups.map((g) => {
                  const ids = g.memberIds.filter((id) => members.some((m) => m.profile.id === id));
                  if (ids.length === 0) return null;
                  const allIn = ids.every((id) => buddyIds.includes(id));
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() =>
                        setBuddyIds((prev) =>
                          allIn ? prev.filter((b) => !ids.includes(b)) : Array.from(new Set([...prev, ...ids])),
                        )
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: allIn ? t.colors.forest700 : t.colors.parchment,
                        borderWidth: 1,
                        borderColor: allIn ? t.colors.forest700 : t.colors.hairline,
                      }}
                    >
                      <Text variant="small" weight="semibold" color={allIn ? palette.gold300 : t.colors.inkSoft}>
                        {allIn ? '✓ ' : ''}{g.name} · {ids.length}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={{ gap: 8, marginBottom: 6 }}>
              {members.map((p) => {
                const active = buddyIds.includes(p.profile.id);
                const isPrimary = buddyIds[0] === p.profile.id;
                return (
                  <Pressable
                    key={p.edgeId}
                    onPress={() => toggleBuddy(p.profile.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      gap: 12,
                      borderRadius: t.radii.md,
                      backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                    }}
                  >
                    <Avatar name={personName(p.profile)} size={40} photoUri={p.profile.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold" color={active ? palette.gold300 : t.colors.ink}>
                        {personName(p.profile)}
                      </Text>
                      <Text variant="meta" color={active ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}>
                        {isPrimary ? tr('Primary · alerted if you miss your ETA') : p.relation ?? tr('Friend')}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: active ? t.colors.gold300 : t.colors.hairline,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active && <Text style={{ color: t.colors.gold300, fontSize: 13, fontWeight: '700' }}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="meta" color={t.colors.inkMute} style={{ marginBottom: 18 }}>
              {tr('Everyone selected can watch your live trip. The first is your primary buddy.')}
            </Text>
          </>
        )}

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 18 }}>
          <Text variant="meta" color={t.colors.gold700} weight="semibold">
            {tr('HOW IT WORKS')}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
            {tr("Your buddy sees your live position and route on a map. We'll ask if you're safe when you reach your ETA — if you don't confirm within 5 minutes, they're alerted and your live location is shared.")}
          </Text>
        </View>

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block disabled={busy || (!place && !query.trim()) || buddyIds.length === 0} onPress={submit}>
          {busy ? tr('Starting…') : tr('▶  Start trip')}
        </PillButton>
      </ScrollView>

      <EtaPickerSheet
        open={etaOpen}
        onClose={() => setEtaOpen(false)}
        onConfirm={(h, m) => { setEtaHour(h); setEtaMinute(m); setEtaOpen(false); }}
        initialHour={etaHour ?? new Date().getHours()}
        initialMinute={etaMinute ?? Math.ceil(new Date().getMinutes() / 5) * 5 % 60}
      />
    </KeyboardAvoidingView>
  );
}

function EtaPickerSheet({
  open,
  onClose,
  onConfirm,
  initialHour,
  initialMinute,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
  initialHour: number;
  initialMinute: number;
}) {
  const t = useTheme();
  const tr = useT();
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  // Sync if parent changes initial values (e.g. user clears and reopens)
  React.useEffect(() => { if (open) { setHour(initialHour); setMinute(initialMinute); } }, [open]);

  const bump = (setter: (v: number) => void, val: number, mod: number, step: number) =>
    setter(((val + step) % mod + mod) % mod);
  const fmt2 = (n: number) => String(n).padStart(2, '0');

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 4 }}>
        {tr('Set arrival time')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 20 }}>
        {tr("We'll check that you're safe when you reach this time.")}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {/* Hour */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => bump(setHour, hour, 24, 1)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▲</Text>
          </Pressable>
          <View style={{ width: 70, height: 64, borderRadius: t.radii.md, backgroundColor: t.colors.forest700, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.type.display, fontSize: 28, color: '#fff', paddingTop: 4, includeFontPadding: false, lineHeight: 34 }}>{fmt2(hour)}</Text>
          </View>
          <Pressable
            onPress={() => bump(setHour, hour, 24, -1)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▼</Text>
          </Pressable>
        </View>

        <Text style={{ fontFamily: t.type.bodyBold, fontSize: 28, color: t.colors.ink, lineHeight: 34 }}>:</Text>

        {/* Minute */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => bump(setMinute, minute, 60, 5)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▲</Text>
          </Pressable>
          <View style={{ width: 70, height: 64, borderRadius: t.radii.md, backgroundColor: t.colors.forest700, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.type.display, fontSize: 28, color: '#fff', paddingTop: 4, includeFontPadding: false, lineHeight: 34 }}>{fmt2(minute)}</Text>
          </View>
          <Pressable
            onPress={() => bump(setMinute, minute, 60, -5)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▼</Text>
          </Pressable>
        </View>
      </View>

      <PillButton block onPress={() => onConfirm(hour, minute)} style={{ marginBottom: 8 }}>
        {tr('Set ETA to {time}', { time: `${fmt2(hour)}:${fmt2(minute)}` })}
      </PillButton>
      <PillButton variant="ghost" block onPress={onClose}>
        {tr('Cancel')}
      </PillButton>
    </BottomSheet>
  );
}
