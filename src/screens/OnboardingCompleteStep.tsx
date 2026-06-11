import React from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';

export function OnboardingCompleteStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const { profile, refreshProfile } = useAuth();

  const finalize = async () => {
    if (!profile) return;
    
    // Mark onboarding as complete
    await supabase
      .from('profiles')
      .update({ onboarded: true })
      .eq('id', profile.id);
    
    await refreshProfile();
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

        <Eyebrow style={{ marginBottom: 6, textAlign: 'center' }}>YOU'RE ALL SET!</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8, textAlign: 'center' }}>
          Welcome to your{' '}
          <Text variant="displayH1" italic accent>
            circle.
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 32, textAlign: 'center' }}>
          Your circle is ready to keep you safe and connected. You now have fake call and trip mode for extra safety.
        </Text>

        <Card style={{ marginBottom: 32, width: '100%' }}>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>??</Text>
              <Text variant="body" weight="semibold">Circle members added</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>?</Text>
              <Text variant="body" weight="semibold">Emergency contacts saved</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>?</Text>
              <Text variant="body" weight="semibold">Wellness checks explained</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>?</Text>
              <Text variant="body" weight="semibold">Hard-to-reach events reviewed</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>??</Text>
              <Text variant="body" weight="semibold">Fake call ready</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>??</Text>
              <Text variant="body" weight="semibold">Trip mode configured</Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 32, width: '100%' }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 8 }}>
            What's next?
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • Use fake call to exit uncomfortable situations
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • Start trip mode when traveling alone or at night
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            • Add more trusted people to your circle anytime
          </Text>
          <Text variant="small" color={t.colors.inkSoft}>
            • Adjust settings in your Profile as needed
          </Text>
        </Card>

        <PillButton size="lg" block onPress={finalize}>
          Get Started
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

