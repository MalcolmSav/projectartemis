import React, { useState } from 'react';
import { View, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, Eyebrow, PillButton, Avatar, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { pickAndUploadAvatar } from '../lib/avatar';
import { OnboardingCircleStep } from './OnboardingCircleStep';

import { OnboardingFakeCallStep } from './OnboardingFakeCallStep';
import { OnboardingCalendarStep } from './OnboardingCalendarStep';
import { OnboardingWellnessStep } from './OnboardingWellnessStep';
import { OnboardingTripModeStep } from './OnboardingTripModeStep';
import { OnboardingCompleteStep } from './OnboardingCompleteStep';

type EmergencyContact = {
  name: string;
  contactInfo: string;
};

type OnboardingStep = 'intro' | 'circle' | 'emergency' | 'wellness' | 'calendar' | 'fakecall' | 'tripmode' | 'complete';

export function OnboardingScreen() {
  const t = useTheme();
  const { profile, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPickAvatar = async () => {
    if (!profile) return;
    setUploading(true);
    setErr(null);
    const res = await pickAndUploadAvatar(profile.id);
    setUploading(false);
    if (res.error) setErr(res.error);
    else if (res.url) await refreshProfile();
  };

  const addEmergencyContact = () => {
    setEmergencyContacts([...emergencyContacts, { name: '', contactInfo: '' }]);
  };

  const removeEmergencyContact = (index: number) => {
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  };

  const updateEmergencyContact = (index: number, field: 'name' | 'contactInfo', value: string) => {
    const updated = [...emergencyContacts];
    updated[index] = { ...updated[index], [field]: value };
    setEmergencyContacts(updated);
  };

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    setErr(null);

    try {
      // Update profile to mark emergency contacts as complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarded: false })  // Keep as false, will be true when all steps done
        .eq('id', profile.id);

      if (profileError) {
        setErr(profileError.message);
        setBusy(false);
        return;
      }

      // Save emergency contacts
      if (emergencyContacts.length > 0) {
        const contactsToInsert = emergencyContacts
          .filter(c => c.name.trim() && c.contactInfo.trim())
          .map((c, index) => ({
            user_id: profile.id,
            name: c.name.trim(),
            contact_info: c.contactInfo.trim(),
            priority: index + 1,
          }));

        if (contactsToInsert.length > 0) {
          const { error: contactsError } = await supabase
            .from('emergency_contacts')
            .insert(contactsToInsert);

          if (contactsError) {
            setErr(contactsError.message);
            setBusy(false);
            return;
          }
        }
      }

      await refreshProfile();
      setStep('wellness');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }

    setBusy(false);
  };

  return (
    <>
      {step === 'intro' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.pageH, paddingTop: 90 }} keyboardShouldPersistTaps="handled">
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Eyebrow style={{ marginBottom: 6 }}>WELCOME TO ARTEMIS</Eyebrow>
              <Text variant="displayH1" style={{ marginBottom: 14 }}>
                A softer way to feel{' '}
                <Text variant="displayH1" italic accent>
                  safer.
                </Text>
              </Text>
              <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
                Artemis helps you stay connected with trusted people when you are out, traveling, or need a quiet exit.
                Your circle can use Artemis features with you: location sharing, wellness checks, calendar visibility,
                trip mode, and safety follow-ups. Emergency contacts are separate people others can call if you are
                unavailable.
              </Text>

              <Card style={{ marginBottom: 24 }}>
                <View style={{ gap: 12 }}>
                  <Text variant="body" weight="semibold">
                    During setup you will:
                  </Text>
                  <Text variant="small" color={t.colors.inkSoft}>
                    Build your circle of trusted people.
                  </Text>
                  <Text variant="small" color={t.colors.inkSoft}>
                    Add emergency contacts, like a partner or parent, for others to reach if you are unavailable.
                  </Text>
                  <Text variant="small" color={t.colors.inkSoft}>
                    Learn how wellness checks work.
                  </Text>
                  <Text variant="small" color={t.colors.inkSoft}>
                    Add moments where you may be hard to reach.
                  </Text>
                  <Text variant="small" color={t.colors.inkSoft}>
                    Choose quick safety tools like fake call and trip mode.
                  </Text>
                </View>
              </Card>

              <PillButton size="lg" block onPress={() => setStep('circle')}>
                Start setup
              </PillButton>

              <PillButton variant="ghost" block style={{ marginTop: 8 }} onPress={signOut}>
                Sign out
              </PillButton>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : step === 'emergency' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
        >
          <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', marginBottom: 22 }}>
              <Pressable onPress={onPickAvatar} disabled={uploading}>
                <Avatar name={profile?.email || '?'} size={92} ring photoUri={profile?.avatar_url ?? undefined} />
              </Pressable>
              <Text variant="small" weight="semibold" color={t.colors.gold700} style={{ marginTop: 10 }}>
                {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Add a photo'}
              </Text>
            </View>

            <Eyebrow style={{ marginBottom: 6 }}>WELCOME</Eyebrow>
            <Text variant="displayH1" style={{ marginBottom: 8 }}>
              Add your{' '}
              <Text variant="displayH1" italic accent>
                emergency contacts.
              </Text>
            </Text>
            <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
              These are not your Artemis circle. They are people someone else can reach out to if you are hard to reach,
              like a partner, mother, or close family member. List them by priority.
            </Text>

            {emergencyContacts.map((contact, index) => (
              <View key={index} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: t.colors.hairline }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Eyebrow>CONTACT {index + 1}</Eyebrow>
                  {emergencyContacts.length > 1 && (
                    <Pressable onPress={() => removeEmergencyContact(index)}>
                      <Text variant="small" color={t.colors.crimson} weight="semibold">
                        Remove
                      </Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  value={contact.name}
                  onChangeText={(val) => updateEmergencyContact(index, 'name', val)}
                  placeholder="Name or relation (e.g. Mom)"
                  placeholderTextColor={t.colors.inkMute}
                  autoCapitalize="words"
                  style={inputStyle(t)}
                />
                <TextInput
                  value={contact.contactInfo}
                  onChangeText={(val) => updateEmergencyContact(index, 'contactInfo', val)}
                  placeholder="Phone or contact info"
                  placeholderTextColor={t.colors.inkMute}
                  keyboardType="phone-pad"
                  style={inputStyle(t)}
                />
              </View>
            ))}

            <PillButton variant="ghost" block onPress={addEmergencyContact} style={{ marginBottom: 18 }}>
              <Text variant="small" weight="semibold" color={t.colors.gold700}>
                + Add emergency contact
              </Text>
            </PillButton>

            {err && (
              <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
                {err}
              </Text>
            )}

            <PillButton size="lg" block onPress={save} disabled={busy}>
              {busy ? 'Saving…' : 'Next'}
            </PillButton>

            <PillButton variant="ghost" block style={{ marginTop: 8 }} onPress={signOut}>
              Sign out
            </PillButton>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : step === 'circle' ? (
        <OnboardingCircleStep 
          onComplete={() => setStep('emergency')} 
        />
      ) : step === 'wellness' ? (
        <OnboardingWellnessStep
          onComplete={() => setStep('calendar')}
        />
      ) : step === 'calendar' ? (
        <OnboardingCalendarStep
          onComplete={() => setStep('fakecall')}
        />
      ) : step === 'fakecall' ? (
        <OnboardingFakeCallStep 
          onComplete={() => setStep('tripmode')} 
        />
      ) : step === 'tripmode' ? (
        <OnboardingTripModeStep 
          onComplete={() => setStep('complete')} 
        />
      ) : step === 'complete' ? (
        <OnboardingCompleteStep 
          onComplete={() => {
            // Onboarding is complete, user will be auto-logged in and redirected
            refreshProfile();
          }} 
        />
      ) : null}
    </>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: t.colors.parchment,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: t.type.body,
    color: t.colors.ink,
    borderWidth: 1,
    borderColor: t.colors.hairline,
    marginBottom: 14,
  };
}
