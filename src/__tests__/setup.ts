/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */
// Screen-test environment (jest-expo). Only platform plumbing is mocked here; each test mocks the data layer it
// needs and asserts on what the user sees.
// Reanimated 4's own mock needs the native worklets runtime; ui.tsx only uses these five, so animations are instant.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: unknown) => ({ value, set(v: unknown) { this.value = v; }, get() { return this.value; } }),
    useAnimatedStyle: (f: () => object) => f(),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
  };
});

// Expo Router: no navigator in a screen test. Focus effects run like a normal effect; navigation is recorded.
jest.mock('expo-router', () => {
  const React = require('react');
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    router,
    useRouter: () => router,
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
    Link: ({ children }: { children: unknown }) => children,
  };
});

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-sqlite/localStorage/install', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k), clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; }, // as expo-sqlite's Storage
  };
  return {};
});
