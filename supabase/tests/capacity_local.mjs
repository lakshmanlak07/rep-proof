// npm run test:capacity: local, single-process capacity check on a disposable PGlite database (never production).
// Seeds many users with realistic history, then times the app's real queries as one signed-in user (RLS on),
// checks each plan uses an index, and times save_workout (triggers on) and delete_account for a heavy user.
// What it shows: per-request cost stays flat as the user count grows. What it cannot show: concurrency,
// connection pooling, network latency or Supabase's own limits; that needs the staging plan in docs/LOAD_TEST_PLAN.md.
// Configure with env vars, e.g. CAP_USERS=5000 CAP_WORKOUTS=150 npm run test:capacity
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const n = (k, d) => Number(process.env[k] ?? d);
const USERS = n('CAP_USERS', 1000);
const WORKOUTS = n('CAP_WORKOUTS', 60); // per user (about 3-4 months at 4 a week)
const SETS = n('CAP_SETS', 20); // per workout
const FOOD_DAYS = n('CAP_FOOD_DAYS', 120); // per user, 5 entries a day
const RUNS = n('CAP_RUNS', 30); // timed runs per query
// Per-request budget on this machine (single process, no network). Generous on purpose: it catches a lost index
// (a sequential scan over ~1M rows), not normal noise.
const BUDGET_MS = n('CAP_BUDGET_MS', 50);

const repo = fileURLToPath(new URL('..', import.meta.url));
const migrations = readdirSync(repo + 'migrations').sort().map((f) => readFileSync(`${repo}migrations/${f}`, 'utf8'));
// Same Supabase stand-in as run.mjs.
const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant anon, authenticated to current_user;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, aud text, role text, instance_id uuid, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const uid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const db = new PGlite();
await db.exec(stub);
for (const sql of migrations) await db.exec(sql);

let t = performance.now();
// Bulk seed with triggers off (rate limits would refuse a year of history in one go); data stays consistent.
await db.exec(`
set session_replication_role = replica;
insert into auth.users (id) select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, ${USERS}) g;
insert into public.profiles (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes, bodyweight, height_cm)
  select id, 1990, now(), 'intermediate', 'muscle', 'commercial', 4, 60, 80, 180 from auth.users;
insert into public.programs (id, user_id, split, plan, active) select gen_random_uuid(), id, 'upper_lower', '{"days":[]}'::jsonb, true from auth.users;
insert into public.workouts (id, user_id, program_id, day_index, day_name, started_at, finished_at)
  select gen_random_uuid(), p.user_id, p.id, w % 4, 'Upper', now() - (w * 2 || ' days')::interval, now() - (w * 2 || ' days')::interval + interval '1 hour'
  from public.programs p, generate_series(1, ${WORKOUTS}) w;
insert into public.logged_sets (user_id, workout_id, exercise_id, set_index, weight, reps, rir, created_at)
  select w.user_id, w.id, 'ex_' || (s % 8), s, 60 + s, 8, 2, w.finished_at + (s || ' seconds')::interval
  from public.workouts w, generate_series(1, ${SETS}) s;
insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs, created_at)
  select u.id, current_date - d, 'lunch', 1000 + e, 'Food ' || e, 100, 200, 10, 5, 20, now() - (d || ' days')::interval + (e || ' minutes')::interval
  from auth.users u, generate_series(0, ${FOOD_DAYS - 1}) d, generate_series(1, 5) e;
set session_replication_role = origin;
analyze;
`);
const counts = (await db.query(`select (select count(*) from public.logged_sets)::int sets, (select count(*) from public.food_logs)::int food,
  (select count(*) from public.workouts)::int workouts`)).rows[0];
console.log(`seeded ${USERS} users: ${counts.workouts} workouts, ${counts.sets} sets, ${counts.food} food logs in ${((performance.now() - t) / 1000).toFixed(1)} s`);

const me = uid(Math.ceil(USERS / 2));
const asUser = async (id) => db.exec(`select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', false); set role authenticated;`);
const asOwner = () => db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);

