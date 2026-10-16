// Workout detail and Weekly volume: delete only after server confirmation; logged volume never shows zero while unknown.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { buildProgram } from '@/engine/plan.ts';
import { loadCoachNotes, saveCoachNotes } from '@/lib/coach';
import WorkoutDetail from '@/app/history/[id]';
import Volume from '@/app/volume';

const WID = '11111111-2222-4333-8444-555555555555';
const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 0,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }),
};
const mockDelete = jest.fn();
const mockTable = jest.fn(); // (table) => result for the next query on that table
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useData: () => ({ profile: mockProfile, program: mockProgram }),
  deleteWorkout: (...a: unknown[]) => mockDelete(...a),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const k of ['select', 'eq', 'order', 'gte']) chain[k] = () => chain;
      chain.maybeSingle = () => Promise.resolve(mockTable(table));
      chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(mockTable(table)).then(ok, bad);
      return chain;
    },
  },
}));

const workout = { id: WID, day_name: 'Upper A', started_at: '2026-10-08T10:00:00Z', finished_at: '2026-10-08T11:00:00Z', checkin: null };
const sets = [{ exercise_id: 'bb_bench', set_index: 0, weight: 80, reps: 8, rir: 2, rpe: null }];
let alerts: { title: string; buttons?: AlertButton[] }[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: WID });
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _m, buttons) => { alerts.push({ title, buttons }); });
  mockTable.mockImplementation((t: string) => (t === 'workouts' ? { data: workout, error: null } : { data: sets, error: null }));
});
const press = (title: string, text: string) => alerts.find((a) => a.title === title)!.buttons!.find((b) => b.text === text)!.onPress?.();

test('delete asks first; Cancel keeps the workout', async () => {
  await render(<WorkoutDetail />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Delete this workout'));
  press('Delete this workout?', 'Cancel');
  expect(mockDelete).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test('confirmed delete calls the server, clears that lift from coach notes, then leaves', async () => {
  saveCoachNotes('u1', [{ exerciseId: 'bb_bench', kind: 'progressing' }, { exerciseId: 'bb_squat', kind: 'progressing' }] as never, null);
  mockDelete.mockResolvedValueOnce(undefined);
  await render(<WorkoutDetail />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Delete this workout'));
  await act(async () => { await press('Delete this workout?', 'Delete'); });
  expect(mockDelete).toHaveBeenCalledWith(WID);
  expect(router.replace).toHaveBeenCalledWith('/progress');
  expect(loadCoachNotes('u1')!.decisions.map((d) => d.exerciseId)).toEqual(['bb_squat']);
});

test('a failed delete stays on the workout and says so', async () => {
  mockDelete.mockRejectedValueOnce(new Error('Network request failed'));
  await render(<WorkoutDetail />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Delete this workout'));
  await act(async () => { await press('Delete this workout?', 'Delete'); });
  expect(alerts.map((a) => a.title)).toContain('Could not delete the workout');
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByText('Upper A')).toBeTruthy();
});

test('weekly volume: a failed load shows unknown, not "0 sets"; Retry reloads real counts', async () => {
  mockTable.mockReturnValue({ data: null, error: { message: 'Network request failed' } });
  await render(<Volume />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Logged this week'));
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
  expect(screen.queryByText('Potentially increase')).toBeNull();

  mockTable.mockReturnValue({ data: [{ exercise_id: 'bb_bench' }, { exercise_id: 'bb_bench' }], error: null });
  await fireEvent.press(screen.getByText('Retry'));
  await act(async () => {});
  expect(screen.queryByText('Unknown')).toBeNull();
  expect(screen.getByText(/^2 /)).toBeTruthy(); // chest: 2 sets
});
