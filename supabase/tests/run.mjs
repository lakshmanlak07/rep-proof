// npm run test:db: emulates the bits of Supabase the migrations rely on, runs every migration, then the security tests.
// Then it removes one security control at a time and checks the tests catch it (so a passing run means something).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const migrations = readdirSync(repo + 'migrations').sort().map((f) => [f, readFileSync(`${repo}migrations/${f}`, 'utf8')]);
const tests = readFileSync(`${repo}tests/security_tests.sql`, 'utf8');

// Supabase stand-in: API roles, auth.users, auth.uid() from the JWT claims, Supabase's default grants.
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

async function suite(mutation = '') {
  const db = new PGlite();
  const notices = [];
  await db.exec(stub);
  for (const [f, sql] of migrations) {
    try { await db.exec(sql); } catch (e) { return { ok: false, notices, error: `migration ${f} failed: ${e.message}` }; }
  }
  if (mutation) await db.exec(mutation);
  try {
    await db.exec(tests, { onNotice: (n) => notices.push(n.message) });
    return { ok: true, notices };
  } catch (e) {
    return { ok: false, notices, error: e.message };
  } finally {
    await db.close();
  }
}

// Each one weakens a single control; the suite must fail for every one.
const MUTATIONS = {
  'row-level security off': 'alter table public.food_logs disable row level security;',
  'workout ownership check removed': `drop policy own on public.workouts;
    create policy own on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());`,
  'plan_tier writable': 'grant update (plan_tier) on public.profiles to authenticated;',
  'anonymous grants back': 'grant all on all tables in schema public to anon;',
  'events readable': 'grant select on public.events to authenticated;',
  'truncate allowed': 'grant truncate on public.events to authenticated;',
  'saved workouts editable': 'grant update on public.workouts to authenticated;',
  'server finish time removed': 'drop trigger server_times on public.workouts;',
  'duplicate guard removed': 'drop index public.workouts_client_id;',
  'insert rate limit removed': 'drop trigger rate_limit on public.feedback;',
  'update rate limit removed': 'drop trigger rate_limit_update on public.programs;',
  'size cap removed': 'alter table public.events drop constraint events_props_size;',
  'food quota removed': `create or replace function public.food_search_allowed() returns boolean language sql security definer set search_path = '' as $$ select auth.uid() is not null $$;`,
  'admin metric exposed': 'grant execute on function public.beta_week4_metric() to authenticated;',
  'rate-limit counters readable': 'grant usage on schema private to authenticated; grant select on private.rate_limits to authenticated;',
};

const base = await suite();
console.log(base.notices.join('\n'));
if (!base.ok) { console.log('TEST ERROR:', base.error); process.exit(1); }

// Migration 4 must apply on a database that already holds rows breaking its new limits (the beta project).
{
  const db = new PGlite();
  await db.exec(stub);
  for (const [, sql] of migrations.filter(([f]) => f < '20261006')) await db.exec(sql);
  await db.exec(`
    insert into auth.users (id) values ('dddddddd-0000-4000-8000-00000000000d');
    insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs)
      values ('dddddddd-0000-4000-8000-00000000000d', current_date, 'lunch', 0, repeat('n', 300), 100, 1, 1, 1, 1);
    insert into public.events (user_id, name, props) values ('dddddddd-0000-4000-8000-00000000000d', 'old', jsonb_build_object('x', repeat('a', 3000)));`);
  try {
    for (const [f, sql] of migrations.filter(([f]) => f >= '20261006')) await db.exec(sql);
    console.log('PASS migration 4 applies over older rows that exceed its new limits');
  } catch (e) {
    console.log('TEST ERROR: migration 4 fails on existing data:', e.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

let missed = 0;
for (const [name, sql] of Object.entries(MUTATIONS)) {
  const r = await suite(sql);
  console.log(`${r.ok ? 'MISSED' : 'caught'}: ${name}${r.ok ? '' : ` (${r.error})`}`);
  if (r.ok) missed++;
}
if (missed) { console.log(`${missed} weakened control(s) went unnoticed`); process.exit(1); }
console.log(`All ${Object.keys(MUTATIONS).length} weakened controls were caught.`);
