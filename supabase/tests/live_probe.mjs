// npm run test:live -- probes the live Supabase project as an outsider (no account, forged tokens).
// Read-only: it creates, changes and sends nothing. Uses the public URL and publishable key from .env.
// Run after applying migration 4; every line should say "ok".
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) throw new Error('.env needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sub = '00000000-0000-4000-8000-000000000000';
const TOKENS = {
  garbage: 'not-a-token',
  'unsigned (alg none)': `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: 4102444800 })}.`,
  'forged signature': `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'service_role', exp: 4102444800 })}.${'A'.repeat(43)}`,
  expired: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: 1000000000 })}.${'A'.repeat(43)}`,
};
const TABLES = ['profiles', 'programs', 'workouts', 'logged_sets', 'events', 'cardio_logs', 'food_logs', 'saved_meals', 'food_cache', 'bodyweight_logs', 'feedback'];

let failed = 0;
const report = (good, what, detail) => {
  if (!good) failed++;
  console.log(`${good ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`);
};
const call = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
};
// Denied = an error status, or (before migration 4) an empty list filtered by row-level security.
const denied = (r) => r.status >= 400 || r.text.trim() === '[]';

// Attacker A: no account.
for (const t of TABLES) {
  const r = await call(`/rest/v1/${t}?select=*&limit=1`);
  report(denied(r), `anonymous read of ${t}`, `HTTP ${r.status}`);
}
for (const [t, body] of [['events', { name: 'probe' }], ['feedback', { kind: 'feedback', message: 'probe' }]]) {
  const r = await call(`/rest/v1/${t}`, { method: 'POST', body });
  report(r.status === 401 || r.status === 403, `anonymous insert into ${t}`, `HTTP ${r.status}`);
}
for (const fn of ['delete_account', 'beta_week4_metric', 'food_search_allowed']) {
  const r = await call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: {} });
  report(r.status >= 400, `anonymous call of ${fn}()`, `HTTP ${r.status}`);
}
{
  const r = await call('/rest/v1/rpc/replace_program', { method: 'POST', body: { p_split: 'x', p_plan: {}, p_next_day: 0 } });
  report(r.status >= 400, 'anonymous call of replace_program()', `HTTP ${r.status}`);
}
{
  const r = await call('/functions/v1/food', { method: 'POST', body: { query: 'oats' } });
  report(r.status === 401 || r.status === 404, 'food function without a user token', `HTTP ${r.status}${r.status === 404 ? ', not deployed' : ''}`);
}

// Attacker E: forged, unsigned and expired tokens.
for (const [name, token] of Object.entries(TOKENS)) {
  const r = await call('/rest/v1/profiles?select=*&limit=1', { token });
  report(r.status === 401 || r.status === 403, `${name} token refused by the database API`, `HTTP ${r.status}`);
  const a = await call('/auth/v1/user', { token });
  report(a.status === 401 || a.status === 403, `${name} token refused by Auth`, `HTTP ${a.status}`);
}

// Errors must not leak internals (stack traces, server paths, SQL).
{
  const r = await call('/rest/v1/profiles?select=*&id=eq.not-a-uuid', { token: TOKENS.garbage });
  report(!/at \w+ \(|\/var\/|\/usr\/|stack/i.test(r.text), 'error bodies contain no stack traces or server paths');
}

// Migration 4 applied? (the anonymous role then gets "permission denied" instead of an empty list)
{
  const r = await call('/rest/v1/profiles?select=id&limit=1');
  report(r.status === 401 || r.status === 403, 'migration 4 applied (anonymous role has no table privileges)', `HTTP ${r.status}`);
}

console.log(failed ? `${failed} check(s) failed` : 'All live probes passed.');
process.exit(failed ? 1 : 0);