// The app's own queries (PostgREST translates the supabase-js calls into these), RLS adds the user filter.
const QUERIES = {
  'home: workouts last 120 days + set counts': `select w.id, w.day_name, w.finished_at, (select count(*) from public.logged_sets s where s.workout_id = w.id) from public.workouts w where w.finished_at is not null and w.finished_at >= now() - interval '120 days' order by w.finished_at desc`,
  'home: sets last 90 days (limit 1000)': `select exercise_id, weight, workout_id, created_at from public.logged_sets where created_at >= now() - interval '90 days' order by created_at desc limit 1000`,
  'progress: last 1000 sets': `select exercise_id, weight, reps, rir, workout_id, created_at from public.logged_sets order by created_at desc limit 1000`,
  'workout: one exercise history (limit 60)': `select workout_id, weight, reps, rir, created_at, set_index from public.logged_sets where exercise_id = 'ex_3' order by created_at desc, set_index limit 60`,
  'workout: best weight for exercise': `select weight from public.logged_sets where exercise_id = 'ex_3' order by weight desc limit 1`,
  'fuel: one day of food': `select id, meal, fdc_id, name, grams, kcal from public.food_logs where logged_on = current_date - 3 order by created_at`,
  'fuel: recent foods (limit 60)': `select fdc_id, name, grams, kcal from public.food_logs order by created_at desc limit 60`,
  'fuel: 14-day intake': `select logged_on, kcal, protein from public.food_logs where logged_on >= current_date - 14 limit 2000`,
  'app start: active program': `select id, split, plan, next_day from public.programs where active`,
};

const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const rows = [];
let failed = false;
await asUser(me);
for (const [name, sql] of Object.entries(QUERIES)) {
  const plan = (await db.query(`explain ${sql}`)).rows.map((r) => r['QUERY PLAN']).join('\n');
  const seqOnBig = /Seq Scan on (logged_sets|food_logs|workouts)/.test(plan);
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const s = performance.now();
    await db.query(sql);
    times.push(performance.now() - s);
  }
  const p95 = pct(times, 0.95);
  const ok = !seqOnBig && p95 <= BUDGET_MS;
  if (!ok) failed = true;
  rows.push({ query: name, p50_ms: +pct(times, 0.5).toFixed(2), p95_ms: +p95.toFixed(2), index: seqOnBig ? 'SEQ SCAN' : 'yes', ok });
}

// Writes with every trigger on: a 24-set save_workout by 200 different users.
await asOwner();
const program = async (id) => (await db.query(`select id from public.programs where user_id = $1 and active`, [id])).rows[0].id;
const sets = JSON.stringify(Array.from({ length: 24 }, (_, i) => ({ exercise_id: `ex_${i % 8}`, set_index: i, weight: 60, reps: 8, rir: 2 })));
const saves = [];
for (let i = 1; i <= Math.min(200, USERS); i++) {
  const id = uid(i);
  const pid = await program(id);
  await asUser(id);
  const s = performance.now();
  await db.query(`select public.save_workout(gen_random_uuid(), $1, 0, 'Upper', null, now() - interval '1 hour', 0, 1, $2::jsonb)`, [pid, sets]);
  saves.push(performance.now() - s);
  await asOwner();
}
const saveP95 = pct(saves, 0.95);
rows.push({ query: 'save_workout, 24 sets (triggers on)', p50_ms: +pct(saves, 0.5).toFixed(2), p95_ms: +saveP95.toFixed(2), index: '-', ok: saveP95 <= BUDGET_MS * 4 });
if (saveP95 > BUDGET_MS * 4) failed = true;

// Account deletion for a heavy user: cascade cost (one transaction).
const heavy = uid(USERS);
await asUser(heavy);
let s = performance.now();
await db.query(`select public.delete_account()`);
const del = performance.now() - s;
await asOwner();
const left = (await db.query(`select (select count(*) from public.logged_sets where user_id = $1)::int + (select count(*) from public.food_logs where user_id = $1)::int n`, [heavy])).rows[0].n;
rows.push({ query: `delete_account (${WORKOUTS * SETS} sets, ${FOOD_DAYS * 5} food logs)`, p50_ms: +del.toFixed(2), p95_ms: +del.toFixed(2), index: '-', ok: left === 0 && del < 5000 });
if (left !== 0 || del >= 5000) failed = true;

console.table(rows);
await db.close();
console.log(failed ? 'CAPACITY CHECK FAILED' : `Capacity check passed: every read uses an index and stays under ${BUDGET_MS} ms p95 at ${USERS} users.`);
process.exit(failed ? 1 : 0);
