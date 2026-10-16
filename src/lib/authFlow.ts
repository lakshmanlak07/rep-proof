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
  // Email-sending limits (the 60 s per-address cooldown, the project email quota) are only checked when the
  // address HAS an account; an unknown address gets a plain 200. Showing them would reveal which emails are
  // registered (a second request within 60 s answers "yes"), so they read as sent like everything else.
  // The app's own 60 s resend countdown already stops honest double requests.
  if (/over_email_send_rate_limit|only request this after|email rate limit/i.test(m)) return { sent: true, message: SENT_MESSAGE };
  if (error.status === 429 || /rate|captcha/i.test(m) || /email_address_invalid|invalid.*email/i.test(m)) {
    return { sent: false, message: friendlyAuthError(error) };
  }
  if (!error.status) return { sent: false, message: 'Check your connection and try again.' }; // network failure: nothing was sent
  return { sent: true, message: SENT_MESSAGE };
}

/**
 * Whether the server has definitively rejected the stored session (account deleted, banned, or token
 * revoked), as opposed to a temporary failure. Only a definite rejection signs the device out: a network
 * error or server hiccup must never log someone out or send them back to onboarding.
 */
export function sessionRejected(error: AuthErr): boolean {
  if (!error) return false;
  const m = `${error.code ?? ''} ${error.message ?? ''}`;
  // Specific codes only: a bare 401/403 can come from a proxy or gateway hiccup, and signing out wipes the unsaved workout.
  return /user_not_found|user_banned|session_not_found|bad_jwt|refresh_token_not_found|user from sub claim in JWT does not exist/i.test(m);
}
