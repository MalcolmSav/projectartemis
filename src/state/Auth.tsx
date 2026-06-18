import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

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
      else setIsRecovery(false);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
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
