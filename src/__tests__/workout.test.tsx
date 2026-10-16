// Workout logger journey: start, log a set, finish once, failure keeps the draft, Retry reuses the save id, resume after a kill.
// The progression engine, set validation and save preparation are real; only the network calls are mocked.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert, type AlertButton } from 'react-native';

import { buildProgram } from '@/engine/plan.ts';
import Workout from '@/app/workout';

const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 0,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }),
};
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
const announced = () => announce.mock.calls.map((c) => String(c[0])).join('|');
const mockSave = jest.fn();
const mockRecent = jest.fn(() => Promise.resolve([] as unknown[]));
const mockHistory = jest.fn(() => Promise.resolve([[{ weight: 60, reps: 8, rir: 2 }, { weight: 60, reps: 8, rir: 2 }]] as unknown[]));
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useData: () => ({ session: { user: { id: 'u1' } }, profile: mockProfile, program: mockProgram, refresh: jest.fn() }),
  history: () => mockHistory(),
  bestWeight: () => Promise.resolve(60),
  recentWorkouts: () => mockRecent(),
  saveWorkout: (...a: unknown[]) => mockSave(...a),
  updatePlan: jest.fn(() => Promise.resolve()),
  track: jest.fn(),
}));
jest.mock('@/lib/notify', () => ({ scheduleRestAlert: jest.fn(), cancelRestAlert: jest.fn() }));
jest.mock('@/lib/nav', () => ({ leave: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

type Draft = { clientId: string; items: { exerciseId: string; sets: { weight: string; reps: string; rir: string; done: boolean }[] }[] };
const draft = (): Draft | null => JSON.parse(localStorage.getItem('draft_workout') ?? 'null');
let alerts: { title: string; buttons?: AlertButton[] }[] = [];
const press = (title: string, text: string) => alerts.filter((a) => a.title === title).at(-1)!.buttons!.find((b) => b.text === text)!.onPress?.();

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _m, buttons) => { alerts.push({ title, buttons }); });
});

