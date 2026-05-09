import React, { useState } from 'react';
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Eyebrow, PillButton } from '../components';
import { ArtemisMark } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const t = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    const res =
      mode === 'signIn' ? await signIn(email, password) : await signUp(email, password, name || email.split('@')[0]);
    setBusy(false);
    if (res.error) setErr(res.error);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.pageH, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <ArtemisMark size={56} moonColor={t.colors.forest700} />
          <Text style={{ fontFamily: t.type.display, fontSize: 32, marginTop: 12 }}>Artemis</Text>
          <Text style={{ fontFamily: t.type.displayItalic, fontSize: 14, color: t.colors.inkMute, marginTop: 2 }}>
            she who watches
          </Text>
        </View>

        <Text variant="displayH1" style={{ marginBottom: 18 }}>
          {mode === 'signIn' ? (
            <>
              Welcome{' '}
              <Text variant="displayH1" italic accent>
                back.
              </Text>
            </>
          ) : (
            <>
              Make your{' '}
              <Text variant="displayH1" italic accent>
                circle.
              </Text>
            </>
          )}
        </Text>

        {mode === 'signUp' && (
          <>
            <Eyebrow style={{ marginBottom: 6 }}>NAME</Eyebrow>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={t.colors.inkMute}
              style={inputStyle(t)}
              autoCapitalize="words"
            />
          </>
        )}

        <Eyebrow style={{ marginBottom: 6 }}>EMAIL</Eyebrow>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={t.colors.inkMute}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={inputStyle(t)}
        />

        <Eyebrow style={{ marginBottom: 6 }}>PASSWORD</Eyebrow>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={t.colors.inkMute}
          secureTextEntry
          style={inputStyle(t)}
        />

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={submit} disabled={busy || !email || !password}>
          {busy ? 'Working…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </PillButton>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text variant="small" color={t.colors.inkSoft}>
            {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
            <Text variant="small" weight="semibold" color={t.colors.forest700}>
              {mode === 'signIn' ? 'Create one' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>

        {mode === 'signIn' && (
          <Pressable
            onPress={async () => {
              if (!email) {
                setErr('Enter your email first');
                return;
              }
              setBusy(true);
              const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
              setBusy(false);
              setErr(error ? error.message : null);
              if (!error) setErr('Reset link sent — check your email.');
            }}
            style={{ marginTop: 12, alignItems: 'center' }}
          >
            <Text variant="small" color={t.colors.gold700} weight="semibold">
              Forgot password?
            </Text>
          </Pressable>
        )}
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
