import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar } from '../components';
import { IconChevron } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useCircle } from '../hooks/useCircle';
import { useTrips } from '../hooks/useTrips';
import { palette } from '../theme/tokens';
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
  const { activeTrip, start } = useTrips();
  const [destination, setDestination] = useState('');
  const [eta, setEta] = useState('');
  const [transport, setTransport] = useState('walk');
  const [buddyId, setBuddyId] = useState<string | null>(members[0]?.profile.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (activeTrip) nav.replace('TripActive');
  }, [activeTrip, nav]);

  useEffect(() => {
    if (!buddyId && members[0]) setBuddyId(members[0].profile.id);
  }, [members, buddyId]);

  const submit = async () => {
    if (!destination.trim()) return setErr('Destination is required');
    setBusy(true);
    setErr(null);
    const res = await start({ destination: destination.trim(), eta: eta.trim() || undefined, buddyId, transport });
    setBusy(false);
    if (res.error) return setErr(res.error);
    nav.replace('TripActive');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }} accessibilityLabel="Back">
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Trip Mode
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32 }}>
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

        <Eyebrow style={{ marginBottom: 6 }}>ETA</Eyebrow>
        <Card style={{ marginBottom: 14 }}>
          <TextInput
            value={eta}
            onChangeText={setEta}
            placeholder="HH:MM"
            placeholderTextColor={t.colors.inkMute}
            style={{ fontFamily: t.type.body, fontSize: 16, color: t.colors.ink }}
          />
        </Card>

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
                    name={p.profile.name ?? p.profile.email}
                    size={40}
                    photoUri={p.profile.avatar_url ?? undefined}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold" color={active ? palette.gold300 : t.colors.ink}>
                      {p.profile.name ?? p.profile.email}
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

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 18 }}>
          <Text variant="meta" color={t.colors.gold700} weight="semibold">
            HOW IT WORKS
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
            We'll check in with you 5 minutes before ETA. If you don't respond within 5 minutes, your buddy sees your live location.
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
    </View>
  );
}
