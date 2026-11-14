import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createSessionStorage } from './session-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url &&
  /^https:\/\//.test(url) &&
  !url.includes('YOUR_PROJECT') &&
  key &&
  !key.includes('YOUR_'),
);
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        storage:
          Platform.OS === 'web'
            ? undefined
            : createSessionStorage({
                getItemAsync: SecureStore.getItemAsync,
                deleteItemAsync: SecureStore.deleteItemAsync,
                setItemAsync: (key, value) =>
                  SecureStore.setItemAsync(key, value, {
                    keychainAccessible:
                      SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                  }),
              }),
        persistSession: Platform.OS !== 'web',
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export function client() {
  if (!supabase)
    throw new Error('Supabase is not configured. Follow docs/SETUP.md.');
  return supabase;
}
