// Progress: charts only from loaded data; no "0" for unknown or out-of-range data; bodyweight failure is a failure, not a missing migration.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { router } from 'expo-router';

import { buildProgram } from '@/engine/plan.ts';
import Progress from '@/app/(tabs)/progress';

const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 0,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }),
};
const mockTable = jest.fn();
const mockBodyweight = jest.fn();
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useData: () => ({ profile: mockProfile, program: mockProgram, refresh: jest.fn() }),
  bodyweightHistory: () => mockBodyweight(),
  track: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const k of ['select', 'not', 'order', 'limit', 'gte']) chain[k] = () => chain;
      chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(mockTable(table)).then(ok, bad);
      return chain;
    },
  },
}));

const offline = { data: null, error: { message: 'Network request failed' } };
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const monday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
/** A Wednesday n complete weeks ago (n = 0 is the current, unfinished week). */
const weeksAgo = (n: number) => { const d = new Date(monday); d.setDate(d.getDate() - 7 * n + 2); d.setHours(18); return d.toISOString(); };
const data = (setDaysAgo: number) => (t: string) => {
  if (t === 'workouts') return { data: [{ id: 'w1', day_name: 'Upper A', finished_at: daysAgo(setDaysAgo), logged_sets: [{ count: 2 }] }], error: null };
  if (t === 'logged_sets') return { data: [0, 1].map(() => ({ exercise_id: 'bb_bench', weight: 80, reps: 8, workout_id: 'w1', created_at: daysAgo(setDaysAgo) })), error: null };
  return { data: [], error: null };
};
beforeEach(() => { jest.clearAllMocks(); mockBodyweight.mockResolvedValue([]); });

test('a failed load shows no charts and no zero totals; Try again loads the real numbers', async () => {
  mockTable.mockReturnValue(offline);
  await render(<Progress />);
  await act(async () => {});
  expect(screen.getByText('Could not load your progress.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Sets'));
  expect(screen.queryByText(/Total hard sets per week/)).toBeNull();
  expect(screen.queryByText(/No logged sets/)).toBeNull(); // unknown is not "none"

  mockTable.mockImplementation(data(9)); // a completed week
  await fireEvent.press(screen.getByText('Try again'));
  await act(async () => {});
  expect(screen.queryByText('Could not load your progress.')).toBeNull();
  expect(screen.getByText('Total hard sets per week (completed weeks)')).toBeTruthy();
  expect(screen.getByText('Upper A')).toBeTruthy(); // history list
  await fireEvent.press(screen.getByText('Upper A'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/history/[id]', params: { id: 'w1' } });
});

test('sets outside the chosen range say so instead of showing 0', async () => {
  mockTable.mockImplementation(data(20)); // inside 90D, outside 7D
  await render(<Progress />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Load'));
  expect(screen.getByText(/weekly volume load/)).toBeTruthy();
  await fireEvent.press(screen.getByText('7D'));
  expect(screen.getByText('No chest sets in the last 7 days.')).toBeTruthy();
  expect(screen.queryByText(/weekly volume load/)).toBeNull();
});

test('a bodyweight load failure is reported as a failure, with a retry', async () => {
  mockTable.mockImplementation(data(2));
  mockBodyweight.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ weight: 81, logged_on: '2026-10-08' }]);
  await render(<Progress />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Body'));
  expect(screen.getByText(/Could not load your bodyweight/)).toBeTruthy();
  expect(screen.queryByText(/migration/)).toBeNull();
  await fireEvent.press(screen.getByText('Try again'));
  await act(async () => {});
  expect(screen.queryByText(/Could not load your bodyweight/)).toBeNull();
  expect(mockBodyweight).toHaveBeenCalledTimes(2);
});

test('trends (J-02): under 2 weeks says so; with history shows 4-week averages; missing RIR is not averaged as 0', async () => {
  mockTable.mockImplementation((t: string) => t === 'logged_sets'
    ? { data: [{ exercise_id: 'bb_bench', weight: 80, reps: 8, rir: 2, workout_id: 'w0', created_at: weeksAgo(1) }], error: null }
    : data(2)(t)); // one completed week only
  await render(<Progress />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Sets'));
  expect(screen.getByText('Trends appear after 2 weeks of logged sets.')).toBeTruthy();
  await screen.unmount();

  // Three weeks: 2 sets at RIR 3, then a week with sets logged without RIR, then this week.
  // Two weeks ago: 2 sets at RIR 3. Last week: 1 set at RIR 1, 2 sets without RIR. This week: 1 set (not counted yet).
  const row = (w: number, rir: number | null) => ({ exercise_id: 'bb_bench', weight: 80, reps: 8, rir, workout_id: `w${w}`, created_at: weeksAgo(w) });
  mockTable.mockImplementation((t: string) => t === 'logged_sets'
    ? { data: [row(0, 0), row(1, 1), row(1, null), row(1, null), row(2, 3), row(2, 3)].sort((a, b) => b.created_at.localeCompare(a.created_at)), error: null }
    : data(1)(t));
  await render(<Progress />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Sets'));
  expect(screen.getByText('Hard sets per week')).toBeTruthy();
  expect(screen.getByText('Average reps in reserve logged')).toBeTruthy();
  expect(screen.getByText(/^RIR · 3 sets$/)).toBeTruthy(); // the two sets without RIR are left out
  expect(screen.getAllByText('2.3').length).toBeGreaterThan(0); // (1 + 3 + 3) / 3
  expect(screen.queryByText('1.4')).toBeNull(); // what treating missing RIR as 0 would give: (1 + 0 + 0 + 3 + 3) / 5
});

test('trends: every logged set without RIR shows "no average", never 0 RIR', async () => {
  const row = (w: number) => ({ exercise_id: 'bb_bench', weight: 80, reps: 8, rir: null, workout_id: `w${w}`, created_at: weeksAgo(w) });
  mockTable.mockImplementation((t: string) => t === 'logged_sets' ? { data: [row(1), row(2)], error: null } : data(1)(t));
  await render(<Progress />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Sets'));
  expect(screen.getByText(/No reps in reserve logged in the last 4 weeks/)).toBeTruthy();
  expect(screen.queryByText('Average reps in reserve logged')).toBeNull();
});

test('the current week is shown as "so far", not compared with full weeks', async () => {
  const row = (w: number) => ({ exercise_id: 'bb_bench', weight: 80, reps: 8, rir: 2, workout_id: `w${w}`, created_at: weeksAgo(w) });
  mockTable.mockImplementation((t: string) => t === 'logged_sets' ? { data: [row(0), ...Array.from({ length: 12 }, () => row(1))], error: null } : data(1)(t));
  await render(<Progress />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Sets'));
  expect(screen.getByText('This week so far: 1 hard sets')).toBeTruthy();
  expect(screen.getAllByText('12').length).toBeGreaterThan(0); // last completed week, not the 1 so far
});
