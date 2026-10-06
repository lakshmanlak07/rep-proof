import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { chunkedStore } from './chunked';

// Login session: iOS Keychain / Android Keystore, readable only by this app on this device.
// Sessions saved by earlier versions in plain SQLite storage are moved over on first read, then erased.
// Web (development only) has no secure store and keeps the browser's storage.
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const freshInstall = localStorage.getItem('installed') === null; // SQLite storage is wiped on uninstall; the Keychain is not
localStorage.setItem('installed', '1');
const storage = Platform.OS === 'web' ? localStorage : chunkedStore({
  get: (k) => SecureStore.getItemAsync(k, opts),
  set: (k, v) => SecureStore.setItemAsync(k, v, opts),
  del: (k) => SecureStore.deleteItemAsync(k, opts),
}, localStorage, freshInstall);

// Values come from .env (see .env.example). Publishable key only, never the secret key.
export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// However the session ends (sign-out, expiry, revoked elsewhere), drop the unsaved workout from the
// device: it holds that person's check-in answers.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') ['draft_workout', 'missed_choice'].forEach((k) => localStorage.removeItem(k));
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
