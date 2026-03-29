/**
 * Root layout for the Pulse Expo Router app.
 * Configures navigation stack and Supabase auth session listener.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-url-polyfill/auto';

/** Root navigation stack with auth and app route groups. */
export default function RootLayout(): React.ReactElement {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
