import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar, BottomSheet } from '../components';
import { IconChevron, IconClock } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useCircle } from '../hooks/useCircle';
import { useTrips } from '../hooks/useTrips';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { personName } from '../lib/person';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const TRANSPORTS: { id: string; label: string; emoji: string }[] = [
  { id: 'walk', label: 'Walking', emoji: '🚶' },
  { id: 'transit', label: 'Transit', emoji: '🚇' },
  { id: 'car', label: 'Car', emoji: '🚗' },
  { id: 'taxi', label: 'Taxi', emoji: '🚕' },
];

export function TripSetupScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { members } = useCircle();
  const { user } = useAuth();
  const { activeTrip, loading, start } = useTrips();
  const [destination, setDestination] = useState('');
  const [etaHour, setEtaHour] = useState<number | null>(null);
  const [etaMinute, setEtaMinute] = useState<number | null>(null);
  const [etaOpen, setEtaOpen] = useState(false);
  const [transport, setTransport] = useState('walk');

  const etaString = etaHour !== null && etaMinute !== null
    ? `${String(etaHour).padStart(2, '0')}:${String(etaMinute).padStart(2, '0')}`
    : null;
  const [buddyId, setBuddyId] = useState<string | null>(members[0]?.profile.id ?? null);
  const [locationInterval, setLocationInterval] = useState(60); // seconds
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && activeTrip) nav.replace('TripActive');
  }, [activeTrip, loading, nav]);

  useEffect(() => {
    if (!buddyId && members[0]) setBuddyId(members[0].profile.id);
  }, [members, buddyId]);

  const submit = async () => {
    if (!destination.trim()) return setErr('Destination is required');
    setBusy(true);
    setErr(null);
    const res = await start({ destination: destination.trim(), eta: etaString ?? undefined, buddyId, transport, locationInterval });
    setBusy(false);
    if (res.error) return setErr(res.error);

    // Let the buddy know they can follow this trip (gives them a chat heads-up).
    if (buddyId && user) {
      const etaText = etaString ? ` (ETA ${etaString})` : '';
      supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: buddyId,
          body: `🧭 I just started a trip to ${destination.trim()}${etaText}. You can follow my live location in Artemis.`,
        })
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
          Trip Mode
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>DESTINATION</Eyebrow>
        <Card style={{ marginBottom: 14 }}>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Where are you going?"
            placeholderTextColor={t.colors.inkMute}
            style={{ fontFamily: t.type.body, fontSize: 16, color: t.colors.ink }}
          />
        </Card>

        <Eyebrow style={{ marginBottom: 6 }}>ETA (OPTIONAL)</Eyebrow>
        <Pressable onPress={() => setEtaOpen(true)}>
          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="body" color={etaString ? t.colors.ink : t.colors.inkMute}>
                {etaString ?? 'Set arrival time…'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {etaString && (
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

        <Eyebrow style={{ marginBottom: 6 }}>TRANSPORT</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {TRANSPORTS.map((tr) => {
            const active = transport === tr.id;
            return (
              <Pressable
                key={tr.id}
                onPress={() => setTransport(tr.id)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderRadius: t.radii.md,
                  backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                }}
              >
                <Text style={{ fontSize: 24 }}>{tr.emoji}</Text>
                <Text variant="meta" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft} style={{ marginTop: 4 }}>
                  {tr.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Eyebrow style={{ marginBottom: 6 }}>BUDDY (NOTIFIED IF YOU MISS ETA)</Eyebrow>
        {members.length === 0 ? (
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 18 }}>
            Add a friend in the Circle tab first — Trip Mode needs a buddy.
          </Text>
        ) : (
          <View style={{ gap: 8, marginBottom: 18 }}>
            {members.map((p) => {
              const active = buddyId === p.profile.id;
              return (
                <Pressable
                  key={p.edgeId}
                  onPress={() => setBuddyId(p.profile.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    gap: 12,
                    borderRadius: t.radii.md,
                    backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                  }}
                >
                  <Avatar
                    name={personName(p.profile)}
                    size={40}
                    photoUri={p.profile.avatar_url ?? undefined}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" color={active ? palette.gold300 : t.colors.ink}>
                      {personName(p.profile)}
                    </Text>
                    <Text variant="meta" color={active ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}>
                      {p.relation ?? 'Friend'}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: active ? t.colors.gold300 : t.colors.hairline,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {active && <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: t.colors.gold300 }} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Eyebrow style={{ marginBottom: 6 }}>LOCATION UPDATE FREQUENCY</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {([
            { label: '1 min', value: 60 },
            { label: '5 min', value: 300 },
            { label: '10 min', value: 600 },
            { label: '30 min', value: 1800 },
          ] as const).map((opt) => {
            const active = locationInterval === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setLocationInterval(opt.value)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: t.radii.md,
                  backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                }}
              >
                <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 18 }}>
          <Text variant="meta" color={t.colors.gold700} weight="semibold">
            HOW IT WORKS
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
            We'll ask if you're safe when you reach your ETA. If you don't confirm within 5 minutes, your buddy is alerted and your live location is shared.
          </Text>
        </View>

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block disabled={busy || !destination.trim() || members.length === 0} onPress={submit}>
          {busy ? 'Starting…' : '▶  Start trip'}
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
        Set arrival time
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 20 }}>
        We'll check that you're safe when you reach this time.
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
        Set ETA to {fmt2(hour)}:{fmt2(minute)}
      </PillButton>
      <PillButton variant="ghost" block onPress={onClose}>
        Cancel
      </PillButton>
    </BottomSheet>
  );
}
