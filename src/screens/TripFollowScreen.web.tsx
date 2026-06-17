import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, PillButton, Avatar } from '../components';
import { IconChevron, IconPhone, IconMessage } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { usePresence } from '../hooks/usePresence';
import { supabase, Profile } from '../lib/supabase';
import { Trip } from '../hooks/useTrips';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Web build has no native map; show the live status + a link out to Google Maps.
export function TripFollowScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'TripFollow'>>();
  const tripId = route.params.tripId;
  const { byUser } = usePresence();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [traveler, setTraveler] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
      if (cancelled) return;
      const tr = (data as Trip) ?? null;
      setTrip(tr);
      if (tr) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', tr.user_id).maybeSingle();
        if (!cancelled) setTraveler((prof as Profile) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const presence = trip ? byUser[trip.user_id] : undefined;
  const name = traveler?.name ?? traveler?.email ?? 'Your friend';

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
  const minsLeft = etaTs ? Math.round((etaTs - now) / 60_000) : null;

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
        <Text variant="body">This trip is no longer active.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, paddingTop: 70, paddingHorizontal: t.spacing.pageH }}>
      <Pressable onPress={() => nav.goBack()} accessibilityLabel="Back" style={{ marginBottom: 16 }}>
        <IconChevron dir="left" color={t.colors.inkSoft} />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Avatar name={name} size={48} photoUri={traveler?.avatar_url ?? undefined} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="semibold">Following {name}</Text>
          <Text variant="meta" color={t.colors.inkSoft}>
            Heading to {trip.destination}
            {minsLeft !== null && trip.status === 'active' ? ` · ETA in ${Math.max(0, minsLeft)} min` : ''}
          </Text>
        </View>
      </View>

      {presence ? (
        <PillButton
          block
          onPress={() => Linking.openURL(`https://maps.google.com/?q=${presence.lat},${presence.lng}`)}
        >
          Open live location in Google Maps
        </PillButton>
      ) : (
        <Text variant="small" color={t.colors.inkSoft}>Waiting for {name}'s live location…</Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <PillButton
          style={{ flex: 1 }}
          iconLeft={<IconPhone size={14} color={palette.gold300} />}
          onPress={() => {
            if (traveler?.phone) Linking.openURL(`tel:${traveler.phone.replace(/\s+/g, '')}`);
          }}
        >
          Call
        </PillButton>
        <PillButton
          variant="secondary"
          style={{ flex: 1 }}
          iconLeft={<IconMessage size={14} color={t.colors.forest700} />}
          onPress={() => nav.navigate('Chat', { userId: trip.user_id })}
        >
          Message
        </PillButton>
      </View>
    </View>
  );
}
