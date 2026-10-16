// Root navigator guards, with the real router: a blocked route must fall back to the right screen for the
// auth state (welcome / onboarding), never to the always-available privacy page.
/* eslint-disable @typescript-eslint/no-require-imports -- modules must load after the unmock */
import { Text } from 'react-native';

jest.unmock('expo-router');
const { renderRouter } = require('expo-router/testing-library');

const mockData = { session: null as object | null, profile: null as object | null, program: null as object | null };
jest.mock('@/lib/data', () => ({
  DataProvider: ({ children }: { children: unknown }) => children,
  useData: () => ({ ...mockData, loading: false, failed: false, refresh: jest.fn() }),
}));
jest.mock('@/lib/crash', () => ({ installCrashReporting: jest.fn(), reportError: jest.fn(), setCrashRoute: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: async () => {}, hideAsync: async () => {} }));

const RootLayout = require('@/app/_layout').default;
const stub = (name: string) => function Stub() { return <Text>{name}</Text>; };
const routes = {
  _layout: RootLayout,
  index: stub('welcome'), 'sign-in': stub('sign-in'), privacy: stub('privacy'), onboarding: stub('onboarding'), library: stub('library'),
};

test('signed out, a protected deep link lands on the welcome screen, not the privacy page', async () => {
  Object.assign(mockData, { session: null, profile: null, program: null });
  const r = await renderRouter(routes, { initialUrl: '/library' });
  expect(await r.findByText('welcome')).toBeTruthy();
  expect(r.queryByText('privacy')).toBeNull();
});

test('signed in without a profile, a blocked route lands on onboarding', async () => {
  Object.assign(mockData, { session: { user: { id: 'A' } }, profile: null, program: null });
  const r = await renderRouter(routes, { initialUrl: '/sign-in' });
  expect(await r.findByText('onboarding')).toBeTruthy();
});

test('privacy stays readable while signed out', async () => {
  Object.assign(mockData, { session: null, profile: null, program: null });
  const r = await renderRouter(routes, { initialUrl: '/privacy' });
  expect(await r.findByText('privacy')).toBeTruthy();
});
