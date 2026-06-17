import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar } from '../components';
import { IconChevron, IconLocate } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useTrips } from '../hooks/useTrips';
import { useCircle } from '../hooks/useCircle';
import { useCheckIns } from '../hooks/useCheckIns';
import { useHomePlace } from '../hooks/useHomePlace';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

// Grace period after ETA before the buddy/circle is auto-alerted.
const ETA_GRACE_MS = 5 * 60 * 1000;

// Warn the buddy while there's still enough charge to actually send the message.
const LOW_BATTERY_THRESHOLD = 0.15;

// How close (metres) to your saved home counts as "arrived".
const ARRIVAL_RADIUS_M = 120;

/** Great-circle distance between two coords, in metres. */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Nav = NativeStackNavigationProp<RootStackParamList>;
const EMOJI: Record<string, string> = { walk: '🚶', transit: '🚇', car: '🚗', taxi: '🚕' };

export function TripActiveScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { activeTrip, loading, finish } = useTrips();
  const { members } = useCircle();
  const { recordAlarm, recordOk } = useCheckIns();
  const { home } = useHomePlace();
  const { user } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [nextIn, setNextIn] = useState<number | null>(null); // seconds until next send
  const [etaHandled, setEtaHandled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const escalateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrivedHomeRef = useRef(false);

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

  // Battery-aware alert: if the phone gets low during the trip, message the buddy
  // with the last location while there's still charge to send it. Fires once.
  const lowBatteryWarnedRef = useRef(false);
  useEffect(() => {
    if (!activeTrip?.buddy_id || !user) return;
    let cancelled = false;

    const warnBuddyLowBattery = async (level: number) => {
      if (cancelled || lowBatteryWarnedRef.current) return;
      lowBatteryWarnedRef.current = true;
      let locLink = '';
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        locLink = ` Last location: https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
      } catch {
        // best-effort
      }
      const pct = Math.round(level * 100);
      await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: activeTrip.buddy_id,
        body: `⚠️ My phone battery is low (${pct}%) during my trip to ${activeTrip.destination}. If you lose contact, this is my last known spot.${locLink}`,
      });
    };

    (async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0 && level <= LOW_BATTERY_THRESHOLD) await warnBuddyLowBattery(level);
      } catch {
        // battery API unavailable (e.g. simulator)
      }
    })();

    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel <= LOW_BATTERY_THRESHOLD) warnBuddyLowBattery(batteryLevel);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [activeTrip?.buddy_id, activeTrip?.destination, user]);

  // Auto-escalation: alert the circle and raise the alarm.
  const escalate = useCallback(async () => {
    if (escalateRef.current) {
      clearTimeout(escalateRef.current);
      escalateRef.current = null;
    }
    const dest = activeTrip?.destination ?? 'their destination';
    await recordAlarm(`Missed trip ETA to ${dest} — auto-escalated`);
    await finish('escalated');
    nav.replace('AlarmActive');
  }, [activeTrip?.destination, recordAlarm, finish, nav]);

  // When the ETA passes, prompt the user once and start a grace timer. If they
  // don't confirm they're safe within the grace window, escalate automatically.
  useEffect(() => {
    if (!etaTimestamp || etaHandled) return;
    if (now < etaTimestamp) return;

    setEtaHandled(true);
    const buddyName =
      members.find((m) => m.profile.id === activeTrip?.buddy_id)?.profile.name ?? 'your circle';

    escalateRef.current = setTimeout(escalate, ETA_GRACE_MS);

    Alert.alert(
      '🌙 You’ve reached your ETA',
      `Are you safe? If you don’t respond, ${buddyName} will be alerted and your live location shared in 5 minutes.`,
      [
        {
          text: 'I arrived safe',
          onPress: async () => {
            if (escalateRef.current) {
              clearTimeout(escalateRef.current);
              escalateRef.current = null;
            }
            await finish('arrived');
            nav.goBack();
          },
        },
        {
          text: '🚨 Need help',
          style: 'destructive',
          onPress: escalate,
        },
      ],
      { cancelable: false },
    );
  }, [now, etaTimestamp, etaHandled, members, activeTrip?.buddy_id, escalate, finish, nav]);

  // Clear any pending escalation timer if the screen unmounts.
  useEffect(() => {
    return () => {
      if (escalateRef.current) clearTimeout(escalateRef.current);
    };
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

        // Geofenced auto check-in: if we've reached the saved home, end the trip
        // as "arrived" automatically — no tapping needed.
        if (home && !arrivedHomeRef.current) {
          const d = distanceM(loc.coords.latitude, loc.coords.longitude, home.lat, home.lng);
          if (d <= ARRIVAL_RADIUS_M) {
            arrivedHomeRef.current = true;
            if (escalateRef.current) {
              clearTimeout(escalateRef.current);
              escalateRef.current = null;
            }
            await recordOk('Arrived home safe — auto check-in');
            await finish('arrived');
            Alert.alert('Welcome home 🏡', "You've arrived safely. Your trip ended and your buddy was notified.");
            nav.goBack();
          }
        }
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
  }, [activeTrip?.id, user, home, recordOk, finish, nav]);

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
