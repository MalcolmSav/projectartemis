import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton, Avatar } from '../components';
import { IconChevron } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useTrips } from '../hooks/useTrips';
import { useCircle } from '../hooks/useCircle';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const EMOJI: Record<string, string> = { walk: '🚶', transit: '🚇', car: '🚗', taxi: '🚕' };

export function TripActiveScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { activeTrip, finish } = useTrips();
  const { members } = useCircle();
  const [pct, setPct] = useState(8);

  useEffect(() => {
    const id = setInterval(() => setPct((p) => Math.min(100, p + 1.5)), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeTrip) {
      nav.replace('Trip');
    }
  }, [activeTrip, nav]);

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
          <Text style={{ fontSize: 56 }}>{EMOJI[activeTrip.transport ?? 'walk'] ?? '🚶'}</Text>
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
              {activeTrip.destination}
            </Text>
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
