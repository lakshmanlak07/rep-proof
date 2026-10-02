import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { DataProvider, useData } from '@/lib/data';
import { Button, C, Loading, Screen, T } from '@/ui';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.accent, border: C.border } };

function Routes() {
  const { session, profile, program, loading, failed, refresh } = useData();
  if (loading) return <Loading />;
  if (failed && session && !profile) return <Offline onRetry={refresh} />;
  const ready = !!session && !!profile && !!program;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="index" />
        <Stack.Screen name="age" />
        <Stack.Screen name="disclaimer" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !ready}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="food" options={{ headerShown: true, title: 'Add food' }} />
        <Stack.Screen name="science" options={{ headerShown: true, title: 'The science' }} />
      </Stack.Protected>
    </Stack>
  );
}

function Offline({ onRetry }: { onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <T size="lg">{"Can't reach RepProof"}</T>
        <T muted>Check your connection and try again. Nothing has been lost.</T>
      </View>
      <Button kind="primary" title="Try again" loading={busy} onPress={async () => { setBusy(true); await onRetry(); setBusy(false); }} />
    </Screen>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <DataProvider>
        <Routes />
      </DataProvider>
    </ThemeProvider>
  );
}
