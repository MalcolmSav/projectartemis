import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar } from '../components';
import { IconChevron } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { CIRCLE, Transport } from '../data/demo';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const TRANSPORTS: { id: Transport; label: string; emoji: string }[] = [
  { id: 'walk', label: 'Walking', emoji: '🚶' },
  { id: 'transit', label: 'Transit', emoji: '🚇' },
  { id: 'car', label: 'Car', emoji: '🚗' },
  { id: 'taxi', label: 'Taxi', emoji: '🚕' },
];

export function TripSetupScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { startTrip } = useAppState();
  const [destination, setDestination] = useState('Karolinska');
  const [eta, setEta] = useState('23:15');
  const [transport, setTransport] = useState<Transport>('walk');
  const [buddyId, setBuddyId] = useState(CIRCLE[0].id);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }}>
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
        <View style={{ gap: 8, marginBottom: 18 }}>
          {CIRCLE.map((p) => {
            const active = buddyId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setBuddyId(p.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  gap: 12,
                  borderRadius: t.radii.md,
                  backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                }}
              >
                <Avatar name={p.name} size={40} status={p.status} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold" color={active ? palette.gold300 : t.colors.ink}>
                    {p.name}
                  </Text>
                  <Text variant="meta" color={active ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}>
                    {p.relation}
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

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 18 }}>
          <Text variant="meta" color={t.colors.gold700} weight="semibold">
            HOW IT WORKS
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
            We'll check in with you 5 minutes before ETA. If you don't respond within 5 minutes, your buddy sees your live location.
          </Text>
        </View>

        <PillButton
          size="lg"
          block
          onPress={() => {
            startTrip({ destination, eta, transport, buddyId, startedAt: Date.now() });
            nav.replace('TripActive');
          }}
        >
          ▶  Start trip
        </PillButton>
      </ScrollView>
    </View>
  );
}
