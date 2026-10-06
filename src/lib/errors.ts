// User-facing error text. Plain TypeScript (no React Native) so it is unit-tested.
// Never show raw server or database text: it can reveal schema details or whether an account exists.

/** Full error for developers: development builds only (release builds log nothing that could hold user data). */
function logDev(e: unknown) {
  if ((globalThis as { __DEV__?: boolean }).__DEV__) console.warn('[RepProof]', e);
}

/** Server error codes we explain; everything else gets a generic line (never raw database text). */
export function friendlyError(e: unknown): string {
  logDev(e);
  const code = (e as { code?: string })?.code;
  const msg = String((e as { message?: string })?.message ?? '');
  if (code === 'P0001' || /rate limit/i.test(msg)) return "You're doing that too often. Try again later.";
  if (code === '23514' || code === '22023') return 'That value is out of range. Check it and try again.';
  return 'Check your connection and try again.';
}

/** Auth errors mapped to a fixed set of messages (no raw server text, no account-existence hints). */
export function friendlyAuthError(e: { message?: string; code?: string; status?: number }): string {
  logDev(e);
  const m = `${e.code ?? ''} ${e.message ?? ''}`;
  if (/rate|too many|over_.*limit/i.test(m) || e.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (/weak|password.*(short|length|characters)/i.test(m)) return 'Choose a stronger password: at least 8 characters, not a common one.';
  if (/invalid.*(email|format)|email_address_invalid/i.test(m)) return 'Enter a valid email address.';
  if (/signup.*disabled/i.test(m)) return 'Sign-ups are closed right now.';
  return 'Could not sign you in with those details. Check them, or create an account if you are new.';
}
