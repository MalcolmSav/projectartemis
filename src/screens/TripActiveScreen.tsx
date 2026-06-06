import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar } from '../components';
import { IconChevron, IconLocate } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useTrips } from '../hooks/useTrips';
import { useCircle } from '../hooks/useCircle';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const EMOJI: Record<string, string> = { walk: '🚶', transit: '🚇', car: '🚗', taxi: '🚕' };

export function TripActiveScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { activeTrip, loading, finish } = useTrips();
  const { members } = useCircle();
  const { user } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [nextIn, setNextIn] = useState<number | null>(null); // seconds until next send
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute the actual ETA timestamp from the "HH:MM" string + started_at date
  const etaTimestamp = React.useMemo(() => {
    if (!activeTrip?.eta || !activeTrip?.started_at) return null;
    const [h, m] = activeTrip.eta.split(':').map((n) => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return null;
    const start = new Date(activeTrip.started_at);
    const eta = new Date(start);
    eta.setHours(h, m, 0, 0);
    // If ETA is before start (e.g. trip starts 23:50, ETA 00:10), bump to next day
    if (eta.getTime() <= start.getTime()) eta.setDate(eta.getDate() + 1);
    return eta.getTime();
  }, [activeTrip?.eta, activeTrip?.started_at]);

  // Real progress: elapsed time / total trip duration
  const startMs = activeTrip ? new Date(activeTrip.started_at).getTime() : 0;
  const pct = etaTimestamp && startMs
    ? Math.max(0, Math.min(100, ((now - startMs) / (etaTimestamp - startMs)) * 100))
    : null;
  const minsRemaining = etaTimestamp ? Math.max(0, Math.round((etaTimestamp - now) / 60_000)) : null;

  useEffect(() => {
    // Tick every 5s — fine-grained enough for the progress bar without burning battery
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Trip location broadcast at chosen interval
  useEffect(() => {
    if (!activeTrip || !user) return;
    const intervalMs = (activeTrip.location_interval ?? 60) * 1000;

    const sendLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const ask = await Location.requestForegroundPermissionsAsync();
          if (ask.status !== 'granted') return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await supabase.from('presence').upsert(
          { user_id: user.id, lat: loc.coords.latitude, lng: loc.coords.longitude, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        setLastSent(new Date());
        setNextIn(activeTrip.location_interval ?? 60);
      } catch {
        // best-effort
      }
    };

    sendLocation();
    timerRef.current = setInterval(sendLocation, intervalMs);

    // Countdown ticker — decrements every second
    countdownRef.current = setInterval(() => {
      setNextIn((n) => (n !== null && n > 0 ? n - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [activeTrip?.id, user]);

  useEffect(() => {
    if (!loading && !activeTrip) {
      nav.replace('Trip');
    }
  }, [activeTrip, loading, nav]);

  if (!activeTrip) return null;
  const buddy = members.find((m) => m.profile.id === activeTrip.buddy_id);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable
          onPress={() => nav.goBack()}
          style={{ padding: 6, marginRight: 6 }}
          accessibilityLabel="Back"
        >
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Trip in progress
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32 }}>
        <View style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontSize: 56, lineHeight: 72, paddingTop: 8 }}>{EMOJI[activeTrip.transport ?? 'walk'] ?? '🚶'}</Text>
          <Eyebrow style={{ marginTop: 12 }}>HEADING TO</Eyebrow>
          <Text variant="displayH1" style={{ marginTop: 4 }}>
            {activeTrip.destination}
          </Text>
          {activeTrip.eta ? (
            <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
              ETA · {activeTrip.eta}
            </Text>
          ) : null}
        </View>

        {pct !== null ? (
          <Card style={{ marginBottom: 14 }}>
            <View
              style={{
                height: 8,
                backgroundColor: t.colors.moonlight,
                borderRadius: 999,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <LinearGradient
                colors={pct >= 100 ? [palette.crimson, palette.crimson] : [t.colors.forest700, palette.gold500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 8, width: `${pct}%` }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="meta" color={t.colors.inkMute}>
                {pct >= 100 ? 'ETA passed' : minsRemaining !== null ? `${minsRemaining} min left` : 'Now'}
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>
                ETA · {activeTrip.eta}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={{ marginBottom: 14 }}>
            <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center' }}>
              No ETA set — progress will be tracked by your check-ins.
            </Text>
          </Card>
        )}

        {/* Live location status */}
        <Card style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: lastSent ? t.colors.forest700 : t.colors.moonlight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconLocate size={16} color={lastSent ? palette.gold300 : t.colors.inkMute} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small" weight="semibold">
                {lastSent ? 'Location sent' : 'Sending location…'}
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>
                {lastSent
                  ? `Last: ${lastSent.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  ·  Next in ${nextIn ?? '…'}s`
                  : `Every ${activeTrip.location_interval >= 60 ? `${activeTrip.location_interval / 60} min` : `${activeTrip.location_interval}s`}`}
              </Text>
            </View>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: lastSent ? '#34C759' : t.colors.hairline }} />
          </View>
        </Card>

        {buddy && (
          <Card style={{ marginBottom: 14 }}>
            <Eyebrow>BUDDY</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <Avatar
                name={buddy.profile.name ?? buddy.profile.email}
                size={44}
                photoUri={buddy.profile.avatar_url ?? undefined}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">
                  {buddy.profile.name ?? buddy.profile.email}
                </Text>
                <Text variant="meta" color={t.colors.inkMute}>
                  {buddy.relation ?? 'Friend'} · notified if you miss ETA
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 22 }}>
          <Text variant="small" color={t.colors.inkSoft}>
            🌙 You'll get a check-in at {activeTrip.eta ?? 'ETA'}. If you don't respond within 5 minutes, {buddy?.profile.name ?? 'your buddy'} sees your live location.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PillButton
            variant="secondary"
            size="lg"
            style={{ flex: 1 }}
            onPress={async () => {
              await finish('arrived');
              nav.goBack();
            }}
          >
            I've arrived
          </PillButton>
          <PillButton
            variant="danger"
            size="lg"
            style={{ flex: 1 }}
            onPress={async () => {
              await finish('escalated');
              nav.navigate('AlarmActive');
            }}
          >
            🚨  Need help
          </PillButton>
        </View>

        <PillButton variant="ghost" block style={{ marginTop: 8 }} onPress={() => finish('cancelled').then(() => nav.goBack())}>
          Cancel trip
        </PillButton>
      </ScrollView>
    </View>
  );
}
