// npm run test:live:auth -- session and enumeration checks that need a real (throwaway) account.
// 1. Create a test account in the app (not your real one).
// 2. Put its details in .env.local (git-ignored): RP_TEST_EMAIL=... and RP_TEST_PASSWORD=...
// 3. Run while CAPTCHA is off (password sign-in needs a CAPTCHA token once it is on).
// It signs the test account in and out, and sends it one password-reset email. It changes no data.
import { existsSync, readFileSync } from 'node:fs';

const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]);
const root = new URL('../../', import.meta.url);
const env = Object.fromEntries([...read(new URL('.env', root)), ...read(new URL('.env.local', root))]);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = env.RP_TEST_EMAIL;
const PASSWORD = env.RP_TEST_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.log('Skipped: add RP_TEST_EMAIL and RP_TEST_PASSWORD for a throwaway account to .env.local.');
  process.exit(0);
}

let failed = 0;
const report = (good, what, detail) => {
  if (!good) failed++;
  console.log(`${good ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`);
};
const req = async (path, { method = 'POST', body, token } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, code: json.error_code ?? json.code, json, text };
};
const signIn = (email, password) => req('/auth/v1/token?grant_type=password', { body: { email, password } });
const refresh = (refresh_token) => req('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const first = await signIn(EMAIL, PASSWORD);
if (first.code === 'captcha_failed') {
  console.log('Skipped: CAPTCHA is on, so a script cannot sign in. Run this before rollout step 4.');
  process.exit(0);
}
report(first.status === 200, 'test account signs in', `HTTP ${first.status}`);
if (first.status !== 200) process.exit(1);

// Account enumeration: wrong password for a real account vs an address with no account.
const wrong = await signIn(EMAIL, `${PASSWORD}-wrong`);
const unknown = await signIn(`rp-probe-${Date.now()}@example.com`, `${PASSWORD}-wrong`);
report(wrong.status === unknown.status && wrong.code === unknown.code, 'wrong password and unknown email get identical answers', `${wrong.status}/${wrong.code} vs ${unknown.status}/${unknown.code}`);
const recReal = await req('/auth/v1/recover', { body: { email: EMAIL } });
const recNone = await req('/auth/v1/recover', { body: { email: `rp-probe-${Date.now()}@example.com` } });
report(recReal.status === recNone.status && recReal.text === recNone.text, 'password reset answers identically for real and unknown emails', `${recReal.status} vs ${recNone.status}`);

// Tampered token: same signature, different user id.
const [h, p, s] = first.json.access_token.split('.');
const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
const forged = `${h}.${Buffer.from(JSON.stringify({ ...claims, sub: '00000000-0000-4000-8000-000000000000' })).toString('base64url')}.${s}`;
report((await req('/rest/v1/profiles?select=id', { method: 'GET', token: forged })).status === 401, 'token with an edited user id is refused');
report(claims.exp - claims.iat <= 3600, 'access tokens live at most an hour', `${claims.exp - claims.iat} s`);

// Refresh token rotation and reuse detection.
const r1 = await refresh(first.json.refresh_token);
report(r1.status === 200 && r1.json.refresh_token !== first.json.refresh_token, 'refresh issues a new refresh token', `HTTP ${r1.status}`);
await sleep(12000); // past Supabase's reuse interval (10 s)
const replay = await refresh(first.json.refresh_token);
report(replay.status >= 400, 'replaying a used refresh token is refused', `HTTP ${replay.status} ${replay.code ?? ''}`);
const after = await refresh(r1.json.refresh_token);
report(after.status >= 400, 'replay revokes the whole session (reuse detection on)', after.status >= 400 ? `HTTP ${after.status}` : 'still valid: turn on "Detect and revoke potentially compromised refresh tokens"');

// Global sign-out (what the app's "Sign out" and password reset do).
const second = await signIn(EMAIL, PASSWORD);
const out = await req('/auth/v1/logout?scope=global', { token: second.json.access_token });
report(out.status === 204, 'global sign-out accepted', `HTTP ${out.status}`);
report((await refresh(second.json.refresh_token)).status >= 400, 'refresh token is dead after sign-out');
report((await req('/auth/v1/user', { method: 'GET', token: second.json.access_token })).status >= 400, 'Auth refuses the access token after sign-out');
const data = await req('/rest/v1/profiles?select=id', { method: 'GET', token: second.json.access_token });
console.log(`info  the database API still accepts that access token until it expires (HTTP ${data.status}); this is how Supabase JWTs work, so keep JWT expiry short`);

console.log(failed ? `${failed} check(s) failed` : 'All account checks passed.');
process.exit(failed ? 1 : 0);
