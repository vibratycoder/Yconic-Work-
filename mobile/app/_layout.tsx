/**
 * Root layout for the Sana Health Expo Router app.
 *
 * Listens for Supabase auth state changes and redirects users to the
 * appropriate route group:
 *   - Authenticated  → (app)/home
 *   - Unauthenticated → (auth)/sign-in
 *
 * A loading state prevents any screen from flashing before the initial
 * session is resolved.
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-url-polyfill/auto';
import { supabase } from '../lib/supabase';

/** Root navigation stack with auth and app route groups. */
export default function RootLayout(): React.ReactElement {
  const [initialised, setInitialised] = useState<boolean>(false);

  useEffect(() => {
    // Listen for all auth state changes (INITIAL_SESSION fires on mount).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!initialised) setInitialised(true);
        if (session) {
          router.replace('/(app)/home');
        } else {
          router.replace('/(auth)/sign-in');
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show a spinner until the initial session check resolves.
  if (!initialised) {
    return (
      <View style={{ flex: 1, backgroundColor: '#04090f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
