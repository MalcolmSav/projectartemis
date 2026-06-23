import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// In development, warn loudly. In production a missing key means nothing will
// work, but at least the app renders so the error boundary can show it.
if (__DEV__ && (!url || !anon)) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check your .env file.');
}

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  onboarded: boolean;
  fake_call_tutorial_completed: boolean | null;
  trip_mode_tutorial_completed: boolean | null;
  created_at: string;
};

export type CircleRow = {
  id: string;
  owner_id: string;
  member_id: string;
  relation: string | null;
  verified: boolean;
  created_at: string;
};

export type InviteRow = {
  id: string;
  from_user: string;
  to_email: string;
  relation: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};
