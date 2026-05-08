import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Card, PillButton } from '../components';
import { IconChevron } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const TIMINGS = [
  { sec: 10, label: '10s' },
  { sec: 30, label: '30s' },
  { sec: 60, label: '1 min' },
  { sec: 180, label: '3 min' },
  { sec: 300, label: '5 min' },
];

export function FakeCallSetupScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { fakeCallScheduledAt, scheduleFakeCall, cancelFakeCallSchedule } = useAppState();
  const [chosen, setChosen] = useState(30);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (fakeCallScheduledAt && fakeCallScheduledAt <= now) {
      cancelFakeCallSchedule();
      nav.replace('FakeCallIncoming');
    }
  }, [fakeCallScheduledAt, now, cancelFakeCallSchedule, nav]);

  const remaining = fakeCallScheduledAt ? Math.max(0, Math.ceil((fakeCallScheduledAt - now) / 1000)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Fake call
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32 }}>
        <Card style={{ marginBottom: 18, alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>📞</Text>
          <Eyebrow>CALLER · MAMMA</Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 44, marginTop: 8 }}>
            {remaining != null ? `${remaining}s` : `${chosen}s`}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 6, textAlign: 'center' }}>
            Schedules an iOS-style incoming call so you can leave any situation.
          </Text>
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>WHEN</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
          {TIMINGS.map((tt) => {
            const active = chosen === tt.sec;
            return (
              <Pressable
                key={tt.sec}
                onPress={() => setChosen(tt.sec)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                }}
              >
                <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.ink}>
                  {tt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          <PillButton
            size="lg"
            block
            onPress={() => {
              scheduleFakeCall(chosen);
            }}
          >
            Schedule fake call
          </PillButton>
          <PillButton variant="secondary" size="lg" block onPress={() => scheduleFakeCall(2)}>
            Call me right now (2s)
          </PillButton>
          {fakeCallScheduledAt && (
            <PillButton variant="ghost" block onPress={cancelFakeCallSchedule}>
              Cancel scheduled call
            </PillButton>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