async function startAndLogOneSet() {
  await render(<Workout />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Skip check-in'));
  await act(async () => {});
  await fireEvent.press(screen.getByText('Log set 1'));
}

test('the saved sets are exactly what was logged, and only logged sets are sent', async () => {
  mockSave.mockResolvedValueOnce(undefined);
  await startAndLogOneSet();
  const d = draft()!;
  const row = d.items[0].sets[0];
  expect(row.done).toBe(true);
  await fireEvent.press(screen.getAllByText('Finish workout')[0]);
  await act(async () => { await press('Finish workout?', 'Finish'); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  const payload = mockSave.mock.calls[0][0];
  expect(payload.clientId).toBe(d.clientId);
  expect(payload.sets).toEqual([expect.objectContaining({
    exerciseId: d.items[0].exerciseId, setIndex: 0, weight: Number(row.weight), reps: Number(row.reps), rir: Number(row.rir), rpe: null,
  })]);
  expect(screen.getByText('Workout saved.')).toBeTruthy();
  expect(draft()).toBeNull();
});

test('a double tap on Finish saves once', async () => {
  let resolve!: () => void;
  mockSave.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
  await startAndLogOneSet();
  await fireEvent.press(screen.getAllByText('Finish workout')[0]);
  await act(async () => { press('Finish workout?', 'Finish'); press('Finish workout?', 'Finish'); });
  await act(async () => { resolve(); });
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test('a failed save keeps the workout on the phone; Retry resends with the same save id', async () => {
  mockSave.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(undefined);
  await startAndLogOneSet();
  await fireEvent.press(screen.getAllByText('Finish workout')[0]);
  await act(async () => { await press('Finish workout?', 'Finish'); });
  expect(screen.getByText('Not saved yet')).toBeTruthy();
  expect(announced()).toContain('Not saved yet. ');
  expect(draft()).not.toBeNull();
  await fireEvent.press(screen.getByText('Retry'));
  await act(async () => {});
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave.mock.calls[1][0].clientId).toBe(mockSave.mock.calls[0][0].clientId);
  expect(screen.getByText('Workout saved.')).toBeTruthy();
});

test('an interrupted workout resumes with its logged sets after the app is killed', async () => {
  await startAndLogOneSet();
  const before = draft();
  await screen.unmount();
  await render(<Workout />);
  await act(async () => {});
  expect(draft()).toEqual(before);
  expect(screen.getByText(/1\/\d+ sets/)).toBeTruthy();
  expect(screen.queryByText('Skip check-in')).toBeNull();
});

test('a draft from another account on the same phone is never shown', async () => {
  await startAndLogOneSet();
  const d = draft()!;
  localStorage.setItem('draft_workout', JSON.stringify({ ...d, userId: 'someone-else' }));
  await screen.unmount();
  await render(<Workout />);
  await act(async () => {});
  expect(screen.getByText('Skip check-in')).toBeTruthy();
});

test('RIR calibration: offered only after an isolation exercise is complete, never on a compound, and never saved with the workout', async () => {
  const { EXERCISE_BY_ID } = jest.requireActual('@/engine/exercises.ts');
  mockSave.mockResolvedValueOnce(undefined);
  await startAndLogOneSet();
  const items = draft()!.items;
  const logAll = async () => { while (screen.queryByText(/^Log set \d+$/)) await fireEvent.press(screen.getByText(/^Log set \d+$/)); };
  await logAll();
  expect(EXERCISE_BY_ID[items[0].exerciseId].compound).toBe(true);
  expect(screen.queryByText('Check your RIR guess (optional)')).toBeNull();
  const iso = items.findIndex((x) => !EXERCISE_BY_ID[x.exerciseId].compound);
  expect(iso).toBeGreaterThan(0);
  for (let k = 0; k < iso; k++) await fireEvent.press(screen.getAllByText('Next exercise')[0]);
  await logAll();
  expect(screen.getByText('Check your RIR guess (optional)')).toBeTruthy();

  await fireEvent.press(screen.getByText('Try a rep-out'));
  await fireEvent.changeText(screen.getByLabelText('Rep count when you made the guess'), '12');
  await fireEvent.changeText(screen.getByLabelText('Total reps when you could not do another'), '15');
  expect(screen.getAllByText(/You guessed 2 left and had 3: 1 more than you thought/).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByText('Save rep-out'));
  const stored = JSON.parse(localStorage.getItem('rir_calibration')!);
  expect(stored).toEqual([expect.objectContaining({ userId: 'u1', exerciseId: items[iso].exerciseId, predicted: 2, actual: 3 })]);
  await fireEvent.press(screen.getByText('Close'));

  // The workout payload carries only the logged sets: no rep-out.
  const logged = draft()!.items.reduce((a, x) => a + x.sets.filter((r) => r.done).length, 0);
  await fireEvent.press(screen.getAllByText('Finish workout')[0]);
  await act(async () => { await press('Finish workout?', 'Finish'); });
  expect(mockSave.mock.calls[0][0].sets).toHaveLength(logged);
});

test('RIR calibration refuses impossible numbers', async () => {
  const { CalibrationCard } = jest.requireActual('@/calibration');
  await render(<CalibrationCard userId="u1" exerciseId="cable_fly" name="Cable fly" />);
  await fireEvent.press(screen.getByText('Try a rep-out'));
  await fireEvent.changeText(screen.getByLabelText('Rep count when you made the guess'), '12');
  await fireEvent.changeText(screen.getByLabelText('Total reps when you could not do another'), '9');
  expect(screen.getByText(/Total reps must be a whole number/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Save rep-out'));
  expect(localStorage.getItem('rir_calibration')).toBeNull();
});

test('RPE scale: the chosen RPE is saved as RPE and converted to reps in reserve for the engine', async () => {
  localStorage.setItem('effort_scale', 'rpe');
  mockSave.mockResolvedValueOnce(undefined);
  await render(<Workout />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Skip check-in'));
  await act(async () => {});
  await fireEvent.press(screen.getByLabelText('RPE 8.5, about 1 reps in reserve'));
  await fireEvent.press(screen.getByText('Log set 1'));
  await fireEvent.press(screen.getAllByText('Finish workout')[0]);
  await act(async () => { await press('Finish workout?', 'Finish'); });
  expect(mockSave.mock.calls[0][0].sets[0]).toEqual(expect.objectContaining({ rpe: 8.5, rir: 1 }));
});

test('after saving, a failed plan update is reported instead of silently showing changes that were not stored', async () => {
  mockSave.mockResolvedValueOnce(undefined);
  await startAndLogOneSet();
  mockRecent.mockRejectedValueOnce(new Error('Network request failed'));
  await fireEvent.press(screen.getAllByText('Finish workout')[0]);
  await act(async () => { await press('Finish workout?', 'Finish'); });
  expect(screen.getByText('Workout saved.')).toBeTruthy();
  expect(screen.getByText(/your plan could not be updated/)).toBeTruthy();
});

test('a swap that cannot load history says so and keeps the current exercise', async () => {
  const { substitutes } = jest.requireActual('@/engine/exercises.ts');
  await startAndLogOneSet();
  const before = draft()!.items[0].exerciseId;
  const alt = substitutes(before, 'commercial', [])[0];
  mockHistory.mockRejectedValueOnce(new Error('Network request failed'));
  await fireEvent.press(screen.getAllByText('Swap')[0]);
  await act(async () => { await fireEvent.press(screen.getByText(alt.name)); });
  expect(alerts.map((a) => a.title)).toContain('Could not swap that exercise');
  expect(draft()!.items[0].exerciseId).toBe(before);
});
