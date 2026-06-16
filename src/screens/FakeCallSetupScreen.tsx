import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { fakeCallScheduledAt, fakeCallCallerName, setFakeCallCallerName, scheduleFakeCall, cancelFakeCallSchedule } = useAppState();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 14, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Fake call
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: 18, alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontSize: 56, lineHeight: 68, marginBottom: 8 }}>📞</Text>
          <Eyebrow>CALLER · {fakeCallCallerName.toUpperCase()}</Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 44, lineHeight: 56, marginTop: 8 }}>
            {remaining != null ? `${remaining}s` : `${chosen}s`}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 6, textAlign: 'center' }}>
            Schedules an incoming call so you can leave any situation.
          </Text>
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>CALLER NAME</Eyebrow>
        <TextInput
          value={fakeCallCallerName}
          onChangeText={setFakeCallCallerName}
          placeholder="Mamma"
          placeholderTextColor={t.colors.inkMute}
          style={{
            backgroundColor: t.colors.parchment,
            borderRadius: t.radii.md,
            padding: 14,
            fontFamily: t.type.body,
            color: t.colors.ink,
            marginBottom: 22,
          }}
        />

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
    </KeyboardAvoidingView>
  );
}
