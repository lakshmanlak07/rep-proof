// Before an account exists: age gate, disclaimer, password recovery. Made-up addresses only.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Age from '@/app/age';
import Disclaimer from '@/app/disclaimer';
import ForgotPassword from '@/app/forgot-password';

const mockReset = jest.fn();
const mockVerify = jest.fn();
const mockUpdate = jest.fn();
const mockSignOut = jest.fn(async () => ({ error: null }));
jest.mock('@/lib/supabase', () => ({
  supabase: {},
  recoveryClient: () => ({ auth: {
    resetPasswordForEmail: (...a: unknown[]) => mockReset(...a),
    verifyOtp: (...a: unknown[]) => mockVerify(...a),
    updateUser: (...a: unknown[]) => mockUpdate(...a),
    signOut: (...a: unknown[]) => mockSignOut(...(a as [])),
  } }),
}));
jest.mock('@/auth-ui', () => ({
  useCaptcha: () => ({ token: 'test-captcha', ready: true, view: null, reset: jest.fn() }),
  useCountdown: () => ({ left: 0, start: jest.fn() }),
}));

const pending = () => JSON.parse(localStorage.getItem('pending_onboarding') ?? 'null');
const disabled = (name: string) => screen.getByRole('button', { name }).props.accessibilityState.disabled;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('age gate: needs a real 4-digit year; under 18 stores nothing and explains why', async () => {
  await render(<Age />);
  await fireEvent.changeText(screen.getByLabelText('Year of birth'), '19');
  expect(disabled('Continue')).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Year of birth'), String(new Date().getFullYear() + 1));
  expect(disabled('Continue')).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Year of birth'), String(new Date().getFullYear() - 16));
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.getByText('RepProof is for ages 18 and up.')).toBeTruthy();
  expect(pending()).toBeNull();
  await fireEvent.press(screen.getByText('I entered the wrong year'));
  expect(screen.getByLabelText('Year of birth').props.value).toBe('');
});

test('age gate: an adult continues to the disclaimer with only the birth year kept on the phone', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ mode: 'signin' });
  await render(<Age />);
  await fireEvent.changeText(screen.getByLabelText('Year of birth'), '1990');
  await fireEvent.press(screen.getByText('Continue'));
  expect(pending()).toEqual({ birthYear: 1990, disclaimerAt: null });
  expect(router.push).toHaveBeenCalledWith({ pathname: '/disclaimer', params: { mode: 'signin' } });
});

test('disclaimer: must be ticked; records when it was accepted; without the age step it goes back there', async () => {
  localStorage.setItem('pending_onboarding', JSON.stringify({ birthYear: 1990, disclaimerAt: null }));
  await render(<Disclaimer />);
  expect(disabled('Continue')).toBe(true);
  await fireEvent.press(screen.getByText('I understand and agree.'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(Date.parse(pending().disclaimerAt)).toBeGreaterThan(Date.now() - 60_000);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/sign-in', params: { mode: undefined } });

  localStorage.clear();
  await fireEvent.press(screen.getByText('Continue'));
  expect(router.replace).toHaveBeenCalledWith('/age');
});

test('password reset: the same answer whether or not the account exists; offline is a connection error, not stuck', async () => {
  mockReset.mockResolvedValueOnce({ data: {}, error: { code: 'user_not_found', message: 'User not found', status: 404 } });
  await render(<ForgotPassword />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'nobody@example.invalid');
  await fireEvent.press(screen.getByText('Email me a code'));
  expect(screen.getByText('Choose a new password')).toBeTruthy(); // no hint that the account does not exist
  await screen.unmount();

  mockReset.mockRejectedValueOnce(new TypeError('Network request failed'));
  await render(<ForgotPassword />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'tester@example.invalid');
  await fireEvent.press(screen.getByText('Email me a code'));
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Email me a code' }).props.accessibilityState.busy).toBe(false);
});

test('password reset: weak or mismatched passwords are refused before any request; success signs out everywhere', async () => {
  mockReset.mockResolvedValue({ data: {}, error: null });
  mockVerify.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: null });
  await render(<ForgotPassword />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'tester@example.invalid');
  await fireEvent.press(screen.getByText('Email me a code'));
  await fireEvent.changeText(screen.getByLabelText('Code from the email'), '123456');
  await fireEvent.changeText(screen.getByLabelText('New password'), 'short');
  await fireEvent.changeText(screen.getByLabelText('New password again'), 'short');
  await fireEvent.press(screen.getByText('Set new password'));
  expect(mockVerify).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('New password'), 'not-a-real-pass-123');
  await fireEvent.changeText(screen.getByLabelText('New password again'), 'not-a-real-pass-124');
  await fireEvent.press(screen.getByText('Set new password'));
  expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('New password again'), 'not-a-real-pass-123');
  await act(async () => { await fireEvent.press(screen.getByText('Set new password')); });
  expect(mockVerify).toHaveBeenCalledWith({ email: 'tester@example.invalid', token: '123456', type: 'recovery' });
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
  expect(router.replace).toHaveBeenCalledWith('/sign-in?mode=signin');
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)![1]).toMatch(/signed out on your other devices/);
});

test('password reset: if signing out other devices fails, the app does not claim it worked', async () => {
  mockReset.mockResolvedValue({ data: {}, error: null });
  mockVerify.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValueOnce({ error: { message: 'Network request failed', status: 0 } } as never);
  await render(<ForgotPassword />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'tester@example.invalid');
  await fireEvent.press(screen.getByText('Email me a code'));
  await fireEvent.changeText(screen.getByLabelText('Code from the email'), '123456');
  await fireEvent.changeText(screen.getByLabelText('New password'), 'not-a-real-pass-123');
  await fireEvent.changeText(screen.getByLabelText('New password again'), 'not-a-real-pass-123');
  await act(async () => { await fireEvent.press(screen.getByText('Set new password')); });
  const message = jest.mocked(Alert.alert).mock.calls.at(-1)![1];
  expect(message).toMatch(/could not sign you out on your other devices/);
  expect(message).not.toMatch(/You have been signed out/);
});
