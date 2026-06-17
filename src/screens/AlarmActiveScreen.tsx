import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Alert, Linking } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, PillButton, Avatar } from '../components';
import { IconPhone } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useCircle } from '../hooks/useCircle';
import { useEmergencyContacts } from '../hooks/useEmergencyContacts';
import { sendSosSms } from '../lib/sos';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ALARM_BG = '#1A0908';

function fmt(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function Waveform() {
  const t = useTheme();
  const bars = [0, 1, 2, 3, 4];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22 }}>
      {bars.map((i) => (
        <Bar key={i} delay={i * 120} />
      ))}
    </View>
  );
}

function Bar({ delay }: { delay: number }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [v]);
  const style = useAnimatedStyle(() => ({ height: 6 + v.value * 16 }));
  return <Animated.View style={[{ width: 3, borderRadius: 999, backgroundColor: palette.crimson }, style]} />;
}

export function AlarmActiveScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { members } = useCircle();
  const { contacts } = useEmergencyContacts(user?.id);
  const [elapsed, setElapsed] = useState(0);
  const [place, setPlace] = useState<string | null>(null);
  const [placeTime, setPlaceTime] = useState<Date | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 250);
    return () => clearInterval(id);
  }, []);

  // While the alarm is active, broadcast live location to the circle (write to
  // presence) and resolve a human-readable place for the card. Re-sends every
  // 20s so "live location shared" is actually true, not just a claim.
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = async (withGeo: boolean) => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const ask = await Location.requestForegroundPermissionsAsync();
          if (ask.status !== 'granted') return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        // Share with the circle via presence.
        if (user) {
          await supabase.from('presence').upsert(
            { user_id: user.id, lat: loc.coords.latitude, lng: loc.coords.longitude, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
        }
        setPlaceTime(new Date());
        if (withGeo) {
          const geo = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (cancelled) return;
          const g = geo[0];
          setPlace(
            g
              ? [g.name ?? g.street, g.city ?? g.region].filter(Boolean).join(', ')
              : `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`,
          );
        }
      } catch {
        // best-effort
      }
    };

    tick(true);
    interval = setInterval(() => tick(false), 20_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [user]);

  const onTextContacts = async () => {
    if (contacts.length === 0) {
      Alert.alert('No emergency contacts', 'Add emergency contacts in your profile so they can be texted in an emergency.');
      return;
    }
    setSmsBusy(true);
    const res = await sendSosSms(contacts.map((c) => c.contact_info));
    setSmsBusy(false);
    if (res.error) Alert.alert('Could not open Messages', res.error);
  };

  // Persist the alarm event so the circle sees it
  useEffect(() => {
    if (!user) return;
    supabase.from('check_ins').insert({ user_id: user.id, kind: 'alarm', note: 'Live alarm started' });
  }, [user]);

  // Pulsing red field
  const field = useSharedValue(0);
  useEffect(() => {
    field.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [field]);
  const fieldStyle = useAnimatedStyle(() => ({ opacity: 0.25 + field.value * 0.35 }));

  // Pulsing red dot for recording indicator
  const dot = useSharedValue(0);
  useEffect(() => {
    dot.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.4 + dot.value * 0.6 }));

  return (
    <View style={{ flex: 1, backgroundColor: ALARM_BG }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '60%',
            backgroundColor: 'rgba(192,57,43,0.18)',
          },
          fieldStyle,
        ]}
      />

      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 80, paddingBottom: 32 }}>
        <Eyebrow color={palette.crimsonSoft} style={{ marginBottom: 6 }}>
          ● ALARM ACTIVE
        </Eyebrow>
        <Text variant="displayH1" color="#F2EFE3" style={{ marginBottom: 18 }}>
          Live location shared with your{' '}
          <Text variant="displayH1" italic style={{ color: palette.gold300 }}>
            entire circle.
          </Text>
        </Text>

        {/* Alarm-active indicator */}
        <View
          style={{
            backgroundColor: 'rgba(192,57,43,0.18)',
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Animated.View
            style={[
              { width: 10, height: 10, borderRadius: 999, backgroundColor: palette.crimson },
              dotStyle,
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight="semibold" color="#F2EFE3">
              Alarm active · Circle notified
            </Text>
            <Text variant="meta" color={palette.crimsonSoft}>
              Live location shared
            </Text>
          </View>
          <Waveform />
          <Text style={{ fontFamily: 'Courier', color: '#F2EFE3', fontSize: 14 }}>{fmt(elapsed)}</Text>
        </View>

        {/* Mini map card */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 18,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <Eyebrow color={palette.crimsonSoft}>LAST KNOWN</Eyebrow>
          <Text variant="body" weight="semibold" color="#F2EFE3" style={{ marginTop: 4 }}>
            {place ?? 'Locating…'}
          </Text>
          <Text variant="meta" color={palette.crimsonSoft}>
            {placeTime ? placeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'updating'}
          </Text>
        </View>

        {/* Notified circle */}
        <Eyebrow color={palette.crimsonSoft} style={{ marginBottom: 8 }}>
          NOTIFIED
        </Eyebrow>
        <View style={{ gap: 8, marginBottom: 24 }}>
          {members.length === 0 ? (
            <Text variant="small" color={palette.crimsonSoft}>
              No one in your circle yet. Add someone in the Circle tab so they're alerted next time.
            </Text>
          ) : (
            members.map((m) => (
              <View
                key={m.edgeId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  padding: 12,
                  gap: 12,
                }}
              >
                <Avatar name={m.profile.name ?? m.profile.email} size={40} photoUri={m.profile.avatar_url ?? undefined} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold" color="#F2EFE3">
                    {m.profile.name ?? m.profile.email}
                  </Text>
                  <Text variant="meta" color={palette.crimsonSoft}>
                    {m.relation ?? 'Friend'}
                    {m.profile.phone ? ` · ${m.profile.phone}` : ''}
                  </Text>
                </View>
                <Pressable
                  disabled={!m.profile.phone}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${m.profile.name ?? 'circle member'}`}
                  onPress={() => {
                    if (m.profile.phone) Linking.openURL(`tel:${m.profile.phone.replace(/\s+/g, '')}`);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: palette.forest700,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: m.profile.phone ? 1 : 0.4,
                  }}
                >
                  <IconPhone color={palette.gold300} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <PillButton
          size="lg"
          block
          onPress={() => nav.navigate('EmergencyCall')}
          style={{ backgroundColor: palette.crimson, marginBottom: 10 }}
        >
          <Text style={{ fontFamily: t.type.display, fontSize: 20, color: '#fff', lineHeight: 26 }}>
            📞  Call 112
          </Text>
        </PillButton>

        <PillButton
          size="lg"
          block
          disabled={smsBusy}
          onPress={onTextContacts}
          style={{ backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 10 }}
        >
          <Text style={{ fontFamily: t.type.bodySemibold, fontSize: 15, color: '#F2EFE3' }}>
            {smsBusy ? 'Opening Messages…' : '📵  Text my emergency contacts'}
          </Text>
        </PillButton>

        <PillButton
          size="lg"
          block
          variant="secondary"
          onPress={() => nav.goBack()}
          style={{ backgroundColor: '#F5F0E8' }}
        >
          <Text style={{ color: palette.crimson, fontFamily: t.type.bodySemibold }}>Cancel alarm</Text>
        </PillButton>
      </ScrollView>
    </View>
  );
}
