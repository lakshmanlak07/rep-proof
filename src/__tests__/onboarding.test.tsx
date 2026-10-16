// Onboarding: step progress, validation, back, save (profile + plan), failure and retry, single save, age gate.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BackHandler } from 'react-native';

import Onboarding from '@/app/onboarding';

const mockRefresh = jest.fn();
const mockSaveProgram = jest.fn();
const mockUpsert = jest.fn();
const mockRpc = jest.fn(async () => ({ error: null }));
const mockSignOut = jest.fn(async () => ({ error: null }));
jest.mock('@/lib/data', () => ({
  ...jest.requireActual('@/lib/data'),
  useData: () => ({ session: { user: { id: 'new-user' } }, refresh: mockRefresh }),
  saveProgram: (...a: unknown[]) => mockSaveProgram(...a),
  track: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({ upsert: (...a: unknown[]) => mockUpsert(table, ...a) }),
    rpc: (...a: unknown[]) => mockRpc(...(a as [])),
    auth: { signOut: (...a: unknown[]) => mockSignOut(...(a as [])) },
  },
}));

const PENDING = { birthYear: 1990, disclaimerAt: '2026-10-09T10:00:00.000Z' };
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('pending_onboarding', JSON.stringify(PENDING));
  mockUpsert.mockResolvedValue({ error: null });
  mockSaveProgram.mockResolvedValue(undefined);
});
const disabled = (title: string) => screen.getByRole('button', { name: title }).props.accessibilityState.disabled;

