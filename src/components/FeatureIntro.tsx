import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheet } from './BottomSheet';
import { Text, Eyebrow } from './Text';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';

const PREFIX = 'artemis.seen.';

export interface FeatureDef {
  key: string;
  emoji: string;
  /** English source strings — translated via useT at render time. */
  title: string;
  body: string;
}

// First-tap explanations for the core safety tools. Kept short — one job each.
// Replaces the long onboarding tutorials: features explain themselves in context.
export const FEATURES = {
  trip: {
    key: 'trip',
    emoji: '🧭',
    title: 'Trip Mode',
    body: 'Pick a destination and the people you choose watch your live route on a map. If you don’t arrive by your ETA, they’re alerted automatically.',
  },
  wellness: {
    key: 'wellness',
    emoji: '🏹',
    title: 'Wellness check',
    body: 'Send a quick “are you okay?” to someone in your circle. They have 30 minutes to respond — and you’ll know the moment they do, even where they answered from.',
  },
  fakecall: {
    key: 'fakecall',
    emoji: '📞',
    title: 'Fake call',
    body: 'Schedule a realistic incoming call to give yourself an easy, believable way out of any situation.',
  },
  safetytimer: {
    key: 'safetytimer',
    emoji: '⏱️',
    title: 'Check on me',
    body: 'Set a timer before a walk, a date, or a late shift. If you don’t confirm you’re safe in time, your circle is alerted and your live location is shared.',
  },
  map: {
    key: 'map',
    emoji: '🗺️',
    title: 'Safety map',
    body: 'See your circle’s live locations and community safety reports near you. Flag an unsafe area to quietly warn others.',
  },
  locshare: {
    key: 'locshare',
    emoji: '📍',
    title: 'Share location',
    body: 'Choose exactly who in your circle can see your live location — and turn it on or off in one tap, anytime.',
  },
} satisfies Record<string, FeatureDef>;

/**
 * Gate an action behind a one-time explainer. On the FIRST tap of a feature it
 * shows the intro sheet, then runs the action on "Continue"; every time after,
 * the action runs immediately. Usage:
 *
 *   const intro = useFeatureIntro();
 *   ...onPress={() => intro.run(FEATURES.trip, () => nav.navigate('Trip'))}
 *   ...<FeatureIntroSheet controller={intro} />   // once, near the root of the screen
 */
export function useFeatureIntro() {
  const [active, setActive] = useState<FeatureDef | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const run = useCallback((def: FeatureDef, action: () => void) => {
    AsyncStorage.getItem(PREFIX + def.key)
      .then((v) => {
        if (v === '1') {
          action();
        } else {
          pending.current = action;
          setActive(def);
        }
      })
      .catch(() => action()); // storage failure shouldn't block the feature
  }, []);

  const proceed = useCallback(() => {
    if (active) AsyncStorage.setItem(PREFIX + active.key, '1').catch(() => {});
    const action = pending.current;
    pending.current = null;
    setActive(null);
    // Let the sheet dismiss before the action navigates.
    setTimeout(() => action?.(), 180);
  }, [active]);

  const close = useCallback(() => {
    pending.current = null;
    setActive(null);
  }, []);

  return { active, run, proceed, close };
}

export function FeatureIntroSheet({ controller }: { controller: ReturnType<typeof useFeatureIntro> }) {
  const t = useTheme();
  const tr = useT();
  const { active, proceed, close } = controller;

  return (
    <BottomSheet visible={!!active} onClose={close}>
      {active && (
        <View style={{ alignItems: 'center', paddingTop: 4 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              backgroundColor: t.colors.gold100,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 34, lineHeight: 40 }}>{active.emoji}</Text>
          </View>
          <Eyebrow color={t.colors.gold700} style={{ marginBottom: 6 }}>
            {tr('FIRST TIME')}
          </Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 30, marginBottom: 10, textAlign: 'center' }}>
            {tr(active.title)}
          </Text>
          <Text variant="body" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 22, lineHeight: 22 }}>
            {tr(active.body)}
          </Text>
          <PillButton size="lg" block onPress={proceed}>
            {tr('Got it, continue')}
          </PillButton>
        </View>
      )}
    </BottomSheet>
  );
}
