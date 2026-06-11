import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Did you create a .env file at the project root and restart Expo?',
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
