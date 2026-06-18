import React, { useState, useEffect } from 'react';
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Text, Eyebrow, PillButton } from '../components';
import { ArtemisMark, GoogleLogo } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const t = useTheme();
  const { signIn, signUp, signInWithGoogleToken, signInWithAppleToken } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [_request, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (!idToken) {
        setErr('Google sign-in failed — no token returned.');
        setBusy(false);
        return;
      }
      signInWithGoogleToken(idToken).then((res) => {
        setBusy(false);
        if (res.error) setErr(res.error);
      });
    } else if (googleResponse?.type === 'error') {
      setErr('Google sign-in was cancelled or failed.');
      setBusy(false);
    } else if (googleResponse?.type === 'dismiss') {
      setBusy(false);
    }
  }, [googleResponse]);

  const handleGooglePress = async () => {
    setErr(null);
    setBusy(true);
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setErr(error.message);
        setBusy(false);
      }
    } else {
      promptGoogleAsync();
    }
  };

  const handleApplePress = async () => {
    setErr(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setErr('Apple sign-in failed — no token returned.');
        return;
      }
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : null;
      setBusy(true);
      const res = await signInWithAppleToken(credential.identityToken, fullName);
      setBusy(false);
      if (res.error) setErr(res.error);
    } catch (e: any) {
      // User cancel throws ERR_REQUEST_CANCELED — ignore quietly.
      if (e?.code !== 'ERR_REQUEST_CANCELED') setErr('Apple sign-in was cancelled or failed.');
      setBusy(false);
    }
  };

  const submit = async () => {
    setErr(null);
    setMessage(null);
    setBusy(true);
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();

    if (mode === 'signUp') {
      if (!trimmedUsername) {
        setErr('Choose a username.');
        setBusy(false);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        setErr('Username can only include letters, numbers, and underscores.');
        setBusy(false);
        return;
      }
      if (!trimmedName) {
        setErr('Enter your full name.');
        setBusy(false);
        return;
      }
      const { data: existing, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', trimmedUsername)
        .maybeSingle();
      if (lookupError) {
        setErr('Unable to verify username availability.');
        setBusy(false);
        return;
      }
      if (existing) {
        setErr('That username is already taken.');
        setBusy(false);
        return;
      }
    }

    const res =
      mode === 'signIn'
        ? await signIn(trimmedEmail, trimmedPassword)
        : await signUp(trimmedEmail, trimmedPassword, trimmedName, trimmedUsername);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.pageH, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <ArtemisMark size={56} moonColor={t.colors.forest700} />
          <Text style={{ fontFamily: t.type.display, fontSize: 32, lineHeight: 42, marginTop: 12 }}>Artemis</Text>
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

        <PillButton
          variant="secondary"
          size="lg"
          block
          disabled={busy}
          iconLeft={<GoogleLogo size={18} />}
          onPress={handleGooglePress}
          style={{ marginBottom: 12 }}
        >
          Continue with Google
        </PillButton>

        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              t.mode === 'night'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={999}
            style={{ height: 52, marginBottom: 20 }}
            onPress={handleApplePress}
          />
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.hairline }} />
          <Text variant="small" color={t.colors.inkMute}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.hairline }} />
        </View>

        {mode === 'signUp' && (
          <>
            <Eyebrow style={{ marginBottom: 6 }}>USERNAME</Eyebrow>
            <Text variant="small" color={t.colors.inkMute} style={{ marginBottom: 10 }}>
              How others will find and add you
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={t.colors.inkMute}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle(t)}
            />
            <Eyebrow style={{ marginBottom: 6, marginTop: 18 }}>FULL NAME</Eyebrow>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First and last name"
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

        {err ? (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        ) : message ? (
          <Text variant="small" color={t.colors.forest700} style={{ marginBottom: 10 }}>
            {message}
          </Text>
        ) : null}

        <PillButton
          size="lg"
          block
          onPress={submit}
          disabled={
            busy ||
            !email.trim() ||
            !password.trim() ||
            (mode === 'signUp' && (!username.trim() || !name.trim()))
          }
        >
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
              const trimmedEmail = email.trim();
              const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
              setBusy(false);
              if (error) {
                setErr(error.message);
                setMessage(null);
              } else {
                setErr(null);
                setMessage('Reset link sent — check your email.');
              }
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
