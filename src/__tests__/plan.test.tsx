// Plan tab and Training profile: existing program, navigation into a workout day, failed load + Retry,
// rebuild (persisted via saveProgram), failure keeps the sheet, single save, deload confirmation.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router } from 'expo-router';

import { buildProgram } from '@/engine/plan.ts';
import Plan from '@/app/(tabs)/plan';
import Training from '@/app/training';
import { leave } from '@/lib/nav';

const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 1,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }, 'upper_lower'),
};
const mockRefresh = jest.fn();
const mockSaveProgram = jest.fn();
const mockUpdateProfile = jest.fn();
const mockWorkouts = jest.fn();
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useData: () => ({ profile: mockProfile, program: mockProgram, refresh: mockRefresh }),
  saveProgram: (...a: unknown[]) => mockSaveProgram(...a),
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
  track: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => { const q: Record<string, unknown> = {}; for (const k of ['select', 'not', 'gte']) q[k] = () => q; q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(mockWorkouts()).then(ok, bad); return q; } },
}));
jest.mock('@/lib/nav', () => ({ leave: jest.fn() }));

let alerts: { title: string; buttons?: AlertButton[] }[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _m, buttons) => { alerts.push({ title, buttons }); });
  mockWorkouts.mockReturnValue({ data: [{ day_index: 0 }], error: null });
  mockSaveProgram.mockResolvedValue(undefined);
  mockUpdateProfile.mockResolvedValue(undefined);
});

test('shows the existing program: every day, what is done this week and what is next; a day opens its detail', async () => {
  await render(<Plan />);
  await act(async () => {});
  for (const d of mockProgram.plan.days) expect(screen.getAllByText(d.name).length).toBeGreaterThan(0);
  expect(screen.getByText('Done')).toBeTruthy(); // day 0 finished this week
  expect(screen.getByText('Up next')).toBeTruthy(); // next_day = 1
  await fireEvent.press(screen.getAllByText(mockProgram.plan.days[1].name)[0]);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/workout-day/[index]', params: { index: '1' } });
});

test('a failed load says so, marks nothing done, and Retry reloads', async () => {
  mockWorkouts.mockReturnValueOnce({ data: null, error: { message: 'Network request failed' } });
  await render(<Plan />);
  await act(async () => {});
  expect(screen.getByText(/Could not load this week's finished workouts/)).toBeTruthy();
  expect(screen.queryByText('Done')).toBeNull();
  await fireEvent.press(screen.getByText('Retry'));
  await act(async () => {});
  expect(screen.queryByText(/Could not load this week's/)).toBeNull();
  expect(screen.getByText('Done')).toBeTruthy();
});

test('changing days rebuilds the plan with the chosen days and split, saved once even on a double tap', async () => {
  let resolve!: () => void;
  mockSaveProgram.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
  await render(<Plan />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Change days or split'));
  await fireEvent.press(screen.getByText('3 days'));
  const rebuild = screen.getByRole('button', { name: 'Rebuild my plan' });
  await act(async () => { rebuild.props.onClick({ nativeEvent: {} }); rebuild.props.onClick({ nativeEvent: {} }); });
  await act(async () => { resolve(); });
  expect(mockUpdateProfile).toHaveBeenCalledWith('u1', { days: 3 });
  expect(mockSaveProgram).toHaveBeenCalledTimes(1);
  expect(mockSaveProgram.mock.calls[0][0]).toEqual(expect.objectContaining({ days: 3 }));
  expect(mockSaveProgram.mock.calls[0][1]).toBe('full_body'); // upper/lower does not fit 3 days: the recommended split
  expect(mockRefresh).toHaveBeenCalled();
});

test('a failed rebuild tells the user and keeps the sheet open for a retry', async () => {
  mockSaveProgram.mockRejectedValueOnce(new Error('Network request failed'));
  await render(<Plan />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Change days or split'));
  await fireEvent.press(screen.getByText('Rebuild my plan'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not rebuild your plan');
  expect(screen.getByText('Change schedule')).toBeTruthy();
  expect(mockRefresh).not.toHaveBeenCalled();
  // The profile change was undone, so profile.days still matches the plan that is still active.
  expect(mockUpdateProfile.mock.calls.map((c) => c[1])).toEqual([{ days: 4 }, { days: 4 }]);
});

test('starting a deload asks first and saves a 7-day end date', async () => {
  await render(<Plan />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Start a deload week'));
  expect(alerts[0].title).toBe('Start a deload?');
  await act(async () => { await alerts[0].buttons!.find((b) => b.text === 'Start deload')!.onPress!(); });
  const until = mockUpdateProfile.mock.calls[0][1].deload_until as string;
  const days = Math.round((Date.parse(until) - Date.parse(new Date().toISOString().slice(0, 10))) / 864e5);
  expect(days).toBeGreaterThanOrEqual(5);
  expect(days).toBeLessThanOrEqual(7);
});

test('Training profile: saving rebuilds the plan with the new answers and keeps the place in the week', async () => {
  await render(<Training />);
  await fireEvent.press(screen.getByText('Get stronger'));
  await fireEvent.press(screen.getByText('Save and rebuild plan'));
  await act(async () => {});
  expect(mockUpdateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ goal: 'strength' }));
  expect(mockSaveProgram).toHaveBeenCalledWith(expect.objectContaining({ goal: 'strength' }), 'upper_lower', 1);
  expect(leave).toHaveBeenCalled();
});

test('Training profile: a failed save stays on the screen; a double tap saves once', async () => {
  mockSaveProgram.mockRejectedValueOnce(new Error('Network request failed'));
  await render(<Training />);
  await fireEvent.press(screen.getByText('Save and rebuild plan'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not update your training profile');
  expect(leave).not.toHaveBeenCalled();
  expect(mockUpdateProfile.mock.calls[1][1]).toEqual({ experience: 'intermediate', setup: 'commercial', goal: 'muscle', session_minutes: 60, avoid: [] });
  let resolve!: () => void;
  mockSaveProgram.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
  const save = screen.getByRole('button', { name: 'Save and rebuild plan' });
  await act(async () => { save.props.onClick({ nativeEvent: {} }); save.props.onClick({ nativeEvent: {} }); });
  await act(async () => { resolve(); });
  expect(mockSaveProgram).toHaveBeenCalledTimes(2); // the failed one + exactly one more
});

test('the volume card says what it shows: planned sets (logged sets are on the Details screen)', async () => {
  await render(<Plan />);
  await act(async () => {});
  expect(screen.getByText('Planned volume')).toBeTruthy();
  expect(screen.queryByText(/done vs planned/)).toBeNull();
});

test('today in the week list is named for screen readers, not shown by colour alone', async () => {
  await render(<Plan />);
  await act(async () => {});
  expect(screen.getByLabelText(/, today$/)).toBeTruthy();
});
