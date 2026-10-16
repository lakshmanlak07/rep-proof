// Sign-in screen: input validation, loading, wrong details vs offline, email confirmation path, password recovery.
// Made-up addresses only (example.invalid); no real credentials.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import SignIn from '@/app/sign-in';

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockVerify = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: {
    signInWithPassword: (...a: unknown[]) => mockSignIn(...a),
    signUp: (...a: unknown[]) => mockSignUp(...a),
    verifyOtp: (...a: unknown[]) => mockVerify(...a),
    resend: jest.fn(async () => ({ error: null })),
  } },
}));
jest.mock('@/auth-ui', () => ({
  useCaptcha: () => ({ token: 'test-captcha', ready: true, view: null, reset: jest.fn() }),
  useCountdown: () => ({ left: 0, start: jest.fn() }),
}));
jest.mock('@/lib/pending', () => ({ getPending: () => ({ birthYear: 1990, disclaimerAt: '2026-10-09' }) }));

const EMAIL = 'tester@example.invalid';
const PASS = 'not-a-real-pass-123';
const signInButton = () => screen.getByRole('button', { name: 'Sign in' });

beforeEach(() => { jest.clearAllMocks(); jest.mocked(useLocalSearchParams).mockReturnValue({ mode: 'signin' }); });

async function fill(email = EMAIL, password = PASS) {
  await render(<SignIn />);
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

test('Sign in stays disabled until an email and password are entered', async () => {
  await fill('not-an-email', '');
  expect(signInButton().props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Email'), EMAIL);
  expect(signInButton().props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Password'), PASS);
  expect(signInButton().props.accessibilityState.disabled).toBe(false);
});

test('signing in sends the trimmed email and shows a loading state while waiting', async () => {
  let resolve!: (v: unknown) => void;
  mockSignIn.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  await fill(`  ${EMAIL} `);
  await act(async () => { signInButton().props.onClick({ nativeEvent: {} }); });
  expect(mockSignIn).toHaveBeenCalledWith({ email: EMAIL, password: PASS, options: { captchaToken: 'test-captcha' } });
  expect(signInButton().props.accessibilityState.busy).toBe(true);
  await act(async () => { resolve({ data: { session: {} }, error: null }); });
  expect(signInButton().props.accessibilityState.busy).toBe(false);
});

test('wrong details get a generic message that does not reveal whether the account exists', async () => {
  mockSignIn.mockResolvedValueOnce({ data: { session: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 } });
  await fill();
  await fireEvent.press(signInButton());
  expect(screen.getByText(/Could not sign you in with those details/)).toBeTruthy();
  expect(screen.queryByText(/Invalid login credentials/)).toBeNull();
});

test('offline is reported as a connection problem, not wrong details; a thrown error does not leave it loading', async () => {
  mockSignIn.mockResolvedValueOnce({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } });
  await fill();
  await fireEvent.press(signInButton());
  expect(screen.getByText(/Could not reach RepProof/)).toBeTruthy();
  mockSignIn.mockRejectedValueOnce(new TypeError('Network request failed'));
  await fireEvent.press(signInButton());
  expect(screen.getByText(/Could not reach RepProof/)).toBeTruthy();
  expect(signInButton().props.accessibilityState.busy).toBe(false);
});

test('an unconfirmed email goes to the code screen; a bad code is explained', async () => {
  mockSignIn.mockResolvedValueOnce({ data: { session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 } });
  mockVerify.mockResolvedValueOnce({ error: { code: 'otp_expired', message: 'Token has expired or is invalid', status: 403 } });
  await fill();
  await fireEvent.press(signInButton());
  expect(screen.getByText('Confirm your email')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Code from the email'), '123456');
  await fireEvent.press(screen.getByText('Confirm'));
  expect(mockVerify).toHaveBeenCalledWith({ email: EMAIL, token: '123456', type: 'signup' });
  expect(screen.getByText(/wrong or expired/)).toBeTruthy();
});

test('sign-up needs a long enough password; with confirmation on it asks for the emailed code', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  mockSignUp.mockResolvedValueOnce({ data: { session: null }, error: null });
  await fill(EMAIL, 'short1');
  const create = () => screen.getByRole('button', { name: 'Create account' });
  expect(create().props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Password'), PASS);
  await fireEvent.press(create());
  expect(screen.getByText('Confirm your email')).toBeTruthy();
});

test('sign-up enforces the advertised letters-and-numbers rule before contacting the server, and announces it', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  await fill(EMAIL, 'onlyletterspassword');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(mockSignUp).not.toHaveBeenCalled();
  expect(screen.getByText('Use letters and numbers.')).toBeTruthy();
  expect(announce).toHaveBeenCalledWith('Use letters and numbers.');
});

test('screen titles are headings for screen readers', async () => {
  await render(<SignIn />);
  expect(screen.getByRole('header', { name: 'Welcome back.' })).toBeTruthy();
});

test('"Forgot password?" opens password recovery', async () => {
  await render(<SignIn />);
  await fireEvent.press(screen.getByText('Forgot password?'));
  expect(router.push).toHaveBeenCalledWith('/forgot-password');
});

test('phone sign-in is not offered while it is switched off on the server', async () => {
  await render(<SignIn />);
  expect(screen.queryByText('Mobile number')).toBeNull();
  expect(screen.queryByText('Email and password')).toBeNull(); // no method chooser at all: email only
  expect(screen.getByLabelText('Email')).toBeTruthy();
});
