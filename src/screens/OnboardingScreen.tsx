import React, { useState } from 'react';
import { View, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, Eyebrow, PillButton, Avatar } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { pickAndUploadAvatar } from '../lib/avatar';

export function OnboardingScreen() {
  const t = useTheme();
  const { profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
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

  const save = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        onboarded: true,
      })
      .eq('id', profile.id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshProfile();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <Pressable onPress={onPickAvatar} disabled={uploading}>
            <Avatar name={name || profile?.email || '?'} size={92} ring photoUri={profile?.avatar_url ?? undefined} />
          </Pressable>
          <Text variant="small" weight="semibold" color={t.colors.gold700} style={{ marginTop: 10 }}>
            {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Add a photo'}
          </Text>
        </View>

        <Eyebrow style={{ marginBottom: 6 }}>WELCOME</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          Tell us who's{' '}
          <Text variant="displayH1" italic accent>
            watching.
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          This is what your circle sees. You can change anything later in Profile.
        </Text>

        <Eyebrow style={{ marginBottom: 6 }}>NAME *</Eyebrow>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Elin"
          placeholderTextColor={t.colors.inkMute}
          autoCapitalize="words"
          style={inputStyle(t)}
        />

        <Eyebrow style={{ marginBottom: 6 }}>PHONE (OPTIONAL)</Eyebrow>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="070-555 23 18"
          placeholderTextColor={t.colors.inkMute}
          keyboardType="phone-pad"
          style={inputStyle(t)}
        />

        <Eyebrow style={{ marginBottom: 6 }}>SHORT BIO (OPTIONAL)</Eyebrow>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Where you usually are. What you do."
          placeholderTextColor={t.colors.inkMute}
          multiline
          style={[inputStyle(t), { minHeight: 80, borderRadius: t.radii.md, paddingTop: 14 }]}
        />

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : 'Continue'}
        </PillButton>

        <PillButton variant="ghost" block style={{ marginTop: 8 }} onPress={signOut}>
          Sign out
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
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
