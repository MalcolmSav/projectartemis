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
import {
  WELLNESS_ANSWER_MS,
  WELLNESS_ANSWER_WARN_MS,
  WELLNESS_ANSWER_GRACE_MS,
  WELLNESS_ANSWER_EXTEND_MS,
} from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** answer → plenty of time left; ending → the last few seconds; grace → the
 *  window is up but the screen is still here, waiting one last moment. */
type Phase = 'answer' | 'ending' | 'grace';

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
  const [deadline, setDeadline] = useState(() => Date.now() + WELLNESS_ANSWER_MS);
  const [phase, setPhase] = useState<Phase>('answer');
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WELLNESS_ANSWER_MS / 1000));
  const warnedRef = React.useRef(false);

  const v = useSharedValue(1);

  useEffect(() => {
    // Mark as seen immediately so the sender knows it was received.
    if (checkInId) supabase.rpc('mark_wellness_seen', { check_in_id: checkInId }).then(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drain the bar over whatever time is actually left — restarted whenever the
  // deadline moves, so "give me a minute" refills it instead of desyncing.
  useEffect(() => {
    const remaining = deadline - Date.now();
    v.value = 1;
    if (remaining > 0) v.value = withTiming(0, { duration: remaining, easing: Easing.linear });
  }, [deadline, v]);

  useEffect(() => {
    const tick = () => {
      const remaining = deadline - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= -WELLNESS_ANSWER_GRACE_MS) {
        // Step aside without inserting a fake response — the sender sees "no
        // response yet", and the check stays answerable from the app.
        nav.goBack();
        return;
      }
      if (remaining <= 0) {
        setPhase('grace');
        return;
      }
      if (remaining <= WELLNESS_ANSWER_WARN_MS) {
        setPhase('ending');
        // One nudge, on the way into the warning — a pocket-phone should buzz
        // before the takeover disappears, not after.
        if (!warnedRef.current) {
          warnedRef.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        return;
      }
      setPhase('answer');
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, nav]);

  const grantMoreTime = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    warnedRef.current = false;
    setDeadline(Date.now() + WELLNESS_ANSWER_EXTEND_MS);
  };

  const barStyle = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));
  const barColor = phase === 'answer' ? palette.gold500 : palette.crimson;

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
        <Text
          variant="small"
          color={phase === 'answer' ? t.colors.inkSoft : palette.crimson}
          style={{ textAlign: 'center', marginBottom: 24 }}
        >
          {phase === 'grace'
            ? tr('Still there? This closes in a moment — you can answer from the app either way.')
            : phase === 'ending'
              ? tr('Closing in {s}s — tap a response, or ask for more time.', { s: secondsLeft })
              : tr('Tap a response before the timer runs out.')}
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
          <Animated.View style={[{ height: 6, backgroundColor: barColor }, barStyle]} />
        </View>

        {/* Buying time is not answering — it only keeps the screen up, so it
            never masquerades as a response to the person who's worried. */}
        {phase !== 'answer' && (
          <Pressable
            onPress={grantMoreTime}
            accessibilityRole="button"
            style={{
              marginTop: 18,
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: t.colors.hairline,
            }}
          >
            <Text variant="small" weight="semibold" color={t.colors.inkSoft}>
              {tr('Give me another {s} seconds', { s: Math.round(WELLNESS_ANSWER_EXTEND_MS / 1000) })}
            </Text>
          </Pressable>
        )}
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
