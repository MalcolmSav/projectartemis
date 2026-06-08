import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';

export function OnboardingTripModeStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    setErr(null);

    try {
      // Mark trip mode tutorial as completed
      const { error } = await supabase
        .from('profiles')
        .update({ trip_mode_tutorial_completed: true })
        .eq('id', profile.id);

      if (error) {
        console.error('Trip mode tutorial update error:', error);
      } else {
        await refreshProfile();
      }
    } catch (e: any) {
      console.error('Save error:', e);
    }

    setBusy(false);
    onComplete();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 64, lineHeight: 82, height: 82, marginBottom: 16 }}>🚗</Text>
          <Eyebrow style={{ marginBottom: 6 }}>TRIP MODE</Eyebrow>
          <Text variant="displayH1" style={{ marginBottom: 8, textAlign: 'center' }}>
            Track your{' '}
            <Text variant="displayH1" italic accent>
              journey.
            </Text>
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 24 }}>
            Share your trip progress with a trusted buddy for extra safety.
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
                Set your destination and ETA
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>2.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Choose a buddy from your circle to track you
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>3.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Select your transport mode (walk, transit, car, taxi)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>4.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Your buddy sees your progress and gets notified if you're delayed
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 16, paddingVertical: 20, paddingHorizontal: 16 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 12 }}>
            During your trip:
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.forest700}>✓</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Live progress bar shows your journey completion
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.forest700}>✓</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Buddy can see your estimated arrival time
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.forest700}>✓</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Quick actions to "I arrived" or "I need help"
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
                Walking home alone at night
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.crimson}>•</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Meeting someone new in an unfamiliar area
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.crimson}>•</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                Long journeys through remote areas
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
