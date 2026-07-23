import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar, TripMap } from '../components';
import { IconChevron, IconLocate } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useTrips } from '../hooks/useTrips';
import { useCircle } from '../hooks/useCircle';
import { useCheckIns } from '../hooks/useCheckIns';
import { useHomePlace } from '../hooks/useHomePlace';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { personName } from '../lib/person';
import { useT } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { getRoute, formatDistance, formatDuration, LatLng, TravelMode } from '../lib/routing';
import {
  isLiveActivitiesSupported,
  startTripActivity,
  updateTripActivity,
  endTripActivity,
  TripActivityState,
} from '../lib/liveActivity';

// Grace period after ETA before the buddy/circle is auto-alerted.
const ETA_GRACE_MS = 5 * 60 * 1000;

// Warn the buddy while there's still enough charge to actually send the message.
const LOW_BATTERY_THRESHOLD = 0.15;

// How close (metres) to home OR the trip destination counts as "arrived".
const ARRIVAL_RADIUS_M = 120;

// Re-route (recompute remaining distance/time) at most this often.
const REROUTE_MIN_MS = 20_000;

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
const EMOJI: Record<string, string> = { walk: '🚶', bike: '🚴', car: '🚗', transit: '🚇', taxi: '🚕' };
const VALID_MODES: TravelMode[] = ['walk', 'bike', 'car'];

