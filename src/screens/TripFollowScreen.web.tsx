import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Linking, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, PillButton, Avatar, TripMap } from '../components';
import { IconChevron, IconPhone, IconMessage } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../state/Auth';
import { supabase, Profile } from '../lib/supabase';
import { Trip } from '../hooks/useTrips';
import { palette } from '../theme/tokens';
import { useT } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { formatDistance, formatDuration, LatLng } from '../lib/routing';
import { callPhone } from '../lib/call';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Web build: OSM-tile TripMap (no native map needed) + live status card.
export function TripFollowScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'TripFollow'>>();
  const tripId = route.params.tripId;
  const { byUser } = usePresence();
  const { user } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [traveler, setTraveler] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const followMarkedRef = React.useRef(false);

  // Follow receipt: tell the traveler their buddy is actually watching.
  useEffect(() => {
    if (followMarkedRef.current || !trip || !user) return;
    if (trip.status !== 'active' || trip.buddy_id !== user.id || trip.followed_at) return;
    followMarkedRef.current = true;
    supabase.from('trips').update({ followed_at: new Date().toISOString() }).eq('id', trip.id).then(() => {});
  }, [trip, user]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
      if (cancelled) return;
      const tr = (data as Trip) ?? null;
      setTrip(tr);
      if (tr && !traveler) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', tr.user_id).maybeSingle();
        if (!cancelled) setTraveler((prof as Profile) ?? null);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`followtrip:${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const presence = trip ? byUser[trip.user_id] : undefined;
  const position: LatLng | null = presence ? { latitude: presence.lat, longitude: presence.lng } : null;

  const routeCoords: LatLng[] | null = useMemo(
    () => (trip?.route ? trip.route.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) : null),
    [trip?.route],
  );
  const destCoord: (LatLng & { label?: string }) | null =
    trip?.dest_lat != null && trip?.dest_lng != null
      ? { latitude: trip.dest_lat, longitude: trip.dest_lng, label: trip.destination }
      : null;

  const etaTs = useMemo(() => {
    if (!trip?.eta || !trip?.started_at) return null;
    const [h, m] = trip.eta.split(':').map((n) => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return null;
    const start = new Date(trip.started_at);
    const eta = new Date(start);
    eta.setHours(h, m, 0, 0);
    if (eta.getTime() <= start.getTime()) eta.setDate(eta.getDate() + 1);
    return eta.getTime();
  }, [trip?.eta, trip?.started_at]);

  const minsLeft = trip?.remaining_s != null
    ? Math.max(0, Math.round(trip.remaining_s / 60))
    : etaTs
      ? Math.round((etaTs - now) / 60_000)
      : null;

  const presenceStale = presence ? now - new Date(presence.updated_at).getTime() > 3 * 60_000 : true;
  const name = traveler?.name ?? traveler?.email ?? 'Your friend';

  const status: { label: string; color: string } =
    trip?.status === 'arrived'
      ? { label: tr('Arrived safely'), color: palette.statusOk }
      : trip?.status === 'escalated'
        ? { label: tr('Needs help — escalated'), color: palette.crimson }
        : etaTs && now > etaTs
          ? { label: tr('Past ETA'), color: palette.statusWarn }
          : { label: tr('On the way'), color: palette.statusOk };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.forest700} />
      </View>
    );
  }
  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, paddingTop: 80, paddingHorizontal: t.spacing.pageH }}>
        <Pressable onPress={() => nav.goBack()} style={{ marginBottom: 16 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="body">{tr('This trip is no longer active.')}</Text>
      </View>
    );
  }

  const hasMap = !!(position || routeCoords || destCoord);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      {hasMap ? (
        <TripMap
          route={routeCoords}
          position={position}
          destination={destCoord}
          travelerName={name}
          travelerPhoto={traveler?.avatar_url}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text variant="body" color={t.colors.inkSoft} style={{ textAlign: 'center' }}>
            {tr("Waiting for {name}'s live location… They share it while their trip is active.", { name })}
          </Text>
        </View>
      )}

      {/* Back button */}
      <Pressable
        onPress={() => nav.goBack()}
        accessibilityLabel="Back"
        style={[
          {
            position: 'absolute',
            top: 20,
            left: 16,
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
        <IconChevron dir="left" color={t.colors.inkSoft} />
      </Pressable>

      {/* Bottom info card */}
      <View
        style={[
          {
            position: 'absolute',
            left: t.spacing.pageH,
            right: t.spacing.pageH,
            bottom: 20,
            backgroundColor: t.colors.parchment,
            borderRadius: t.radii.lg,
            padding: 16,
          },
          t.shadows.card,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Avatar name={name} size={44} photoUri={traveler?.avatar_url ?? undefined} />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold">
              {tr('Following {name}', { name })}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: status.color }} />
              <Text variant="meta" color={t.colors.inkSoft}>
                {status.label}
                {minsLeft !== null && trip.status === 'active' ? ` · ${tr('{m} min left', { m: Math.max(0, minsLeft) })}` : ''}
              </Text>
            </View>
          </View>
          {trip.status === 'active' && trip.remaining_m != null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: t.type.display, fontSize: 20, lineHeight: 26, color: t.colors.forest700 }}>
                {trip.remaining_s != null ? formatDuration(trip.remaining_s) : ''}
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>{tr('{dist} left', { dist: formatDistance(trip.remaining_m) })}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{tr('HEADING TO')}</Eyebrow>
            <Text variant="body" weight="semibold" style={{ marginTop: 2 }} numberOfLines={1}>
              {trip.destination}
            </Text>
          </View>
          <Text variant="meta" color={presenceStale ? palette.statusWarn : t.colors.inkMute} style={{ alignSelf: 'flex-end' }}>
            {presence
              ? presenceStale
                ? tr('location may be stale')
                : `updated ${new Date(presence.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <PillButton
            style={{ flex: 1 }}
            iconLeft={<IconPhone size={14} color={palette.gold300} />}
            onPress={() => callPhone(traveler?.phone, name, tr)}
          >
            {tr('Call')}
          </PillButton>
          <PillButton
            variant="secondary"
            style={{ flex: 1 }}
            iconLeft={<IconMessage size={14} color={t.colors.forest700} />}
            onPress={() => nav.navigate('Chat', { userId: trip.user_id })}
          >
            {tr('Message')}
          </PillButton>
        </View>

        {/* Buddy-side escape hatch: if the traveler forgot to end the trip,
            the follower can close it — otherwise it lingers on their Home
            forever with no way to dismiss it. Gated by the buddy RLS policy. */}
        {trip.status === 'active' && user?.id === trip.buddy_id && (
          <PillButton
            variant="ghost"
            block
            style={{ marginTop: 8 }}
            onPress={() => {
              Alert.alert(
                tr('Mark trip as completed?'),
                tr('Only do this if you know {name} arrived safely — it ends the trip and stops their live sharing.', { name }),
                [
                  { text: tr('Cancel'), style: 'cancel' },
                  {
                    text: tr('Mark as arrived'),
                    onPress: async () => {
                      const { error } = await supabase
                        .from('trips')
                        .update({ status: 'arrived', ended_at: new Date().toISOString() })
                        .eq('id', trip.id);
                      if (error) Alert.alert(tr("Couldn't end the trip"), error.message);
                    },
                  },
                ],
              );
            }}
          >
            {tr('Mark trip as completed')}
          </PillButton>
        )}
      </View>
    </View>
  );
}