async function toSplitStep() {
  await render(<Onboarding />);
  await fireEvent.press(screen.getByText('Intermediate'));
  await fireEvent.press(screen.getByText('Home gym'));
  await fireEvent.press(screen.getByText('Build muscle'));
  await fireEvent.press(screen.getByText('4 days a week'));
  await fireEvent.press(screen.getByText('60 minutes'));
  // Bodyweight: must be a real number in range.
  expect(disabled('Continue')).toBe(true);
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. 75'), '1000');
  expect(disabled('Continue')).toBe(true);
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. 75'), '82.5');
  await fireEvent.press(screen.getByText('Continue'));
  // Height: 100-250 cm only.
  await fireEvent.changeText(screen.getByPlaceholderText('cm, e.g. 178'), '90');
  expect(disabled('Continue')).toBe(true);
  await fireEvent.changeText(screen.getByPlaceholderText('cm, e.g. 178'), '180');
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(screen.getByText('Prefer not to say'));
  await fireEvent.press(screen.getByText('None, continue')); // avoid
  await fireEvent.press(screen.getByText('None, continue')); // weak
  await fireEvent.press(screen.getByText('None, continue')); // strong
  await fireEvent.press(screen.getByText('Last set to failure'));
  // 60-minute sessions: the regions option says sets get cut to fit
  expect(screen.getByText(/At 60 minutes, sets are cut to 1 before a region is skipped/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Every region of each muscle'));
  expect(screen.getByText('Your split')).toBeTruthy();
}

test('all steps in order, validated inputs, then the profile and plan are saved with what was chosen', async () => {
  await toSplitStep();
  await fireEvent.press(screen.getByText('Build my plan'));
  await act(async () => {});
  const profile = mockUpsert.mock.calls.find((c) => c[0] === 'profiles')![1];
  expect(profile).toEqual(expect.objectContaining({
    id: 'new-user', birth_year: 1990, disclaimer_accepted_at: PENDING.disclaimerAt, experience: 'intermediate', setup: 'home', goal: 'muscle',
    days: 4, session_minutes: 60, bodyweight: 82.5, height_cm: 180, sex: null, unit: 'kg', avoid: [],
  }));
  expect(mockSaveProgram).toHaveBeenCalledTimes(1);
  expect(mockSaveProgram.mock.calls[0][0]).toEqual(expect.objectContaining({ coverage: 'regions' }));
  expect(screen.getByText('Your starting plan is ready.')).toBeTruthy();
  expect(localStorage.getItem('pending_onboarding')).toBeNull(); // age data is not kept on the phone after saving
  await fireEvent.press(screen.getByText('View my plan'));
  expect(mockRefresh).toHaveBeenCalled();
});

test('Android hardware Back goes to the previous step instead of leaving onboarding', async () => {
  const spy = jest.spyOn(BackHandler, 'addEventListener');
  await render(<Onboarding />);
  await fireEvent.press(screen.getByText('Intermediate'));
  expect(screen.getByText('Where do you train?')).toBeTruthy();
  const handler = spy.mock.calls[spy.mock.calls.length - 1][1] as () => boolean;
  let handled = false;
  await act(async () => { handled = handler(); });
  expect(handled).toBe(true);
  expect(screen.getByText('How long have you been lifting consistently?')).toBeTruthy();
  spy.mockRestore();
});

test('Back returns to the previous step with the answer kept', async () => {
  await render(<Onboarding />);
  await fireEvent.press(screen.getByText('Intermediate'));
  expect(screen.getByText('Where do you train?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByText('How long have you been lifting consistently?')).toBeTruthy();
});

test('a failed save shows an error, keeps the answers, and Retry saves', async () => {
  mockUpsert.mockResolvedValueOnce({ error: { message: 'Network request failed' } });
  await toSplitStep();
  await fireEvent.press(screen.getByText('Build my plan'));
  await act(async () => {});
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
  expect(mockSaveProgram).not.toHaveBeenCalled();
  expect(localStorage.getItem('pending_onboarding')).not.toBeNull();
  await fireEvent.press(screen.getByText('Build my plan'));
  await act(async () => {});
  expect(screen.getByText('Your starting plan is ready.')).toBeTruthy();
});

test('a double tap on "Build my plan" saves once', async () => {
  let resolve!: (v: unknown) => void;
  mockUpsert.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await toSplitStep();
  const build = screen.getByRole('button', { name: 'Build my plan' });
  await act(async () => { build.props.onClick({ nativeEvent: {} }); build.props.onClick({ nativeEvent: {} }); resolve({ error: null }); });
  expect(mockUpsert.mock.calls.filter((c) => c[0] === 'profiles')).toHaveLength(1);
  expect(mockSaveProgram).toHaveBeenCalledTimes(1);
});

test('without the age check on this phone, it asks first; under 18 removes the new account and signs out', async () => {
  localStorage.clear();
  await render(<Onboarding />);
  expect(screen.getByText('Before we build your plan')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('What year were you born?'), String(new Date().getFullYear() - 15));
  await fireEvent.press(screen.getByText('I understand, continue'));
  await act(async () => {});
  expect(mockRpc).toHaveBeenCalledWith('delete_account');
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(mockUpsert).not.toHaveBeenCalled();
});

test('under 18: if removing the new account fails, it says so and does not sign out (the account still exists)', async () => {
  localStorage.clear();
  mockRpc.mockResolvedValueOnce({ error: { message: 'Network request failed' } } as never);
  await render(<Onboarding />);
  await fireEvent.changeText(screen.getByLabelText('What year were you born?'), String(new Date().getFullYear() - 15));
  await fireEvent.press(screen.getByText('I understand, continue'));
  await act(async () => {});
  expect(screen.getByText(/could not remove the account/)).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('the first weigh-in is dated by the phone calendar day', async () => {
  await toSplitStep();
  await fireEvent.press(screen.getByText('Build my plan'));
  await act(async () => {});
  const weighIn = mockUpsert.mock.calls.find((c) => c[0] === 'bodyweight_logs')![1];
  const d = new Date();
  expect(weighIn).toEqual({ weight: 82.5, logged_on: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
});

test('an adult passing the age check continues to the first step', async () => {
  localStorage.clear();
  await render(<Onboarding />);
  await fireEvent.changeText(screen.getByLabelText('What year were you born?'), '1990');
  await fireEvent.press(screen.getByText('I understand, continue'));
  expect(screen.getByText('How long have you been lifting consistently?')).toBeTruthy();
});
