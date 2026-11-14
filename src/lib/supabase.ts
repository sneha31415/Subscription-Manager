import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

// Strip any trailing slash or accidental /rest/v1 path from the URL
const url = rawUrl.replace(/\/+rest\/v1\/?$/i, '').replace(/\/+$/, '');

/** False until the person fills in their .env — the app then shows a setup screen instead of crashing. */
export const isSupabaseConfigured = Boolean(url) && Boolean(anonKey) && !url.includes('YOUR_PROJECT_REF');

// Only the public "anon" key ever ships in the app. Security comes from Row Level Security in the database.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresh tokens only while the app is in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
