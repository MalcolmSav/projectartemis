import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';

export function OnboardingFakeCallStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setBusy(false);
    onComplete();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 64, lineHeight: 82, height: 82, marginBottom: 16 }}>📞</Text>
          <Eyebrow style={{ marginBottom: 6 }}>FAKE CALL</Eyebrow>
          <Text variant="displayH1" style={{ marginBottom: 8, textAlign: 'center' }}>
            Your{' '}
            <Text variant="displayH1" italic accent>
              escape plan.
            </Text>
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 24 }}>
            Schedule a fake incoming call to safely leave uncomfortable situations.
          </Text>
        </View>

        <Card style={{ marginBottom: 16, paddingVertical: 20, paddingHorizontal: 16 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 12 }}>
            How it works:
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>1.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Choose who appears as the caller (Mom, Friend, etc.)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>2.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Set the delay (10s to 5 minutes)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>3.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Your phone will ring with a realistic incoming call screen
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>4.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Answer or decline - you now have a reason to leave
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 24, paddingVertical: 20, paddingHorizontal: 16 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 12 }}>
            When to use it:
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.crimson}>•</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Uncomfortable dates or social situations
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.crimson}>•</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                When you feel unsafe and need an exit
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.crimson}>•</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                To avoid conversations you're not comfortable with
              </Text>
            </View>
          </View>
        </Card>

        <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 24 }}>
          Find it in Quick Actions on your Home screen
        </Text>

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10, textAlign: 'center' }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy}>
          {busy ? 'Saving…' : 'Got it'}
        </PillButton>
      </ScrollView>
    </View>
  );
}
