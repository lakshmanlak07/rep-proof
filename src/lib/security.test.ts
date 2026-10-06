// Security regression tests for app-side controls. Run with `npm test`.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { MAX_BODY, parseRequest } from '../../supabase/functions/food/request.ts';
import { chunkedStore, type SecureKV } from './chunked.ts';
import { friendlyAuthError, friendlyError } from './errors.ts';
import { safeLink } from './links.ts';

test('database errors never reach the user', () => {
  const raw = [
    { code: '42501', message: 'new row violates row-level security policy for table "logged_sets"' },
    { code: '23505', message: 'duplicate key value violates unique constraint "workouts_client_id"' },
    { code: '23514', message: 'new row for relation "events" violates check constraint "events_props_size"' },
    { code: 'PGRST301', message: 'JWT expired' },
    new Error('relation "private.rate_limits" does not exist at /var/lib/postgres'),
  ];
  for (const e of raw) {
    const shown = friendlyError(e);
    assert.ok(!/row-level|logged_sets|workouts|events|constraint|private|JWT|postgres|relation/i.test(shown), shown);
  }
  assert.match(friendlyError({ code: 'P0001', message: 'rate limit exceeded' }), /too often/);
});

test('sign-in and sign-up errors do not reveal whether an account exists', () => {
  const unknownEmail = friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 });
  const wrongPassword = friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 });
  const alreadyRegistered = friendlyAuthError({ code: 'user_already_exists', message: 'User already registered', status: 422 });
  const unconfirmed = friendlyAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 });
  assert.equal(unknownEmail, wrongPassword);
  assert.equal(alreadyRegistered, unknownEmail);
  assert.equal(unconfirmed, unknownEmail);
  assert.ok(!/already|registered|exists|confirm/i.test(unknownEmail));
});

test('deep links: normal links pass, malformed or oversized links go home', () => {
  assert.equal(safeLink('/workout'), '/workout');
  assert.equal(safeLink('/exercise/bb_bench?from=plan&note=a%20b'), '/exercise/bb_bench?from=plan&note=a%20b');
  assert.equal(safeLink('/food?q=%E0%A4%A'), '/');
  assert.equal(safeLink('/x?' + '%'.repeat(50) + 'zz'), '/');
  assert.equal(safeLink('/x?q=' + 'a'.repeat(5000)), '/');
});

function memoryStore() {
  const m = new Map<string, string>();
  const kv: SecureKV = { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), del: async (k) => void m.delete(k) };
  return { m, kv };
}

test('secure session storage: chunks, round trip, shrink, remove', async () => {
  const { m, kv } = memoryStore();
  const store = chunkedStore(kv);
  const session = JSON.stringify({ access_token: 'x'.repeat(3000), refresh_token: 'r', user: { id: 'u' } });
  await store.setItem('sb-abc-auth-token', session);
  assert.equal(await store.getItem('sb-abc-auth-token'), session);
  for (const [k, v] of m) {
    assert.match(k, /^[A-Za-z0-9._-]+$/);
    assert.ok(v.length <= 1800, 'each secure-store entry stays under the platform limit');
  }
  await store.setItem('sb-abc-auth-token', 'short');
  assert.equal(await store.getItem('sb-abc-auth-token'), 'short');
  assert.equal(m.size, 2, 'old chunks are removed when the value shrinks');
  await store.removeItem('sb-abc-auth-token');
  assert.equal(m.size, 0);
  assert.equal(await store.getItem('sb-abc-auth-token'), null);
});

test('secure session storage: a missing chunk reads as signed out, never as a corrupt session', async () => {
  const { m, kv } = memoryStore();
  const store = chunkedStore(kv);
  await store.setItem('k', 'y'.repeat(4000));
  m.delete('k.1');
  assert.equal(await store.getItem('k'), null);
});

test('secure session storage: old plain-text session is moved once and erased', async () => {
  const { kv } = memoryStore();
  const legacy = new Map([['sb-abc-auth-token', '{"access_token":"old"}']]);
  const store = chunkedStore(kv, { getItem: (k) => legacy.get(k) ?? null, removeItem: (k) => void legacy.delete(k) });
  assert.equal(await store.getItem('sb-abc-auth-token'), '{"access_token":"old"}');
  assert.equal(legacy.size, 0, 'plain-text copy erased');
  assert.equal(await store.getItem('sb-abc-auth-token'), '{"access_token":"old"}');
});

test('secure session storage: a fresh install does not inherit a Keychain session', async () => {
  const { kv } = memoryStore();
  await chunkedStore(kv).setItem('k', 'previous install');
  const store = chunkedStore(kv, undefined, true);
  assert.equal(await store.getItem('k'), null);
  await store.setItem('k', 'new');
  assert.equal(await store.getItem('k'), 'new', 'only wiped once');
});

test('food function rejects malformed, oversized and odd requests', () => {
  assert.deepEqual(parseRequest('{"query":"  Greek   YOGURT "}'), { key: 'q:greek yogurt', query: 'greek yogurt' });
  assert.deepEqual(parseRequest('{"upc":"0 12345-67890 5"}'), { key: 'upc:012345678905', upc: '012345678905' });
  assert.equal((parseRequest('x'.repeat(MAX_BODY + 1)) as { status: number }).status, 413);
  for (const bad of ['not json', '[]', 'null', '42', '{}', '{"query":5}', '{"query":{"$ne":1}}', '{"upc":"12"}', '{"upc":"abc"}', '{"query":"   "}', '{"upc":["1"]}']) {
    assert.equal((parseRequest(bad) as { status: number }).status, 400, bad);
  }
  const long = parseRequest(JSON.stringify({ query: 'a'.repeat(500) })) as { query: string };
  assert.equal(long.query.length, 100);
  const ctrl = parseRequest(JSON.stringify({ query: 'oats\u0000\n\u001b[31m' })) as { query: string };
  assert.equal(ctrl.query, 'oats [31m');
});

test('analytics never receive health answers', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !f.endsWith('.test.ts')) files.push(p);
    }
  };
  walk(fileURLToPath(new URL('..', import.meta.url)));
  const calls = files.flatMap((f) => readFileSync(f, 'utf8').match(/track\([^)]*\)/g) ?? []);
  assert.ok(calls.length > 10, 'found the analytics calls');
  for (const c of calls) {
    assert.ok(!/sleep|soreness|energy|pain|bad:|checkin:\s*[a-z]+\.checkin\b/i.test(c) || /checkin: !!/.test(c), c);
  }
});
