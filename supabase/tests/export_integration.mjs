// Integration test for "Download my data" and account deletion, on a disposable in-memory Postgres with every
// migration and real row-level security. The app's own export code (src/lib/exportCore.ts) runs through a small
// client that executes each page query as the signed-in user, the way PostgREST does. Never touches a real project.
// Usage: node supabase/tests/export_integration.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const stub = readFileSync(repo + 'tests/run.mjs', 'utf8').match(/const stub = `([\s\S]*?)`;/)[1];
const { collectExportWith } = await import(pathToFileURL(repo + '../src/lib/exportCore.ts').href);
const { EXPORTED } = await import(pathToFileURL(repo + '../src/lib/exportTables.ts').href);

const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const db = new PGlite();
await db.exec(stub);
for (const f of readdirSync(repo + 'migrations').sort()) await db.exec(readFileSync(`${repo}migrations/${f}`, 'utf8'));

// Fixtures (as the owner): A has 2,503 sets and 1,001 food logs (both cross the 1,000-row page size); B has a few.
await db.exec(`
  insert into auth.users (id) values ('${A}'), ('${B}');
  insert into public.profiles (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes, bodyweight, height_cm, unit) values
    ('${A}', 1995, now(), 'intermediate', 'muscle', 'commercial', 4, 60, 80, 180, 'kg'),
    ('${B}', 1990, now(), 'beginner', 'strength', 'home', 3, 45, 70, 170, 'kg');
  insert into public.programs (id, user_id, split, plan) values
    ('aaaaaaaa-0000-4000-8000-0000000000a1', '${A}', 'upper_lower', '{}'), ('bbbbbbbb-0000-4000-8000-0000000000b1', '${B}', 'full_body', '{}');
  insert into public.workouts (id, user_id, program_id, day_index, day_name) values
    ('aaaaaaaa-0000-4000-8000-0000000000a2', '${A}', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A'),
    ('bbbbbbbb-0000-4000-8000-0000000000b2', '${B}', 'bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'Full body A');
  insert into public.logged_sets (user_id, workout_id, exercise_id, set_index, weight, reps, rir)
    select '${A}', 'aaaaaaaa-0000-4000-8000-0000000000a2', 'bb_bench', i % 50, 60 + (i % 10), 8, 2 from generate_series(1, 2503) i;
  insert into public.logged_sets (user_id, workout_id, exercise_id, set_index, weight, reps, rir)
    select '${B}', 'bbbbbbbb-0000-4000-8000-0000000000b2', 'bb_squat', i, 100, 5, 1 from generate_series(1, 7) i;
  insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs)
    select '${A}', current_date, 'lunch', 0, 'A food ' || i, 100, 100, 5, 2, 10 from generate_series(1, 1001) i;
  insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs)
    values ('${B}', current_date, 'dinner', 0, 'B private meal', 100, 200, 10, 5, 20);
  insert into public.bodyweight_logs (user_id, weight, logged_on) values ('${A}', 80, current_date), ('${B}', 70, current_date);
  insert into public.client_errors (user_id, message) values ('${A}', 'A crash');`);

const asUser = async (uid) => {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: 'authenticated' })}', false); set role authenticated;`);
};
const asOwner = () => db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);

