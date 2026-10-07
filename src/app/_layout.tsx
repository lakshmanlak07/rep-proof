import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { DataProvider, useData } from '@/lib/data';
import { Button, C, Loading, Screen, T } from '@/ui';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.accent, border: C.border } };
const pushed = { headerShown: true, headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerBackButtonDisplayMode: 'minimal' as const, headerTitleStyle: { fontWeight: '700' as const } };

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
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !ready}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ ...pushed, title: 'Settings' }} />
        <Stack.Screen name="food" options={{ ...pushed, title: 'Add food' }} />
        <Stack.Screen name="science" options={{ ...pushed, title: 'The science' }} />
        <Stack.Screen name="feedback" options={{ ...pushed, title: 'Feedback' }} />
        <Stack.Screen name="training" options={{ ...pushed, title: 'Training profile' }} />
        <Stack.Screen name="volume" options={{ ...pushed, title: 'Weekly volume' }} />
        <Stack.Screen name="insights" options={{ ...pushed, title: 'Insights' }} />
        <Stack.Screen name="library" options={{ ...pushed, title: 'Exercise library' }} />
        <Stack.Screen name="exercise/[id]" options={{ ...pushed, title: '' }} />
        <Stack.Screen name="workout-day/[index]" options={{ ...pushed, title: '' }} />
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

// Any crash below the root shows this instead of a blank screen.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <ThemeProvider value={theme}>
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
          <T size="lg">Something went wrong</T>
          <T muted>Your logged workouts are safe. An unfinished workout stays saved on this phone.</T>
        </View>
        <Button kind="primary" title="Try again" onPress={retry} />
      </Screen>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <DataProvider>
        <Routes />
      </DataProvider>
    </ThemeProvider>
  );
}
