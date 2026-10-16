// Account screen: privacy navigation, export, sign-out and the deletion confirmation.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router } from 'expo-router';

import { buildProgram } from '@/engine/plan.ts';
import Profile from '@/app/(tabs)/profile';

const mockProfile = {
  id: 'u1', birth_year: 1995, plan_tier: 'free', disclaimer_accepted_at: '2026-01-01', experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: 'male', unit: 'kg',
  avoid: [], deload_until: null,
};
const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 0,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }),
};
const mockTrack = jest.fn();
const mockExport = jest.fn();
const mockRpc = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('@/lib/data', () => ({
  useData: () => ({ session: { user: { email: 'test@example.invalid' } }, profile: mockProfile, program: mockProgram }),
  track: (...a: unknown[]) => mockTrack(...a),
}));
const mockClearExports = jest.fn();
jest.mock('@/lib/exportData', () => ({ exportData: (...a: unknown[]) => mockExport(...a), clearExportFiles: () => mockClearExports() }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), auth: { signOut: (...a: unknown[]) => mockSignOut(...(a as [])) } } }));
jest.mock('@/lib/notify', () => ({ notificationsSupported: false, restAlertsOn: () => false, setRestAlerts: jest.fn() }));

let alerts: { title: string; buttons?: AlertButton[] }[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _m, buttons) => { alerts.push({ title, buttons }); });
  localStorage.setItem('effort_scale', 'rpe');
  localStorage.setItem('coach:u1', '{"decisions":[]}');
  localStorage.setItem('rir_calibration', '[]');
});
const press = (title: string, text: string) => alerts.find((a) => a.title === title)!.buttons!.find((b) => b.text === text)!.onPress?.();

test('Privacy opens the sheet and the full policy route', async () => {
  await render(<Profile />);
  await fireEvent.press(screen.getByText('Privacy'));
  await fireEvent.press(screen.getByText('Read the full privacy policy'));
  expect(router.push).toHaveBeenCalledWith('/privacy');
});

test('Download my data exports for the signed-in user and records only a bare event', async () => {
  mockExport.mockResolvedValueOnce(undefined);
  await render(<Profile />);
  await fireEvent.press(screen.getByText('Your data'));
  await fireEvent.press(screen.getByText('Download my data (JSON + CSV)'));
  await act(async () => {});
  expect(mockExport).toHaveBeenCalledWith('u1', 'test@example.invalid');
  expect(mockTrack).toHaveBeenCalledWith('data_exported');
});

test('a failed export tells the user and is not tracked as done', async () => {
  mockExport.mockRejectedValueOnce(new Error('Network request failed'));
  await render(<Profile />);
  await fireEvent.press(screen.getByText('Your data'));
  await fireEvent.press(screen.getByText('Download my data (JSON + CSV)'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not export your data');
  expect(mockTrack).not.toHaveBeenCalled();
});

test('Sign out asks first; "Stay signed in" does nothing; "Sign out" signs out and clears local data', async () => {
  await render(<Profile />);
  await fireEvent.press(screen.getByText('Sign out'));
  await fireEvent.press(screen.getByText('Stay signed in'));
  expect(mockSignOut).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Sign out'));
  const buttons = screen.getAllByText('Sign out');
  await fireEvent.press(buttons[buttons.length - 1]); // the confirm button inside the sheet
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('effort_scale')).toBeNull();
  expect(localStorage.getItem('coach:u1')).toBeNull(); // per-account coaching notes go too
  expect(localStorage.getItem('rir_calibration')).toBeNull();
  expect(mockClearExports).toHaveBeenCalled(); // no export file left behind
});

test('Delete account needs confirmation; Cancel deletes nothing; Delete calls delete_account then signs out locally', async () => {
  await render(<Profile />);
  await fireEvent.press(screen.getByText('Your data'));
  await fireEvent.press(screen.getByText('Delete account and all data'));
  expect(alerts[0].title).toBe('Delete your account?');
  expect(mockRpc).not.toHaveBeenCalled();
  press('Delete your account?', 'Cancel');
  expect(mockRpc).not.toHaveBeenCalled();

  mockRpc.mockResolvedValueOnce({ error: null });
  await act(async () => { await press('Delete your account?', 'Delete'); });
  expect(mockRpc).toHaveBeenCalledWith('delete_account');
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(localStorage.getItem('coach:u1')).toBeNull();
  expect(mockClearExports).toHaveBeenCalled();
});

test('a failed deletion keeps the user signed in and says so', async () => {
  mockRpc.mockResolvedValueOnce({ error: { message: 'Network request failed' } });
  await render(<Profile />);
  await fireEvent.press(screen.getByText('Your data'));
  await fireEvent.press(screen.getByText('Delete account and all data'));
  await act(async () => { await press('Delete your account?', 'Delete'); });
  expect(alerts.map((a) => a.title)).toContain('Could not delete');
  expect(mockSignOut).not.toHaveBeenCalled();
});
