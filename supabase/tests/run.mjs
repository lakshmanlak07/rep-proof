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
  'maintain allowed': 'grant maintain on public.events to authenticated;',
  'sequence usable': 'grant usage on all sequences in schema public to authenticated;',
  'rate-limit table RLS off': 'alter table private.rate_limits disable row level security;',
  'saved workouts editable': 'grant update on public.workouts to authenticated;',
  'server finish time removed': 'drop trigger server_times on public.workouts;',
  'duplicate guard removed': 'drop index public.workouts_client_id;',
  'insert rate limit removed': 'drop trigger rate_limit on public.feedback;',
  'update rate limit removed': 'drop trigger rate_limit_update on public.programs;',
  'size cap removed': 'alter table public.events drop constraint events_props_size;',
  'food quota removed': `create or replace function public.food_search_allowed() returns boolean language sql security definer set search_path = '' as $$ select auth.uid() is not null $$;`,
  'admin metric exposed': 'grant execute on function public.beta_week4_metric() to authenticated;',
  'rate-limit counters readable': 'grant usage on schema private to authenticated; grant select on private.rate_limits to authenticated;',
  'food log owner reassignment allowed': `drop policy own on public.food_logs;
    create policy own on public.food_logs for all using (user_id = auth.uid()) with check (true);`,
  'cardio cross-account edits allowed': `drop policy own on public.cardio_logs;
    create policy own on public.cardio_logs for all using (true) with check (user_id = auth.uid());`,
  'crash reports readable': 'grant select on public.client_errors to authenticated;',
  'crash report rate limit removed': 'drop trigger rate_limit on public.client_errors;',
  'crash report retention removed': 'drop trigger purge_old on public.client_errors;',
  'RPE range check removed': 'alter table public.logged_sets drop constraint logged_sets_rpe_range;',
  'RPE/RIR consistency check removed': 'alter table public.logged_sets drop constraint logged_sets_rpe_matches_rir;',
  'consent time rewritable': 'drop trigger consent_time on public.profiles;',
  'programs deletable': 'grant delete on public.programs to authenticated;',
  'birth year lower bound removed': 'alter table public.profiles drop constraint profiles_birth_year_min;',
  'profiles deletable': 'grant delete on public.profiles to authenticated;',
  'saved meals editable': 'grant update on public.saved_meals to authenticated;',
  'cardio editable': 'grant update on public.cardio_logs to authenticated;',
  'new functions executable by signed-in users': 'alter default privileges for role postgres in schema public grant execute on functions to authenticated;',
  'event times forgeable': 'grant insert on public.events to authenticated;',
  'feedback times forgeable': 'grant insert on public.feedback to authenticated;',
  'plan size cap back to 256 KB': 'alter table public.programs drop constraint programs_plan_size_64k;',
  'program daily limit back to 100': `drop trigger rate_limit on public.programs;
    create trigger rate_limit before insert on public.programs for each row execute function private.enforce_write_limit('100', '1 day');`,
  'new functions executable by default': 'alter default privileges for role postgres grant execute on functions to public;',
  // Same save_workout as migration 6, with only the set order reversed.
  'set order lost': migrations.find(([f]) => f.startsWith('20261009'))[1]
    .match(/create or replace function public\.save_workout[\s\S]*?\n\$\$;/)[0].replace('now() + o * interval', 'now() - o * interval'),
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

// Upgrade path for migration 6 (live project has 1-5): the app sends rpe before and after it is applied.
{
  const db = new PGlite();
  await db.exec(stub);
  const six = migrations.findIndex(([f]) => f.startsWith('20261009'));
  for (const [, sql] of migrations.slice(0, six)) await db.exec(sql);
  const A = 'eeeeeeee-0000-4000-8000-00000000000e';
  const asA = `select set_config('request.jwt.claims', '{"sub":"${A}","role":"authenticated"}', false); set role authenticated;`;
  const save = (rpeSet) => `select public.save_workout(gen_random_uuid(), 'eeeeeeee-0000-4000-8000-0000000000e1', 0, 'Upper A', null, now(), 0, 1,
    '[${JSON.stringify({ exercise_id: 'bb_bench', set_index: 0, weight: 60, reps: 8, rir: 1, ...rpeSet })}]') as id`;
  try {
    await db.exec(`insert into auth.users (id) values ('${A}');
      insert into public.profiles (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes, bodyweight, height_cm, unit)
        values ('${A}', 1990, now(), 'beginner', 'muscle', 'home', 3, 45, 70, 170, 'kg');
      insert into public.programs (id, user_id, split, plan) values ('eeeeeeee-0000-4000-8000-0000000000e1', '${A}', 'full_body', '{}');`);
    await db.exec(asA);
    await db.query(save({ rpe: 8.5 })); // before migration 6: rpe is ignored, the set (with its RIR) is saved
    await db.exec('reset role;');
    const before = (await db.query(`select count(*)::int n, min(rir)::int rir from public.logged_sets where user_id = '${A}'`)).rows[0];
    if (before.n !== 1 || before.rir !== 1) throw new Error(`pre-6 save lost data: ${JSON.stringify(before)}`);
    await db.exec(migrations[six][1]);
    await db.exec(asA);
    await db.query(save({ rpe: 8.5 }));
    await db.exec('reset role;');
    const after = (await db.query(`select count(*)::int n, count(rpe)::int with_rpe from public.logged_sets where user_id = '${A}'`)).rows[0];
    if (after.n !== 2 || after.with_rpe !== 1) throw new Error(`post-6 rows wrong: ${JSON.stringify(after)}`);
    console.log('PASS migration 6 upgrade path: saves with rpe work before it (RIR kept), existing rows survive it, rpe is stored after it');
  } catch (e) {
    console.log('TEST ERROR: migration 6 upgrade path:', e.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// The newest migration is not applied to the beta project yet: running it twice by mistake must be harmless.
{
  const db = new PGlite();
  await db.exec(stub);
  for (const [, sql] of migrations) await db.exec(sql);
  const [f, last] = migrations[migrations.length - 1];
  try {
    await db.exec(last);
    console.log(`PASS ${f} can be re-run without error`);
  } catch (e) {
    console.log(`TEST ERROR: ${f} fails when re-run: ${e.message}`);
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
