import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
const EMOJI: Record<Transport, string> = { walk: '🚶', transit: '🚇', car: '🚗', taxi: '🚕' };

export function TripActiveScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { trip, endTrip } = useAppState();
  const [pct, setPct] = useState(8);

  useEffect(() => {
    const id = setInterval(() => setPct((p) => Math.min(100, p + 1.5)), 1500);
    return () => clearInterval(id);
  }, []);

  if (!trip) {
    return null;
  }
  const buddy = CIRCLE.find((p) => p.id === trip.buddyId) ?? CIRCLE[0];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable
          onPress={() => {
            endTrip();
            nav.goBack();
          }}
          style={{ padding: 6, marginRight: 6 }}
        >
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Trip in progress
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32 }}>
        <View style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontSize: 56 }}>{EMOJI[trip.transport]}</Text>
          <Eyebrow style={{ marginTop: 12 }}>HEADING TO</Eyebrow>
          <Text variant="displayH1" style={{ marginTop: 4 }}>
            {trip.destination}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
            ETA · {trip.eta}
          </Text>
        </View>

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
              colors={[t.colors.forest700, palette.gold500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 8, width: `${pct}%` }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="meta" color={t.colors.inkMute}>
              Now
            </Text>
            <Text variant="meta" color={t.colors.inkMute}>
              {trip.destination} · Destination
            </Text>
          </View>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Eyebrow>BUDDY</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <Avatar name={buddy.name} size={44} status={buddy.status} />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">
                {buddy.name}
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>
                {buddy.relation} · notified if you miss ETA
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ backgroundColor: t.colors.gold100, padding: 14, borderRadius: t.radii.md, marginBottom: 22 }}>
          <Text variant="small" color={t.colors.inkSoft}>
            🌙 You'll get a check-in at {trip.eta}. If you don't respond within 5 minutes, {buddy.name} sees your live location.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PillButton
            variant="secondary"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => {
              endTrip();
              nav.goBack();
            }}
          >
            I've arrived
          </PillButton>
          <PillButton variant="danger" size="lg" style={{ flex: 1 }} onPress={() => nav.navigate('AlarmActive')}>
            🚨  Need help
          </PillButton>
        </View>
      </ScrollView>
    </View>
  );
}
