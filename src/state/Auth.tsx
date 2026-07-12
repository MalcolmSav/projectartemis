import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

/** Parse Supabase auth tokens out of a deep link like
 *  artemis://reset-password#access_token=…&refresh_token=…&type=recovery */
function parseAuthFragment(url: string): { access_token: string; refresh_token: string; type: string | null } | null {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return null;
  const params = new URLSearchParams(url.slice(hashIdx + 1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token, type: params.get('type') };
}

interface AuthValue {
  loading: boolean;
  profileLoading: boolean;
  isRecovery: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string, username: string) => Promise<{ error?: string }>;
  signInWithGoogleToken: (idToken: string) => Promise<{ error?: string }>;
  signInWithAppleToken: (idToken: string, fullName?: string | null) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      else if (event === 'SIGNED_OUT') setIsRecovery(false);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Deep link handler: the password-reset email redirects to
  // artemis://reset-password#access_token=…&type=recovery. Exchange the tokens
  // for a session, then show the ResetPasswordScreen via isRecovery.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const tokens = parseAuthFragment(url);
      if (!tokens) return;
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (!error && tokens.type === 'recovery') setIsRecovery(true);
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!cancelled) {
        setProfile(data ?? null);
        setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = async () => {
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  };

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  };

  const signUp: AuthValue['signUp'] = async (email, password, name, username) => {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: trimmedName, username: trimmedUsername } },
    });
    return error ? { error: error.message } : {};
  };

  const updatePassword: AuthValue['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setIsRecovery(false);
    return error ? { error: error.message } : {};
  };

  const signInWithGoogleToken: AuthValue['signInWithGoogleToken'] = async (idToken) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    return error ? { error: error.message } : {};
  };

  const signInWithAppleToken: AuthValue['signInWithAppleToken'] = async (idToken, fullName) => {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: idToken });
    if (error) return { error: error.message };
    // Apple returns the name only on the first authorization — persist it if the
    // profile has none yet, so the user isn't nameless.
    const name = fullName?.trim();
    if (name && data.user) {
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', data.user.id).maybeSingle();
      if (!prof?.name) await supabase.from('profiles').update({ name }).eq('id', data.user.id);
    }
    return {};
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
      setProfile(null);
    }
  };

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      profileLoading,
      isRecovery,
      session,
      user: session?.user ?? null,
      profile,
      signIn,
      signUp,
      signInWithGoogleToken,
      signInWithAppleToken,
      updatePassword,
      signOut,
      refreshProfile,
    }),
    [loading, profileLoading, isRecovery, session, profile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
