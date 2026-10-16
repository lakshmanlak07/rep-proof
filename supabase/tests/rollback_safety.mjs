// Proves security_tests.sql leaves a database exactly as it found it, both when it passes and when it fails
// partway: pre-existing rows (including old crash reports the purge trigger would delete) survive, and no
// fixture rows, counters or policies remain. Runs on a disposable in-memory Postgres; never on a real project.
// Usage: node supabase/tests/rollback_safety.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const stub = readFileSync(repo + 'tests/run.mjs', 'utf8').match(/const stub = `([\s\S]*?)`;/)[1];
const migrations = readdirSync(repo + 'migrations').sort().map((f) => readFileSync(`${repo}migrations/${f}`, 'utf8'));
const tests = readFileSync(`${repo}tests/security_tests.sql`, 'utf8').replace(/\r\n/g, '\n');

const EXISTING = 'eeeeeeee-1111-4111-8111-111111111111'; // stands in for a real user already in the database
const snapshot = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows[0].n;
  return {
    users: await q('select count(*)::int n from auth.users'),
    profiles: await q('select count(*)::int n from public.profiles'),
    workouts: await q('select count(*)::int n from public.workouts'),
    food: await q('select count(*)::int n from public.food_logs'),
    crashes: await q('select count(*)::int n from public.client_errors'),
    cache: await q('select count(*)::int n from public.food_cache'),
    limits: await q('select count(*)::int n from private.rate_limits'),
    policies: await q('select count(*)::int n from pg_policies'),
    existingUser: await q(`select count(*)::int n from auth.users where id = '${EXISTING}'`),
  };
};

async function fresh() {
  const db = new PGlite();
  await db.exec(stub);
  for (const m of migrations) await db.exec(m);
  // Pre-existing data, as on a live project: a user with a profile, a food log, and a 100-day-old crash report.
  await db.exec(`
    insert into auth.users (id) values ('${EXISTING}');
    insert into public.profiles (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes, bodyweight, height_cm, unit)
      values ('${EXISTING}', 1990, now(), 'beginner', 'muscle', 'home', 3, 45, 80, 180, 'kg');
    insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs)
      values ('${EXISTING}', current_date, 'lunch', 0, 'real meal', 100, 100, 1, 1, 1);
    insert into public.client_errors (user_id, message, created_at) values ('${EXISTING}', 'old real crash', now() - interval '100 days');
    insert into public.food_cache (key, results) values ('q:oats', '[]');`);
  return db;
}

let failed = 0;
const same = (a, b, label) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : `\n  before ${JSON.stringify(a)}\n  after  ${JSON.stringify(b)}`}`);
  if (!ok) failed++;
};

// 1. Full run (ends in ROLLBACK).
{
  const db = await fresh();
  const before = await snapshot(db);
  await db.exec(tests);
  same(before, await snapshot(db), 'full run leaves every table, counter and policy unchanged (old crash report kept)');
  await db.close();
}

// 2. Failure partway through (after fixtures, the account deletion and the crash-report purge have run).
{
  const db = await fresh();
  const before = await snapshot(db);
  const cut = tests.lastIndexOf('rollback;');
  const broken = tests.slice(0, cut) + "do $$ begin raise exception 'injected failure'; end $$;\n" + tests.slice(cut);
  let threw = false;
  try { await db.exec(broken); } catch { threw = true; }
  // The SQL editor (or psql) then ends the session; an aborted transaction is rolled back, never committed.
  await db.exec('rollback;');
  console.log(`${threw ? 'PASS' : 'FAIL'} injected failure stops the script`);
  if (!threw) failed++;
  same(before, await snapshot(db), 'failed run leaves every table, counter and policy unchanged');
  await db.close();
}

console.log(failed ? `${failed} rollback-safety check(s) failed` : 'Rollback safety verified.');
process.exit(failed ? 1 : 0);
