import 'expo-sqlite/localStorage/install';

import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DataProvider, useData } from '@/lib/data';
import { font } from '@/theme/tokens';
import { Button, C, Loading, Screen, T } from '@/ui';

// Keep the splash screen up until the design fonts are ready (or have failed: then system fonts are used).
SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.accent, border: C.border } };
const pushed = { headerShown: true, headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerBackButtonDisplayMode: 'minimal' as const, headerTitleStyle: { fontFamily: font.bodyBold } };

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
        {/* Escape hatch: if a saved unfinished workout is what crashes, retrying alone would loop. */}
        <Button kind="ghost" title="Discard the unfinished workout" onPress={() => { localStorage.removeItem('draft_workout'); retry(); }} />
      </Screen>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BricolageGrotesque_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const fontsDone = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsDone) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone]);
  if (!fontsDone) return null; // splash screen still showing
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <DataProvider>
        <Routes />
      </DataProvider>
    </ThemeProvider>
  );
}