/** Minimal PostgREST stand-in: runs select/eq/order/range as the current database role (RLS applies). */
const client = (opts = {}) => ({
  pages: 0,
  from(table) {
    const self = this;
    const q = { filters: [], orderBy: null };
    const chain = {
      eq(col, v) { q.filters.push([col, v]); return chain; },
      order(col) { q.orderBy = col; return chain; },
      async range(from, to) {
        self.pages++;
        if (opts.failOnPage && self.pages === opts.failOnPage) return { data: null, error: { code: '08006', message: 'connection lost' } };
        const where = q.filters.map(([c], i) => `"${c}" = $${i + 1}`).join(' and ') || 'true';
        const sql = `select row_to_json(t) as r from public."${table}" t where ${where}${q.orderBy ? ` order by "${q.orderBy}"` : ''} limit ${to - from + 1} offset ${from}`;
        try {
          const res = await db.query(sql, q.filters.map(([, v]) => v));
          return { data: res.rows.map((x) => x.r), error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },
    };
    return { select: () => chain };
  },
});

let failed = 0;
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`); if (!cond) failed++; };

// 1. A's export: complete, no duplicates, nothing of B's.
await asUser(A);
const c = client();
const out = await collectExportWith(c, A, 'a@example.invalid', new Date('2026-10-09T12:00:00Z'));
const data = JSON.parse(out.json).data;
const sets = data.logged_sets;
ok(sets.length === 2503, `all 2,503 sets exported across ${Math.ceil(2503 / 1000)} pages (got ${sets.length})`);
ok(new Set(sets.map((s) => s.id)).size === sets.length, 'no set exported twice');
ok(sets.every((s) => s.user_id === A), "every exported set is A's");
ok(data.food_logs.length === 1001 && new Set(data.food_logs.map((f) => f.id)).size === 1001, 'all 1,001 food logs exactly once (1,000-row boundary + 1)');
ok(!out.json.includes('B private meal') && !out.json.includes(B), "nothing of B's appears anywhere in A's export");
ok(Object.keys(data).sort().join() === Object.keys(EXPORTED).sort().join(), 'every exported table is present');
ok(data.profiles.length === 1 && data.profiles[0].id === A, "profile is A's only");
ok(out.csv.split('\r\n').filter(Boolean).length === 2504, 'CSV has a header and one line per set');
ok(!('client_errors' in data) && 'client_errors' in JSON.parse(out.json).not_included, 'write-only tables are listed as not included, with a reason');

// 2. A wrong owner filter cannot widen the export: row-level security still returns only A's rows.
const sneaky = { from: (t) => { const real = client().from(t); return { select: () => { const ch = real.select(); return { eq: () => ch, order: (x) => ch.order(x), range: (a, b) => ch.range(a, b) }; } }; } };
const widened = JSON.parse((await collectExportWith(sneaky, B, null)).json).data;
ok(widened.logged_sets.every((s) => s.user_id === A) && !JSON.stringify(widened).includes('B private meal'), "asking for B's id while signed in as A still returns only A's rows");

// 3. A failure mid-export rejects; no partial file.
let rejected = false;
try { await collectExportWith(client({ failOnPage: 3 }), A, null); } catch { rejected = true; }
ok(rejected, 'a failed page aborts the export instead of returning partial data');

// 4. Empty account exports cleanly.
await asOwner();
await db.exec(`insert into auth.users (id) values ('cccccccc-0000-4000-8000-0000000000c1');`);
await asUser('cccccccc-0000-4000-8000-0000000000c1');
const empty = JSON.parse((await collectExportWith(client(), 'cccccccc-0000-4000-8000-0000000000c1', null)).json).data;
ok(Object.values(empty).every((rows) => rows.length === 0), 'an account with no data exports empty lists, no error');

// 5. Deleting one workout (what deleteWorkout() sends): A's own goes, with its sets; B's cannot be touched.
await asOwner();
await db.exec(`insert into public.workouts (id, user_id, program_id, day_index, day_name) values
    ('aaaaaaaa-0000-4000-8000-0000000000a3', '${A}', 'aaaaaaaa-0000-4000-8000-0000000000a1', 1, 'Lower A');
  insert into public.logged_sets (user_id, workout_id, exercise_id, set_index, weight, reps, rir)
    select '${A}', 'aaaaaaaa-0000-4000-8000-0000000000a3', 'bb_squat', i, 100, 5, 2 from generate_series(0, 2) i;`);
await asUser(A);
const del = async (id) => (await db.query(`delete from public.workouts where id = $1 returning id`, [id])).rows.length;
ok((await del('aaaaaaaa-0000-4000-8000-0000000000a3')) === 1, 'A deletes its own workout (one row confirmed back)');
ok((await db.query(`select count(*)::int n from public.logged_sets where workout_id = 'aaaaaaaa-0000-4000-8000-0000000000a3'`)).rows[0].n === 0, "the deleted workout's sets are gone");
ok((await db.query(`select count(*)::int n from public.logged_sets where user_id = '${A}'`)).rows[0].n === 2503, "A's other sets are untouched");
ok((await del('bbbbbbbb-0000-4000-8000-0000000000b2')) === 0, "A deleting B's workout returns zero rows (the app reports \"not found\")");
await asOwner();
ok((await db.query(`select count(*)::int n from public.logged_sets where user_id = '${B}'`)).rows[0].n === 7, "B's workout and sets survive A's attempt");

// 6. Journey on the real schema: save a workout the way the app does (save_workout RPC, with RPE), see it in
// history, this week's volume and the export; delete it; it is gone from all three. B never sees it.
await asUser(A);
const clientId = 'aaaaaaaa-0000-4000-8000-0000000000c9';
const journeySets = JSON.stringify([
  { exercise_id: 'cable_fly', set_index: 0, weight: 20, reps: 12, rir: 1, rpe: 8.5 },
  { exercise_id: 'cable_fly', set_index: 1, weight: 20, reps: 11, rir: 0 },
]);
const saved = (await db.query(`select public.save_workout($1, 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', '{"sleep":4,"soreness":3,"energy":4}', now() - interval '1 hour', 0, 1, $2::jsonb) as id`, [clientId, journeySets])).rows[0].id;
const again = (await db.query(`select public.save_workout($1, 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', null, now(), 0, 1, $2::jsonb) as id`, [clientId, journeySets])).rows[0].id;
ok(again === saved, 'a retried save with the same client id returns the same workout (no duplicate)');
const history = (await db.query(`select id, finished_at is not null as done, checkin from public.workouts where id = $1`, [saved])).rows[0];
ok(history?.done && history.checkin?.sleep === 4, 'the saved workout is in history, finished, with its check-in');
const weekSets = async () => (await db.query(`select count(*)::int n from public.logged_sets where exercise_id = 'cable_fly' and created_at >= date_trunc('week', now())`)).rows[0].n;
ok((await weekSets()) === 2, "this week's volume counts its 2 sets");
const rpeRow = (await db.query(`select rpe::float, rir from public.logged_sets where workout_id = $1 and set_index = 0`, [saved])).rows[0];
ok(rpeRow.rpe === 8.5 && rpeRow.rir === 1, 'RPE 8.5 stored with RIR 1');
ok(JSON.parse((await collectExportWith(client(), A, null)).json).data.workouts.some((w) => w.id === saved), 'the export includes it');
await asUser(B);
ok((await db.query(`select count(*)::int n from public.workouts where id = $1`, [saved])).rows[0].n === 0, 'B cannot see it');
await asUser(A);
ok((await del(saved)) === 1, 'deleting it is confirmed');
ok((await weekSets()) === 0 && !JSON.parse((await collectExportWith(client(), A, null)).json).data.workouts.some((w) => w.id === saved), "after deletion it is gone from this week's volume and the export");

// 7. Deletion: A deletes their account; every A row is gone, B is untouched.
await asUser(A);
await db.exec('select public.delete_account();');
await asOwner();
const count = async (sql) => (await db.query(sql)).rows[0].n;
let left = 0;
for (const [t, col] of Object.entries(EXPORTED)) left += await count(`select count(*)::int n from public.${t} where ${col} = '${A}'`);
for (const t of ['events', 'feedback', 'client_errors']) left += await count(`select count(*)::int n from public.${t} where user_id = '${A}'`);
left += await count(`select count(*)::int n from auth.users where id = '${A}'`);
ok(left === 0, `after delete_account, no row of A remains in any table (found ${left})`);
ok((await count(`select count(*)::int n from public.logged_sets where user_id = '${B}'`)) === 7 && (await count(`select count(*)::int n from public.food_logs where user_id = '${B}'`)) === 1, "B's data is untouched");

await db.close();
console.log(failed ? `${failed} export/deletion check(s) failed` : 'Export and deletion integration verified.');
process.exit(failed ? 1 : 0);
