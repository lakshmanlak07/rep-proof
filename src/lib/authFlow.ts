// Rules for sign-up confirmation and password reset. Plain TypeScript (no React Native) so it is unit-tested.
import { friendlyAuthError } from './errors.ts';

export const MIN_PASSWORD = 10; // Supabase enforces its own minimum too (dashboard setting)
export const RESEND_SECONDS = 60; // Supabase refuses a second email to the same address within 60 s

/** Codes from emails are 6-10 digits (Supabase "Email OTP length"). */
export const cleanCode = (s: string) => s.replace(/\D/g, '').slice(0, 10);
export const isCode = (s: string) => /^\d{6,10}$/.test(s);

export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letters and numbers.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

type AuthErr = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export const SENT_MESSAGE = 'If an account uses that email, we have sent it a code. It can take a minute; check spam too.';

/**
 * Outcome of "email me a code" requests (password reset, resend confirmation). The answer must be the same
 * whether or not the address has an account, so only problems that say nothing about the account
 * (rate limit, security check, bad address format, no connection) are shown; anything else reads as sent.
 */
export function emailRequestOutcome(error: AuthErr): { sent: boolean; message: string } {
  if (!error) return { sent: true, message: SENT_MESSAGE };
  const m = `${error.code ?? ''} ${error.message ?? ''}`;
  if (error.status === 429 || /rate|captcha|only request this after/i.test(m) || /email_address_invalid|invalid.*email/i.test(m)) {
    return { sent: false, message: friendlyAuthError(error) };
  }
  if (!error.status) return { sent: false, message: 'Check your connection and try again.' }; // network failure: nothing was sent
  return { sent: true, message: SENT_MESSAGE };
}
