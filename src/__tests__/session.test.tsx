// Session lifecycle in DataProvider: restore, sign-out, expired session, account switching without cached-data
// leaks, network failure is never "no profile", and a deleted account is signed out instead of trapped.
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { buildProgram } from '@/engine/plan.ts';
import { DataProvider, useData } from '@/lib/data';

type Row = Record<string, unknown>;
const profileOf = (id: string) => ({ id, birth_year: 1990, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'beginner', goal: 'muscle',
  setup: 'home', days: 3, session_minutes: 45, bodyweight: 70, height_cm: 170, nutrition_phase: 'maintain', sex: null, unit: 'kg', avoid: [], deload_until: null });
const programOf = (id: string) => ({ id: `prog-${id}`, split: 'full_body', next_day: 0,
  plan: buildProgram({ experience: 'beginner', goal: 'muscle', setup: 'home', days: 3, sessionMinutes: 45, unit: 'kg', avoid: [] }) });
const sessionOf = (id: string) => ({ user: { id, email: `${id}@example.invalid` } });

// Server state, keyed by user (RLS returns only the signed-in user's rows).
const mockDb: { user: string | null; profiles: Record<string, Row>; programs: Record<string, Row>; offline: boolean; rejected: boolean; gate: Promise<void> | null; userThrows: boolean } =
  { user: null, profiles: {}, programs: {}, offline: false, rejected: false, gate: null, userThrows: false };
let mockAuthCb: (event: string, s: unknown) => void = () => {};
const mockSignOut = jest.fn(async () => { mockDb.user = null; mockAuthCb('SIGNED_OUT', null); return { error: null }; });
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: mockDb.user ? sessionOf(mockDb.user) : null } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => { mockAuthCb = cb; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
      getUser: async () => (mockDb.userThrows ? Promise.reject(new Error('keystore unavailable')) : mockDb.rejected ? { data: { user: null }, error: { status: 403, code: 'user_not_found', message: 'User from sub claim in JWT does not exist' } } : { data: { user: {} }, error: null }),
      signOut: (...a: unknown[]) => mockSignOut(...(a as [])),
    },
    from: (table: string) => {
      const q = {
        select: () => q, eq: () => q,
        maybeSingle: async () => {
          if (mockDb.gate) await mockDb.gate;
          if (mockDb.offline) return { data: null, error: { message: 'Network request failed' } };
          const u = mockDb.user;
          return { data: u ? (table === 'profiles' ? mockDb.profiles[u] : mockDb.programs[u]) ?? null : null, error: null };
        },
      };
      return q;
    },
    rpc: async () => ({ error: null }),
  },
}));

function Probe() {
  const { session, profile, program, loading, failed } = useData();
  return <Text>{loading ? 'loading' : `session=${session?.user.id ?? 'none'} profile=${profile?.id ?? 'none'} program=${program?.id ?? 'none'} failed=${failed}`}</Text>;
}
const state = () => screen.getByText(/session=|loading/).props.children as string;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockDb, { user: null, profiles: { A: profileOf('A'), B: profileOf('B') }, programs: { A: programOf('A'), B: programOf('B') }, offline: false, rejected: false, gate: null, userThrows: false });
});

test('a stored session is restored with that account\'s profile and plan', async () => {
  mockDb.user = 'A';
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  expect(state()).toBe('session=A profile=A program=prog-A failed=false');
});

test('signing out (or an expired session ending) clears the profile and plan', async () => {
  mockDb.user = 'A';
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  await act(async () => { mockDb.user = null; mockAuthCb('SIGNED_OUT', null); });
  expect(state()).toBe('session=none profile=none program=none failed=false');
});

test('switching accounts never shows the previous account\'s data, even when the new load fails', async () => {
  mockDb.user = 'A';
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  // B signs in while offline: A's profile and plan must not stay on screen under B's session.
  await act(async () => { mockDb.user = 'B'; mockDb.offline = true; mockAuthCb('SIGNED_IN', sessionOf('B')); });
  expect(state()).toBe('session=B profile=none program=none failed=true');
  // Back online: B's own data loads.
  mockDb.offline = false;
  await act(async () => { mockAuthCb('SIGNED_IN', sessionOf('B')); });
  expect(state()).toBe('session=B profile=B program=prog-B failed=false');
});

test('a network failure at start is "failed", not "no profile" (which would send a user to onboarding)', async () => {
  mockDb.user = 'A';
  mockDb.offline = true;
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  expect(state()).toBe('session=A profile=none program=none failed=true');
});

test('an account deleted on the server is signed out on this device instead of being sent to onboarding', async () => {
  mockDb.user = 'A';
  delete mockDb.profiles.A;
  delete mockDb.programs.A;
  mockDb.rejected = true;
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(state()).toBe('session=none profile=none program=none failed=false');
});

test('an unreadable stored session (getSession rejects) ends at sign-in, not an endless spinner', async () => {
  const { supabase } = jest.requireMock('@/lib/supabase') as { supabase: { auth: { getSession: () => Promise<unknown> } } };
  const original = supabase.auth.getSession;
  supabase.auth.getSession = () => Promise.reject(new Error('keystore invalidated'));
  try {
    await render(<DataProvider><Probe /></DataProvider>);
    await act(async () => {});
    expect(state()).toBe('session=none profile=none program=none failed=false');
  } finally {
    supabase.auth.getSession = original;
  }
});

test('an expired token that cannot refresh offline is "failed" (Offline screen), never a sign-out', async () => {
  const { supabase } = jest.requireMock('@/lib/supabase') as { supabase: { auth: { getSession: () => Promise<unknown> } } };
  const original = supabase.auth.getSession;
  supabase.auth.getSession = () => Promise.resolve({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } });
  try {
    await render(<DataProvider><Probe /></DataProvider>);
    await act(async () => {});
    expect(state()).toBe('session=none profile=none program=none failed=true');
    expect(mockSignOut).not.toHaveBeenCalled();
  } finally {
    supabase.auth.getSession = original;
  }
});

test('signing in shows loading until that account\'s profile arrives, never onboarding first', async () => {
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  expect(state()).toBe('session=none profile=none program=none failed=false');
  let release!: () => void;
  mockDb.gate = new Promise((r) => { release = r; });
  await act(async () => { mockDb.user = 'A'; mockAuthCb('SIGNED_IN', sessionOf('A')); });
  expect(state()).toBe('loading'); // not "session=A profile=none", which routes a returning user to onboarding's age check
  await act(async () => { release(); });
  expect(state()).toBe('session=A profile=A program=prog-A failed=false');
});

test('an unexpected error while loading after sign-in shows the retry screen, never an endless spinner', async () => {
  await render(<DataProvider><Probe /></DataProvider>);
  await act(async () => {});
  mockDb.userThrows = true; // no profile, then the account check throws (e.g. keystore failure)
  await act(async () => { mockDb.user = 'C'; mockAuthCb('SIGNED_IN', sessionOf('C')); });
  expect(state()).toBe('session=C profile=none program=none failed=true');
});
