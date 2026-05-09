import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { Text, Eyebrow, PillButton } from '../components';
import { IconChevron } from '../components/icons';
import { palette } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COUNTDOWN_MS = 30_000;

export function WellnessIncomingScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'WellnessIncoming'>>();
  const fromName = route.params?.fromName ?? 'Sara';

  const respond = async (kind: 'wellness_response' | 'alarm', note: string) => {
    if (!user) return;
    await supabase.from('check_ins').insert({ user_id: user.id, kind, note });
  };

  const v = useSharedValue(1);

  useEffect(() => {
    v.value = withTiming(0, { duration: COUNTDOWN_MS, easing: Easing.linear });
    const id = setTimeout(() => {
      respond('wellness_response', 'no response — auto escalated').finally(() => nav.goBack());
    }, COUNTDOWN_MS);
    return () => clearTimeout(id);
  }, [nav, v]); // eslint-disable-line react-hooks/exhaustive-deps

  const barStyle = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      {/* Top half */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.spacing.pageH }}>
        <Pressable onPress={() => nav.goBack()} style={{ position: 'absolute', top: 60, left: 22, padding: 6 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>

        <LinearGradient
          colors={[palette.gold300, palette.gold500]}
          style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <Text style={{ fontFamily: t.type.display, fontSize: 40, color: palette.forest900 }}>
            {fromName[0]}
          </Text>
        </LinearGradient>

        <Eyebrow style={{ marginBottom: 8 }}>WELLNESS CHECK 🏹</Eyebrow>
        <Text variant="displayH1" style={{ textAlign: 'center', marginBottom: 8 }}>
          <Text variant="displayH1" italic accent>
            {fromName}
          </Text>{' '}
          wants to do a wellness check.
        </Text>
        <Text variant="bodyS" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 24 }}>
          Tap a response. Auto-escalates in {COUNTDOWN_MS / 1000}s.
        </Text>

        <View
          style={{
            width: '80%',
            height: 6,
            borderRadius: 999,
            backgroundColor: t.colors.hairline,
            overflow: 'hidden',
          }}
        >
          <Animated.View style={[{ height: 6, backgroundColor: palette.gold500 }, barStyle]} />
        </View>
      </View>

      {/* Bottom: response buttons */}
      <View style={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 32, gap: 10 }}>
        <PillButton
          size="lg"
          block
          onPress={async () => {
            await respond('wellness_response', 'all good');
            nav.goBack();
          }}
        >
          ✅  All good!
        </PillButton>
        <PillButton
          variant="secondary"
          size="lg"
          block
          onPress={async () => {
            await respond('wellness_response', `need help — sharing with ${fromName}`);
            nav.goBack();
          }}
          style={{ backgroundColor: t.colors.gold100 }}
        >
          ⚠️  Need help · share with {fromName}
        </PillButton>
        <PillButton
          variant="danger"
          size="lg"
          block
          onPress={async () => {
            await respond('alarm', 'manual alarm from wellness check');
            nav.replace('AlarmActive');
          }}
        >
          🚨  ALARM · alert entire circle
        </PillButton>
      </View>
    </View>
  );
}
