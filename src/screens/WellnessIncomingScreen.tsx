import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Pressable, Alert } from 'react-native';
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
import { useCheckIns } from '../hooks/useCheckIns';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COUNTDOWN_MS = 30_000;

export function WellnessIncomingScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'WellnessIncoming'>>();
  const fromName = route.params?.fromName ?? 'Someone';
  const fromId = route.params?.fromId;
  const checkInId = route.params?.checkInId;
  const { respondWellness } = useCheckIns();
  const [busy, setBusy] = useState(false);

  const v = useSharedValue(1);

  useEffect(() => {
    // Mark as seen immediately so the sender knows it was received.
    if (checkInId) supabase.rpc('mark_wellness_seen', { check_in_id: checkInId }).then(() => {});
    v.value = withTiming(0, { duration: COUNTDOWN_MS, easing: Easing.linear });
    // On timeout: go back without inserting a fake response — sender will see "no response yet"
    const id = setTimeout(() => nav.goBack(), COUNTDOWN_MS);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const barStyle = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));

  const respond = async (kind: 'ok' | 'wellness_response' | 'alarm', note: string) => {
    if (busy) return;
    setBusy(true);
    if (kind === 'ok') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'alarm') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await respondWellness(kind, note, fromId);
    setBusy(false);
    // Alarm always proceeds — AlarmActiveScreen inserts its own alarm event
    // and shows honest sent/failed status with a retry, so the circle still
    // gets notified even if this particular insert failed.
    if (kind === 'alarm') {
      nav.replace('AlarmActive');
      return;
    }
    if (res.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        tr("Couldn't send your response"),
        tr('{name} may not see that you answered. Check your connection and try again.', { name: fromName }),
      );
      return;
    }
    nav.goBack();
  };

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
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: 40,
              lineHeight: 96,
              width: 96,
              height: 96,
              textAlign: 'center',
              textAlignVertical: 'center' as any,
              includeFontPadding: false as any,
              color: palette.forest900,
            }}
          >
            {fromName[0]}
          </Text>
        </LinearGradient>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('WELLNESS CHECK 🏹')}</Eyebrow>
        <Text variant="displayH1" style={{ textAlign: 'center', marginBottom: 8 }}>
          <Text variant="displayH1" italic accent>
            {fromName}
          </Text>{' '}
          {tr('is checking in on you.')}
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 24 }}>
          {tr('Tap a response before the timer runs out.')}
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
          disabled={busy}
          onPress={() => respond('ok', 'All good')}
        >
          {tr('✅  All good!')}
        </PillButton>
        <PillButton
          variant="secondary"
          size="lg"
          block
          disabled={busy}
          onPress={() => respond('wellness_response', `need_help`)}
          style={{ backgroundColor: t.colors.gold100 }}
        >
          {tr('⚠️  I need help · let {name} know', { name: fromName })}
        </PillButton>
        <PillButton
          variant="danger"
          size="lg"
          block
          disabled={busy}
          onPress={() => respond('alarm', 'Alarm from wellness check')}
        >
          {tr('🚨  ALARM · alert entire circle')}
        </PillButton>
      </View>
    </View>
  );
}
