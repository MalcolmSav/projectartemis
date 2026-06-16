import React, { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, Eyebrow, PillButton } from '../components';
import { ArtemisMark } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';

export function ResetPasswordScreen() {
  const t = useTheme();
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr(null);
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setErr(res.error);
    else setDone(true);
  };

  const input = {
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.pageH, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <ArtemisMark size={56} moonColor={t.colors.forest700} />
          <Text style={{ fontFamily: t.type.display, fontSize: 32, marginTop: 12 }}>Artemis</Text>
        </View>

        {done ? (
          <View style={{ alignItems: 'center', paddingTop: 24 }}>
            <Text variant="displayH1" style={{ marginBottom: 10, textAlign: 'center' }}>
              Password{' '}
              <Text variant="displayH1" italic accent>updated.</Text>
            </Text>
            <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 32, textAlign: 'center' }}>
              You are now signed in with your new password.
            </Text>
          </View>
        ) : (
          <>
            <Text variant="displayH1" style={{ marginBottom: 8 }}>
              New{' '}
              <Text variant="displayH1" italic accent>password.</Text>
            </Text>
            <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 24 }}>
              Choose a new password for your account.
            </Text>

            <Eyebrow style={{ marginBottom: 6 }}>NEW PASSWORD</Eyebrow>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={t.colors.inkMute}
              secureTextEntry
              style={input}
            />

            <Eyebrow style={{ marginBottom: 6 }}>CONFIRM PASSWORD</Eyebrow>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Same as above"
              placeholderTextColor={t.colors.inkMute}
              secureTextEntry
              style={input}
            />

            {err && (
              <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
                {err}
              </Text>
            )}

            <PillButton
              size="lg"
              block
              onPress={submit}
              disabled={busy || !password || !confirm}
            >
              {busy ? 'Saving…' : 'Set new password'}
            </PillButton>

            <PillButton variant="ghost" block style={{ marginTop: 8 }} onPress={signOut}>
              Cancel
            </PillButton>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
