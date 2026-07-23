import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { useT } from '../i18n';
import { supabase } from '../lib/supabase';

export function OnboardingCompleteStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const tr = useT();
  const { profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finalize = async () => {
    if (!profile) return;
    setBusy(true);
    setErr(null);

    // If this write fails, the user must NOT be dropped into the main app —
    // the server-side flag would still say onboarded:false, and they'd get
    // unexpectedly bounced back into onboarding on a later profile refresh.
    const { error } = await supabase
      .from('profiles')
      .update({ onboarded: true })
      .eq('id', profile.id);

    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }

    await refreshProfile();
    setBusy(false);
    onComplete();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 100, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: t.type.display, fontSize: 48, lineHeight: 64, height: 64, marginBottom: 12, textAlign: 'center' }}>
          🎉
        </Text>

        <Eyebrow style={{ marginBottom: 6, textAlign: 'center' }}>{tr("YOU'RE ALL SET!")}</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8, textAlign: 'center' }}>
          {tr('Welcome to your')}{' '}
          <Text variant="displayH1" italic accent>
            {tr('circle.')}
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 32, textAlign: 'center' }}>
          {tr('Your circle watches over you from here. Explore trips, wellness checks, and the fake call whenever you need them.')}
        </Text>

        <Card style={{ marginBottom: 32, width: '100%' }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 8 }}>
            {tr("What's next?")}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • {tr('Send a wellness check from the Home screen')}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • {tr('Start a trip when traveling alone or at night')}
          </Text>
          <Text variant="small" color={t.colors.inkSoft}>
            • {tr('Use the fake call to exit uncomfortable situations')}
          </Text>
        </Card>

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10, textAlign: 'center' }}>
            {err} — {tr('tap Get Started again to retry.')}
          </Text>
        )}

        <PillButton size="lg" block onPress={finalize} disabled={busy}>
          {busy ? tr('Finishing…') : tr('Get Started')}
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

