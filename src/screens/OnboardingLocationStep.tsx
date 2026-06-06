import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Eyebrow, PillButton, Card, Toggle } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';

export function OnboardingLocationStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [locationSharing, setLocationSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ location_sharing_enabled: locationSharing })
        .eq('id', profile.id);

      if (error) {
        console.error('Location update error:', error);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>LOCATION SHARING</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          Share your{' '}
          <Text variant="displayH1" italic accent>
            location.
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          Your circle can see your real-time location on the map. You can turn this on or off anytime in Settings.
        </Text>

        <Card style={{ marginBottom: 22, paddingVertical: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">
                {locationSharing ? '📍 Location Sharing ON' : '📍 Location Sharing OFF'}
              </Text>
              <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 4 }}>
                {locationSharing 
                  ? 'Your circle can see where you are in real-time.'
                  : 'Your circle cannot see your location.'
                }
              </Text>
            </View>
            <Toggle
              value={locationSharing}
              onValueChange={setLocationSharing}
              style={{ marginLeft: 12 }}
            />
          </View>
        </Card>

        <Card style={{ marginBottom: 22 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 8 }}>
            Benefits of sharing location:
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • Your circle can see if you're safe and where you are
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • Faster response in emergencies
          </Text>
          <Text variant="small" color={t.colors.inkSoft}>
            • Get help faster when needed
          </Text>
        </Card>

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy}>
          {busy ? 'Saving…' : 'Next'}
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
