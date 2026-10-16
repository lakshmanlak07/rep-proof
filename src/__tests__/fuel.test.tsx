// Fuel (nutrition diary) screen: loading, failure, retry and success, with the real nutrition maths.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { targets } from '@/engine/nutrition.ts';
import Nutrition from '@/app/(tabs)/nutrition';

const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockWeighIns = jest.fn(() => Promise.resolve([] as unknown[]));
jest.mock('@/lib/data', () => ({ useData: () => ({ profile: mockProfile, refresh: jest.fn() }), track: jest.fn(), updateProfile: jest.fn(), bodyweightHistory: () => mockWeighIns() }));

const mockDayLogs = jest.fn();
jest.mock('@/lib/food', () => {
  const actual = jest.requireActual('@/lib/food');
  return { ...actual, dayLogs: (...a: unknown[]) => mockDayLogs(...a), recentLogTotals: jest.fn(() => Promise.resolve([])), deleteLog: jest.fn(), saveMeal: jest.fn(), updateLogGrams: jest.fn() };
});
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const target = targets({ bodyweight: 80, unit: 'kg', heightCm: 180, age: new Date().getFullYear() - 1995, sex: 'male', days: 4, phase: 'maintain' }).calories;
const log = (kcal: number) => ({ id: `l${kcal}`, meal: 'lunch', fdc_id: 0, name: 'Oats', grams: 100, kcal, protein: 10, fat: 5, carbs: 50 });
const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

beforeEach(() => mockDayLogs.mockReset());

test('while the diary is loading, no calorie number is shown (never a false "full target left")', async () => {
  const first = deferred<unknown[]>();
  mockDayLogs.mockReturnValueOnce(first.promise);
  await render(<Nutrition />);
  expect(screen.queryByText(target.toLocaleString())).toBeNull();
  expect(screen.getByText('—')).toBeTruthy();
  await act(async () => { first.resolve([log(500)]); });
  expect(screen.getByText((target - 500).toLocaleString())).toBeTruthy();
});

test('a failed load shows unknown totals and a Retry that really reloads, with a loading state, then success', async () => {
  mockDayLogs.mockRejectedValueOnce(new Error('offline'));
  await render(<Nutrition />);
  await act(async () => {});
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText(/not loaded/)).toBeTruthy();
  expect(screen.getByText(/Could not load today's foods/)).toBeTruthy();
  expect(screen.queryByText(target.toLocaleString())).toBeNull();

  const retry = deferred<unknown[]>();
  mockDayLogs.mockReturnValueOnce(retry.promise);
  await fireEvent.press(screen.getByText('Retry'));
  expect(mockDayLogs).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Loading today's foods/)).toBeTruthy();
  await act(async () => { retry.resolve([log(700), log(300)]); });
  expect(screen.getByText((target - 1000).toLocaleString())).toBeTruthy();
  expect(screen.queryByText(/Could not load/)).toBeNull();
});

test('a second failure after retry shows the error again, not a stale loading state', async () => {
  mockDayLogs.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('still offline'));
  await render(<Nutrition />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Retry'));
  expect(mockDayLogs).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Could not load today's foods/)).toBeTruthy();
  expect(screen.queryByText(/Loading today's foods/)).toBeNull();
});

test('an empty day that loaded fine is a real zero: full target left', async () => {
  mockDayLogs.mockResolvedValueOnce([]);
  await render(<Nutrition />);
  await act(async () => {});
  expect(screen.getByText(target.toLocaleString())).toBeTruthy();
  expect(screen.queryByText(/not loaded/)).toBeNull();
});

test('Targets: a clear weight-trend drift is shown as a labelled suggestion; too little data shows nothing', async () => {
  mockDayLogs.mockResolvedValue([]);
  // Local calendar days, as the app writes them (a UTC date is already "tomorrow" on a US evening).
  const day = (n: number) => { const d = new Date(Date.now() - n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  mockWeighIns.mockResolvedValueOnce([21, 14, 7, 0].map((n, i) => ({ weight: 80 + i * 0.8, logged_on: day(n) }))); // +1%/week on maintenance
  await render(<Nutrition />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Targets'));
  expect(screen.getByText(/Drifting up for maintenance/)).toBeTruthy();
  expect(screen.getByText(/Suggestion only/)).toBeTruthy();

  mockWeighIns.mockResolvedValueOnce([{ weight: 80, logged_on: day(0) }]);
  await screen.unmount();
  await render(<Nutrition />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Targets'));
  expect(screen.queryByText(/Weight trend vs your goal/)).toBeNull();
});

test('"Save as meal" saves one meal even on a double tap', async () => {
  const { saveMeal } = jest.requireMock('@/lib/food') as { saveMeal: jest.Mock };
  let finish!: () => void;
  saveMeal.mockReturnValueOnce(new Promise<void>((r) => { finish = r; }));
  mockDayLogs.mockResolvedValueOnce([log(300)]);
  await render(<Nutrition />);
  await act(async () => {});
  const button = screen.getByRole('button', { name: 'Save Lunch as a meal' });
  await act(async () => { button.props.onClick({ nativeEvent: {} }); button.props.onClick({ nativeEvent: {} }); });
  await act(async () => { finish(); });
  expect(saveMeal).toHaveBeenCalledTimes(1);
});
