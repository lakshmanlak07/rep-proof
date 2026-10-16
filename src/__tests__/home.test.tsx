// Home and Insights: failed or pending loads never read as zero or "no check-in"; Retry really reloads.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { buildProgram } from '@/engine/plan.ts';
import Home from '@/app/(tabs)/index';
import Insights from '@/app/insights';

const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 0,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }),
};
const mockRecent = jest.fn();
const mockDayLogs = jest.fn();
const mockQuery = jest.fn(); // one call per supabase table query on Home
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useData: () => ({ session: { user: { email: 'test@example.invalid' } }, profile: mockProfile, program: mockProgram, refresh: jest.fn() }),
  recentWorkouts: (...a: unknown[]) => mockRecent(...a),
  track: jest.fn(),
}));
jest.mock('@/lib/food', () => ({ ...jest.requireActual('@/lib/food'), dayLogs: (...a: unknown[]) => mockDayLogs(...a) }));
jest.mock('@/lib/supabase', () => {
  // Any chain (.select().not().gte().order()) resolves to the next queued result.
  const chain: Record<string, unknown> = {};
  for (const k of ['select', 'not', 'gte', 'order', 'eq', 'limit']) chain[k] = () => chain;
  chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(mockQuery()).then(ok, bad);
  return { supabase: { from: () => chain } };
});

const offline = { data: null, error: { message: 'Network request failed' } };
beforeEach(() => { mockRecent.mockReset(); mockDayLogs.mockReset(); mockQuery.mockReset(); });

test('Home: failed loads show unknown values and a Retry, never "0 kcal" or "No check-in yet"', async () => {
  mockQuery.mockReturnValue(offline);
  mockRecent.mockRejectedValue(new Error('offline'));
  mockDayLogs.mockRejectedValue(new Error('offline'));
  await render(<Home />);
  await act(async () => {});
  expect(screen.getByText(/Could not refresh your data/)).toBeTruthy();
  expect(screen.getByText(/^— of [\d,]+ kcal$/)).toBeTruthy();
  expect(screen.queryByText(/^0 of [\d,]+ kcal$/)).toBeNull();
  expect(screen.getByText('Unknown')).toBeTruthy();
  expect(screen.queryByText('No check-in yet')).toBeNull();
  expect(screen.getByText(/^— \/ \d+ sets$/)).toBeTruthy();

  // Retry makes real new requests and, on success, replaces the unknowns with data.
  mockQuery.mockReturnValue({ data: [], error: null });
  mockRecent.mockResolvedValue([]);
  mockDayLogs.mockResolvedValue([{ id: 'l1', meal: 'lunch', fdc_id: 0, name: 'Oats', grams: 100, kcal: 400, protein: 13, fat: 7, carbs: 66 }]);
  await fireEvent.press(screen.getByText('Retry'));
  await act(async () => {});
  expect(mockDayLogs).toHaveBeenCalledTimes(2);
  expect(mockRecent).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Could not refresh your data/)).toBeNull();
  expect(screen.getByText(/^400 of [\d,]+ kcal$/)).toBeTruthy();
  expect(screen.getByText('No check-in yet')).toBeTruthy(); // now a real, loaded "none"
  expect(screen.getByText(/^0 \/ \d+ sets$/)).toBeTruthy();
});

test('Home: a second failure after Retry shows the warning again', async () => {
  mockQuery.mockReturnValue(offline);
  mockRecent.mockRejectedValue(new Error('offline'));
  mockDayLogs.mockRejectedValue(new Error('offline'));
  await render(<Home />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Retry'));
  await act(async () => {});
  expect(mockDayLogs).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Could not refresh your data/)).toBeTruthy();
  expect(screen.getByText(/^— of [\d,]+ kcal$/)).toBeTruthy();
});

test('Insights: pending shows Loading, failure shows Unknown, never "No check-in yet"', async () => {
  let fail!: (e: unknown) => void;
  mockRecent.mockReturnValueOnce(new Promise((_, b) => { fail = b; }));
  await render(<Insights />);
  expect(screen.getByText('Loading')).toBeTruthy();
  expect(screen.queryByText('No check-in yet')).toBeNull();
  await act(async () => { fail(new Error('offline')); });
  expect(screen.getByText('Unknown')).toBeTruthy();
  expect(screen.queryByText('No check-in yet')).toBeNull();
});

test('Insights: loaded check-ins drive the real readiness label', async () => {
  mockRecent.mockResolvedValueOnce([{ checkin: { sleep: 4, soreness: 4, energy: 4 } }]);
  await render(<Insights />);
  await act(async () => {});
  expect(screen.getByText('Ready')).toBeTruthy();
});