export function TripActiveScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const { activeTrip, loading, finish } = useTrips();
  const { members } = useCircle();
  const { recordAlarm, recordOk } = useCheckIns();
  const { home } = useHomePlace();
  const { user, profile } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [etaHandled, setEtaHandled] = useState(false);
  const [livePos, setLivePos] = useState<LatLng | null>(null);
  const [liveRoute, setLiveRoute] = useState<LatLng[] | null>(null);
  const [remaining, setRemaining] = useState<{ m: number; s: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const escalateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrivedRef = useRef(false);
  const lastRerouteRef = useRef(0);
  // Set right before any finish() call that's followed by our own explicit
  // navigation (arrived/escalated/cancelled). Without this, the "activeTrip
  // became null -> bounce to Trip setup" effect below fires in a race with
  // that explicit navigation — e.g. tapping "Need help" would replace this
  // screen with TripSetupScreen WHILE AlarmActive was being presented on top
  // of it, corrupting the native stack and crashing on the next back-press.
  const leavingRef = useRef(false);

  const destCoord: LatLng | null =
    activeTrip?.dest_lat != null && activeTrip?.dest_lng != null
      ? { latitude: activeTrip.dest_lat, longitude: activeTrip.dest_lng }
      : null;

  const mode: TravelMode = VALID_MODES.includes(activeTrip?.transport as TravelMode)
    ? (activeTrip?.transport as TravelMode)
    : 'walk';

  // Seed the route from the trip row (stored as [lng,lat] pairs).
  useEffect(() => {
    if (!liveRoute && activeTrip?.route) {
      setLiveRoute(activeTrip.route.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
    }
    if (!remaining && activeTrip?.remaining_m != null && activeTrip?.remaining_s != null) {
      setRemaining({ m: activeTrip.remaining_m, s: activeTrip.remaining_s });
    }
  }, [activeTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute the actual ETA timestamp from the "HH:MM" string + started_at date
  const etaTimestamp = React.useMemo(() => {
    if (!activeTrip?.eta || !activeTrip?.started_at) return null;
    const [h, m] = activeTrip.eta.split(':').map((n) => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return null;
    const start = new Date(activeTrip.started_at);
    const eta = new Date(start);
    eta.setHours(h, m, 0, 0);
    if (eta.getTime() <= start.getTime()) eta.setDate(eta.getDate() + 1);
    return eta.getTime();
  }, [activeTrip?.eta, activeTrip?.started_at]);

  // Progress: prefer live remaining distance over elapsed-time.
  const startMs = activeTrip ? new Date(activeTrip.started_at).getTime() : 0;
  const pct = remaining && activeTrip?.distance_m
    ? Math.max(0, Math.min(100, ((activeTrip.distance_m - remaining.m) / activeTrip.distance_m) * 100))
    : etaTimestamp && startMs
      ? Math.max(0, Math.min(100, ((now - startMs) / (etaTimestamp - startMs)) * 100))
      : null;
  const minsRemaining = remaining
    ? Math.max(0, Math.round(remaining.s / 60))
    : etaTimestamp
      ? Math.max(0, Math.round((etaTimestamp - now) / 60_000))
      : null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Live position watcher — smooth Uber-style marker (independent of presence interval).
  useEffect(() => {
    if (!activeTrip) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const ask = await Location.requestForegroundPermissionsAsync();
          if (ask.status !== 'granted') return;
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (loc) => setLivePos({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
        );
      } catch {
        // best-effort
      }
    })();
    return () => { sub?.remove(); };
  }, [activeTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const pctLevel = Math.round(level * 100);
      await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: activeTrip.buddy_id,
        body: `⚠️ My phone battery is low (${pctLevel}%) during my trip to ${activeTrip.destination}. If you lose contact, this is my last known spot.${locLink}`,
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

  // Escalate to the BUDDY only — the person following the trip. Marking the
  // trip 'escalated' fires the trips webhook, which pushes to the buddy and
  // turns their follow screen red. This does NOT raise a whole-circle alarm;
  // that's a separate, explicit choice (escalateWholeCircle below), matching
  // the ETA prompt's promise that only the buddy is alerted.
  const escalate = useCallback(async () => {
    if (escalateRef.current) {
      clearTimeout(escalateRef.current);
      escalateRef.current = null;
    }
    leavingRef.current = true;
    await finish('escalated');
    nav.goBack();
  }, [finish, nav]);

  // Explicit "alert my entire circle" — raises a real alarm (all circle members
  // get the SOS + FriendAlarmScreen) on top of escalating the trip to the buddy.
  const escalateWholeCircle = useCallback(async () => {
    if (escalateRef.current) {
      clearTimeout(escalateRef.current);
      escalateRef.current = null;
    }
    const dest = activeTrip?.destination ?? 'their destination';
    leavingRef.current = true;
    await recordAlarm(`Need help during trip to ${dest}`);
    await finish('escalated');
    nav.replace('AlarmActive');
  }, [activeTrip?.destination, recordAlarm, finish, nav]);

  // When the ETA passes, prompt the user once and start a grace timer.
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
            leavingRef.current = true;
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

  useEffect(() => {
    return () => {
      if (escalateRef.current) clearTimeout(escalateRef.current);
    };
  }, []);

  /** Arrived at either home or the trip destination → auto check-in. */
  const checkArrival = useCallback(
    async (lat: number, lng: number) => {
      if (arrivedRef.current) return false;
      const nearHome = home && distanceM(lat, lng, home.lat, home.lng) <= ARRIVAL_RADIUS_M;
      const nearDest = destCoord && distanceM(lat, lng, destCoord.latitude, destCoord.longitude) <= ARRIVAL_RADIUS_M;
      if (!nearHome && !nearDest) return false;
      arrivedRef.current = true;
      leavingRef.current = true;
      if (escalateRef.current) {
        clearTimeout(escalateRef.current);
        escalateRef.current = null;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await recordOk(nearDest ? `Arrived at ${activeTrip?.destination} — auto check-in` : 'Arrived home safe — auto check-in');
      await finish('arrived');
      Alert.alert(
        nearDest ? tr('You made it 🎉') : tr('Welcome home 🏡'),
        tr("You've arrived safely. Your trip ended and your buddy was notified."),
      );
      nav.goBack();
      return true;
    },
    [home, destCoord, recordOk, finish, nav, activeTrip?.destination],
  );

  // Trip location broadcast at chosen interval + live re-route.
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
        const { latitude, longitude } = loc.coords;
        await supabase.from('presence').upsert(
          { user_id: user.id, lat: latitude, lng: longitude, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        setLastSent(new Date());
        setNextIn(activeTrip.location_interval ?? 60);

        if (await checkArrival(latitude, longitude)) return;

        // Live re-route: recompute remaining path + ETA from the current position,
        // store on the trip row so the follower sees it update in realtime.
        if (destCoord && Date.now() - lastRerouteRef.current >= REROUTE_MIN_MS) {
          lastRerouteRef.current = Date.now();
          const r = await getRoute({ latitude, longitude }, destCoord, mode);
          if (r) {
            setLiveRoute(r.coords);
            setRemaining({ m: r.distanceM, s: r.durationS });
            await supabase
              .from('trips')
              .update({
                remaining_m: r.distanceM,
                remaining_s: r.durationS,
                route: r.coords.map((c) => [c.longitude, c.latitude]),
              })
              .eq('id', activeTrip.id);
          }
        }
      } catch {
        // best-effort
      }
    };

    sendLocation();
    timerRef.current = setInterval(sendLocation, intervalMs);

    countdownRef.current = setInterval(() => {
      setNextIn((n) => (n !== null && n > 0 ? n - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [activeTrip?.id, user, checkArrival]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !activeTrip && !leavingRef.current) {
      nav.replace('Trip');
    }
  }, [activeTrip, loading, nav]);

  // ── Live Activity (Dynamic Island + lock-screen card) ─────────────────────
  // Freshest state is kept in a ref so the 15 s update interval reads it without
  // re-subscribing every render. The native side self-ticks the ETA countdown
  // from endEpochSec, so we don't need frequent JS updates just for the timer.
  const liveActivityState: TripActivityState = {
    etaText: activeTrip?.eta ?? '—',
    endEpochSec: remaining
      ? Math.floor((Date.now() + remaining.s * 1000) / 1000)
      : etaTimestamp
        ? Math.floor(etaTimestamp / 1000)
        : null,
    distanceText: remaining ? formatDistance(remaining.m) : '',
    progress: pct != null ? Math.max(0, Math.min(1, pct / 100)) : 0,
    buddyName:
      personName(members.find((m) => m.profile.id === activeTrip?.buddy_id)?.profile ?? null) || tr('your buddy'),
    isFollowing: !!activeTrip?.followed_at,
    status: 'on_the_way',
  };
  const liveStateRef = useRef(liveActivityState);
  liveStateRef.current = liveActivityState;
  const activityIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTrip?.id || !isLiveActivitiesSupported()) return;
    activityIdRef.current = startTripActivity({
      destination: activeTrip.destination,
      transport: activeTrip.transport ?? 'walk',
      state: liveStateRef.current,
    });
    const iv = setInterval(() => updateTripActivity(activityIdRef.current, liveStateRef.current), 15_000);
    return () => {
      clearInterval(iv);
      endTripActivity(activityIdRef.current);
      activityIdRef.current = null;
    };
  }, [activeTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push an immediate update the moment the buddy starts following — that "👀
  // Emma is watching" flip on the lock screen is the signature moment.
  useEffect(() => {
    if (activeTrip?.followed_at) updateTripActivity(activityIdRef.current, liveStateRef.current);
  }, [activeTrip?.followed_at]);

  if (!activeTrip) return null;
  const buddy = members.find((m) => m.profile.id === activeTrip.buddy_id);
  const hasMap = !!(destCoord || liveRoute || livePos);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      {/* Live map */}
      {hasMap && (
        <View style={{ height: 300 }}>
          <TripMap
            route={liveRoute}
            position={livePos}
            destination={destCoord ? { ...destCoord, label: activeTrip.destination } : null}
            travelerName={profile?.name ?? 'Me'}
            travelerPhoto={profile?.avatar_url}
          />
          <Pressable
            onPress={() => nav.goBack()}
            accessibilityLabel="Back"
            style={[
              {
                position: 'absolute',
                top: 54,
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
        </View>
      )}

      {!hasMap && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
          <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }} accessibilityLabel="Back">
            <IconChevron dir="left" color={t.colors.inkSoft} />
          </Pressable>
          <Text variant="large" weight="semibold">
            {tr('Trip in progress')}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32, paddingTop: hasMap ? 16 : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 34, lineHeight: 44 }}>{EMOJI[activeTrip.transport ?? 'walk'] ?? '🚶'}</Text>
          <View style={{ flex: 1 }}>
            <Eyebrow>{tr('HEADING TO')}</Eyebrow>
            <Text style={{ fontFamily: t.type.display, fontSize: 22, lineHeight: 30, paddingTop: 2 }} numberOfLines={1}>
              {activeTrip.destination}
            </Text>
          </View>
          {remaining && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: t.type.display, fontSize: 22, lineHeight: 30, color: t.colors.forest700 }}>
                {formatDuration(remaining.s)}
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>{tr('{dist} left', { dist: formatDistance(remaining.m) })}</Text>
            </View>
          )}
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
                {minsRemaining !== null ? tr('{m} min left', { m: minsRemaining }) : pct >= 100 ? tr('ETA passed') : tr('Now')}
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>
                ETA · {activeTrip.eta ?? '—'}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={{ marginBottom: 14 }}>
            <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center' }}>
              {tr('No ETA set — progress will be tracked by your check-ins.')}
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
                {lastSent ? tr('Location sent') : tr('Sending location…')}
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
            <Eyebrow>{tr('BUDDY')}</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <Avatar
                name={personName(buddy.profile)}
                size={44}
                photoUri={buddy.profile.avatar_url ?? undefined}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">
                  {personName(buddy.profile)}
                </Text>
                <Text variant="meta" color={activeTrip.followed_at ? palette.statusOk : t.colors.inkMute}>
                  {activeTrip.followed_at
                    ? tr('👀 Following your trip now')
                    : `${buddy.relation ?? tr('Friend')} · ${tr("hasn't opened your trip yet")}`}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 22 }}>
          <Text variant="small" color={t.colors.inkSoft}>
            {tr("🌙 You'll get a check-in at {eta}. If you don't respond within 5 minutes, {name} sees your live location.", {
              eta: activeTrip.eta ?? 'ETA',
              name: buddy ? personName(buddy.profile) : tr('your buddy'),
            })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PillButton
            variant="secondary"
            size="lg"
            style={{ flex: 1 }}
            onPress={async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              leavingRef.current = true;
              await finish('arrived');
              nav.goBack();
            }}
          >
            {tr("I've arrived")}
          </PillButton>
          <PillButton
            variant="danger"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => {
              const buddyName = buddy ? personName(buddy.profile) : tr('your buddy');
              // Default is buddy-only — a trip already has a follower watching.
              // Alerting the WHOLE circle is a deliberate, separate choice.
              Alert.alert(
                tr('Need help?'),
                tr('{name} is following your trip and will be alerted right away. Do you also want to alert your entire circle?', { name: buddyName }),
                [
                  {
                    text: tr('Alert {name}', { name: buddyName }),
                    onPress: () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      escalate();
                    },
                  },
                  {
                    text: tr('🚨 Alert entire circle'),
                    style: 'destructive',
                    onPress: () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      escalateWholeCircle();
                    },
                  },
                  { text: tr('Cancel'), style: 'cancel' },
                ],
              );
            }}
          >
            {tr('🚨  Need help')}
          </PillButton>
        </View>

        <PillButton
          variant="ghost"
          block
          style={{ marginTop: 8 }}
          onPress={() => {
            leavingRef.current = true;
            finish('cancelled').then(() => nav.goBack());
          }}
        >
          {tr('Cancel trip')}
        </PillButton>
      </ScrollView>
    </View>
  );
}
