// Release features: RPE, glossary, crash-report scrubbing, data export CSV, adherence.
// Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RPE_OPTIONS, rirFromRpe, rpeFromRir, targetLabel } from '../engine/effort.ts';
import { GLOSSARY, searchGlossary } from '../engine/glossary.ts';
import { REFERENCES } from '../engine/references.ts';
import { CAUTIONS, TOPICS } from '../engine/science.ts';
import { csvField, toCsv } from './csv.ts';
import { scrub } from './scrub.ts';
import { adherence, readiness } from './stats.ts';
import { parseRpe, prepareSave, rowProblem } from './workoutSave.ts';

test('RPE converts to reps in reserve, half steps rounding toward failure', () => {
  assert.equal(rirFromRpe(10), 0);
  assert.equal(rirFromRpe(9), 1);
  assert.equal(rirFromRpe(8.5), 1, 'uncertain rating never makes a set look easier');
  assert.equal(rirFromRpe(8), 2);
  assert.equal(rirFromRpe(6), 4);
  assert.throws(() => rirFromRpe(8.3));
  assert.throws(() => rirFromRpe(11));
  assert.equal(rpeFromRir(2), 8);
  assert.equal(rpeFromRir(6), 6, '4+ RIR shows as RPE 6');
  assert.equal(targetLabel(2, 'rpe'), 'RPE 8');
  assert.equal(targetLabel(0, 'rir'), 'to failure');
  assert.deepEqual([...RPE_OPTIONS], [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
});

test('RPE saves with the set; bad values are caught before saving', () => {
  assert.equal(parseRpe('8,5'), 8.5);
  assert.equal(parseRpe(''), null);
  assert.equal(parseRpe('8.3'), undefined);
  assert.match(rowProblem({ weight: '60', reps: '8', rir: '2', rpe: '11' })!, /RPE/);
  const r = prepareSave([{ exerciseId: 'bb_bench', name: 'Bench', suggestion: { weight: 60, reps: 8 }, sets: [
    { weight: '60', reps: '8', rir: '2', rpe: '8', done: true },
    { weight: '60', reps: '8', rir: '1', done: true },
  ] }]);
  assert.deepEqual(r.problems, []);
  assert.equal(r.sets[0].rpe, 8);
  assert.equal(r.sets[1].rpe, null, 'RPE optional');
  // Rated RPE 8 (= 2 RIR), then changed to 0 RIR: the stale RPE is dropped instead of failing the whole save.
  const stale = prepareSave([{ exerciseId: 'bb_bench', name: 'Bench', suggestion: { weight: 60, reps: 8 }, sets: [
    { weight: '60', reps: '8', rir: '0', rpe: '8', done: true },
    { weight: '60', reps: '8', rir: '', rpe: '8', done: true },
  ] }]);
  assert.deepEqual(stale.problems, []);
  assert.deepEqual(stale.sets.map((x) => [x.rir, x.rpe]), [[0, null], [null, null]]);
});

test('glossary: every term links a real topic; topics cite real references', () => {
  const titles = new Set(TOPICS.map((t) => t.title));
  for (const g of GLOSSARY) {
    assert.ok(g.meaning.length > 20, g.term);
    if (g.topic) assert.ok(titles.has(g.topic), `${g.term} -> missing topic ${g.topic}`);
  }
  for (const t of TOPICS) for (const id of t.refIds) assert.ok(REFERENCES[id], `${t.title} cites missing ${id}`);
  assert.ok(searchGlossary('rpe').some((g) => g.also === 'RPE'));
  assert.equal(searchGlossary('').length, GLOSSARY.length);
  // No creator is presented as an authority anywhere in the library or glossary.
  const text = JSON.stringify({ GLOSSARY, TOPICS, CAUTIONS }).toLowerCase();
  for (const name of ['israetel', 'nippard', 'helms', 'nuckols', 'henselmans', 'norton', 'staley', 'ethier', 'yotalks', 'malloy']) {
    assert.ok(!text.includes(name), `creator named: ${name}`);
  }
  assert.ok(CAUTIONS.some((c) => /community post/i.test(c)));
});

test('crash reports never carry tokens, keys, passwords or emails', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  const out = scrub(`Failed with token ${jwt} for jane.doe@example.com password=hunter22 apikey: sb_secret_abc123XYZ https://x.supabase.co/rest/v1/foo?apikey=zzz&select=*`);
  for (const bad of [jwt, 'jane.doe@example.com', 'hunter22', 'sb_secret_abc123XYZ', 'apikey=zzz']) assert.ok(!out.includes(bad), `leaked ${bad}: ${out}`);
  assert.match(scrub(`session ${jwt} expired`), /session \[jwt\] expired/, 'bare tokens are caught too');
  assert.match(scrub('Call +44 7700 900123 now'), /\[number\]/);
  assert.equal(scrub('TypeError: x is undefined at Workout (index.bundle:12:34)'), 'TypeError: x is undefined at Workout (index.bundle:12:34)', 'ordinary stacks survive');
  assert.ok(scrub('a'.repeat(900)).length <= 500);
  // Prefixed and quoted key names, and bearer tokens after a header name.
  for (const leak of ['refresh_token=abcdefghijkl', '{"password":"hunter2hunter2"}', 'Authorization: Bearer abcdefghijkl', "access_token: 'abcdefghijkl'"]) {
    assert.ok(!/abcdefghijkl|hunter2hunter2/.test(scrub(leak)), `leaked: ${scrub(leak)}`);
  }
});

test('data export CSV: quoting and spreadsheet formula injection', () => {
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvField(-5), '-5', 'negative numbers stay numbers');
  assert.equal(csvField(null), '');
  assert.equal(toCsv([{ a: 1, b: 'x' }, { a: 2 }], ['a', 'b']), 'a,b\r\n1,x\r\n2,\r\n');
});

test('adherence: planned vs done per week; an unfinished current week does not count against you', () => {
  const now = new Date(2026, 9, 7, 12); // Wednesday 7 Oct 2026
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 18).toISOString();
  const done = [at(2026, 8, 28), at(2026, 8, 30), at(2026, 9, 2), at(2026, 9, 6)]; // 3 last week, 1 this week
  const a = adherence(done, 3, 2, now);
  assert.equal(a.weeks.length, 2);
  assert.equal(a.weeks[0].done, 3);
  assert.equal(a.weeks[1].done, 1);
  assert.equal(a.pct, 100, 'only the full week counts while this week is in progress');
  assert.equal(a.activeWeeks, 2);
  assert.equal(adherence([], 3, 4, now).pct, 0);
  assert.equal(adherence([at(2026, 8, 28), at(2026, 8, 29), at(2026, 8, 30), at(2026, 9, 1)], 3, 2, now).pct, 100, 'extra sessions do not push past 100%');
});

test('intake trend: per-day totals, and days without entries are gaps, not zeros', async () => {
  const { dailyTotals } = await import('./portion.ts');
  const t = dailyTotals([
    { logged_on: '2026-10-08', kcal: 1200.4, protein: 80 }, { logged_on: '2026-10-08', kcal: 800, protein: 40.6 },
    { logged_on: '2026-10-06', kcal: 2100, protein: 150 }, { logged_on: '2026-09-01', kcal: 9999, protein: 1 },
  ], 4, new Date(2026, 9, 9, 10));
  assert.deepEqual(t.map((d) => d.day), ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.deepEqual(t.map((d) => d.logged), [true, false, true, false]);
  assert.equal(t[2].kcal, 2000);
  assert.equal(t[2].protein, 121);
  assert.equal(t[1].kcal, 0, 'unlogged day carries logged: false, so the chart shows a gap');
});

test('data export covers every table: each one is exported or explicitly excluded with a reason', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { EXPORTED, NOT_EXPORTED } = await import('./exportTables.ts');
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const tables = new Set<string>();
  for (const f of readdirSync(dir)) {
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/create table (?:if not exists )?(?:public|private)\.([a-z_]+)/g)) tables.add(m[1]);
  }
  assert.ok(tables.size >= 10);
  for (const t of tables) {
    const inExport = t in EXPORTED;
    const excluded = t in NOT_EXPORTED;
    assert.ok(inExport !== excluded, `${t} must be exported or excluded with a reason (exactly one)`);
  }
  for (const t of [...Object.keys(EXPORTED), ...Object.keys(NOT_EXPORTED)]) assert.ok(tables.has(t), `${t} is listed but no migration creates it`);
});

test('BUG-1: a light lift that keeps missing reps is held, never "dropped" to 0 kg', async () => {
  const { suggest } = await import('../engine/progression.ts');
  const plan = { exerciseId: 'db_lateral_raise', sets: 2, repMin: 10, repMax: 15, rirTarget: 2 };
  const miss = (w: number) => [{ weight: w, reps: 6, rir: 0 }, { weight: w, reps: 5, rir: 0 }];
  for (const unit of ['kg', 'lb'] as const) {
    const w = unit === 'kg' ? 2.5 : 5;
    const s = suggest(plan, [miss(w), miss(w)], 'intermediate', unit);
    assert.ok(s.weight !== null && s.weight > 0, `${unit}: suggested ${s.weight}`);
    assert.equal(s.kind, 'hold');
  }
  // A normal drop still happens when there is room to drop.
  assert.equal(suggest(plan, [miss(10), miss(10)], 'intermediate', 'kg').kind, 'drop');
  // Bodyweight lifts logged at 0 added load are never "dropped" below 0.
  const bw = suggest(plan, [miss(0), miss(0)], 'intermediate', 'kg');
  assert.ok(bw.weight === 0);
});

test('BUG-2: readiness without any check-in says so instead of claiming "Ready"', () => {
  const none = readiness([null, null], false);
  assert.notEqual(none.label, 'Ready');
  assert.equal(none.score, null, 'no invented score');
  assert.equal(readiness([], false).label, 'No check-in yet');
  assert.equal(readiness([{ sleep: 5, soreness: 4, energy: 5 }], false).label, 'Ready');
  assert.equal(readiness([{ sleep: 1, soreness: 2, energy: 2 }], false).label, 'Run down');
  assert.equal(readiness([null, { sleep: 3, soreness: 3, energy: 3 }], false).label, 'Moderate', 'uses the latest real check-in');
  assert.equal(readiness([{ sleep: 5, soreness: 5, energy: 5 }], true).label, 'Deload');
});

test('BUG-4 guard: analytics events never carry check-ins, body data, foods, lifts or identities', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(x); } };
  walk(root);
  const forbidden = /\b(sleep|soreness|energy|weight|bodyweight|kcal|calories|protein|grams|name|email|phone|rir|rpe|reps|message|birth|height|sex|userId|user_id)\b\s*[:,}]/i;
  let calls = 0;
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/track\('([a-z_]+)'(?:,\s*(\{[^}]*\}))?\)/g)) {
      calls++;
      const props = m[2] ?? '';
      assert.ok(!forbidden.test(props) && !/\bcheckin\s*:(?!\s*!!)/.test(props), `${f}: event ${m[1]} carries a sensitive field: ${props}`);
    }
  }
  assert.ok(calls >= 20, `found ${calls} track() calls`);
  // A payload passed as a variable could not be checked here; safeProps() still filters it at runtime.
  const all = files.reduce((n, x) => n + (readFileSync(x, 'utf8').match(/(?<!function )\btrack\(/g)?.length ?? 0), 0);
  assert.equal(all, calls, 'every track() call uses a literal payload (or none)');
});

test('release config guard: identity, no cloud backup of app data, unused permissions stay blocked', async () => {
  const { readFileSync } = await import('node:fs');
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo;
  assert.equal(app.android.package, 'com.repproof.app', 'changing the package id creates a different Play app');
  assert.equal(app.android.allowBackup, false, 'SEC-10: app storage (draft check-ins) must not go to cloud backup');
  for (const p of ['com.google.android.c2dm.permission.RECEIVE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.USE_BIOMETRIC',
    'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.RECEIVE_BOOT_COMPLETED']) {
    assert.ok(app.android.blockedPermissions.includes(p), `${p} must stay blocked`);
  }
  assert.equal(app.plugins.find((x: unknown) => Array.isArray(x) && x[0] === 'expo-camera')?.[1]?.recordAudioAndroid, false, 'no microphone');
  assert.ok(!/localhost|127\.0\.0\.1|example\.(com|invalid)|TODO/i.test(JSON.stringify(app)), 'no placeholder or local URLs in app config');
});

test('analytics allowlist: only declared properties of known events ever leave the phone', async () => {
  const { safeProps, EVENT_SCHEMA } = await import('./eventProps.ts');
  // Allowed, minimal events still work.
  assert.deepEqual(safeProps('workout_finished', { sets: 12, checkin: true }), { sets: 12, checkin: true });
  assert.deepEqual(safeProps('food_logged', { meal: 'lunch', source: 'usda' }), { meal: 'lunch', source: 'usda' });
  assert.deepEqual(safeProps('onboarding_done', { experience: 'beginner', setup: 'home', goal: 'muscle', days: 3, split: 'full_body' }),
    { experience: 'beginner', setup: 'home', goal: 'muscle', days: 3, split: 'full_body' });
  // Sensitive data riding along on a known event is dropped, whatever it is called or however it is shaped.
  const hostile = {
    sets: 12, checkin: { sleep: 1, soreness: 2, energy: 3 }, // check-in answers in place of the boolean
    weight: 100, reps: 5, rir: 2, rpe: 8, Weight: 100, WEIGHT_KG: 100, load: 120, bodyweight: 80, height_cm: 180, bodyFat: 20,
    email: 'a@b.c', Email: 'a@b.c', userId: 'u', user_id: 'u', uid: 'u', phone: '1', username: 'x', accessToken: 'eyJx',
    refresh_token: 'r', Authorization: 'Bearer x', password: 'p', name: 'Oats', foodName: 'Oats', kcal: 300, grams: 50,
    nested: { email: 'a@b.c' }, list: ['a@b.c'],
  };
  assert.deepEqual(safeProps('workout_finished', hostile), { sets: 12 }, 'only the declared field survives');
  // Declared fields with the wrong type are dropped, not coerced.
  assert.equal(safeProps('workout_finished', { sets: '12', checkin: 'yes' }), undefined);
  assert.equal(safeProps('workout_finished', { sets: NaN, checkin: null }), undefined);
  assert.equal(safeProps('workout_finished', { sets: Infinity }), undefined);
  // Key casing is exact: 'Sets' is not 'sets'.
  assert.equal(safeProps('workout_finished', { Sets: 12 }), undefined);
  // Oversized strings are capped.
  assert.equal((safeProps('science_topic', { topic: 'x'.repeat(5000) })!.topic as string).length, 64);
  // Unknown events and malformed payloads carry no properties at all.
  assert.equal(safeProps('totally_new_event', { anything: 1 }), undefined);
  assert.equal(safeProps('__proto__', { sets: 1 }), undefined);
  assert.equal(safeProps('workout_finished', null), undefined);
  assert.equal(safeProps('workout_finished', undefined), undefined);
  assert.equal(safeProps('workout_finished', [12, true]), undefined);
  assert.equal(safeProps('workout_finished', 42), undefined);
  const circular: Record<string, unknown> = { sets: 3 }; circular.self = circular;
  assert.deepEqual(safeProps('workout_finished', circular), { sets: 3 });
  const trap = Object.defineProperty({}, 'sets', { get() { throw new Error('boom'); }, enumerable: true });
  assert.equal(safeProps('workout_finished', trap), undefined, 'a throwing getter is skipped, never crashes');
  // The schema itself declares no sensitive field names.
  const sensitive = /^(sleep|soreness|energy|weight|bodyweight|kcal|calories|protein|fat|carbs|grams|name|email|phone|rir|rpe|reps|message|birth|height|sex|user_?id|token|password)$/i;
  for (const [event, schema] of Object.entries(EVENT_SCHEMA)) for (const key of Object.keys(schema)) assert.ok(!sensitive.test(key), `${event}.${key} is sensitive`);
});

test('analytics call sites match the allowlist exactly (no event silently loses or leaks data)', async () => {
  const { EVENT_SCHEMA } = await import('./eventProps.ts');
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(x); } };
  walk(root);
  const used = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/track\('([a-z_]+)'(?:,\s*\{([^}]*)\})?\)/g)) {
      used.add(m[1]);
      assert.ok(m[1] in EVENT_SCHEMA, `${f}: event ${m[1]} is not in EVENT_SCHEMA (its properties would be dropped)`);
      const keys = (m[2] ?? '').split(',').map((x) => x.split(':')[0].trim()).filter(Boolean);
      for (const k of keys) assert.ok(k in EVENT_SCHEMA[m[1]], `${f}: ${m[1]}.${k} is not declared in EVENT_SCHEMA`);
    }
  }
  for (const e of Object.keys(EVENT_SCHEMA)) assert.ok(used.has(e), `EVENT_SCHEMA has ${e} but nothing sends it`);
});

test('export paging: every row exactly once at page boundaries; errors abort', async () => {
  const { pageAll } = await import('./exportTables.ts');
  for (const n of [0, 1, 999, 1000, 1001, 2500, 3000]) {
    const rows = Array.from({ length: n }, (_, i) => i);
    let calls = 0;
    const got = await pageAll(async (from, to) => { calls++; return rows.slice(from, to + 1); });
    assert.deepEqual(got, rows, `${n} rows`);
    assert.equal(calls, Math.floor(n / 1000) + 1, `${n} rows: page requests`);
  }
  await assert.rejects(pageAll(async (from) => { if (from > 0) throw new Error('network'); return Array(1000).fill(0); }), /network/);
});

test('weight trend vs phase (H-02): needs enough data, uses the trend, flags only clear drifts', async () => {
  const { weightTrendCheck } = await import('../engine/nutrition.ts');
  const today = new Date('2026-10-09T09:00:00Z');
  const series = (start: number, perDay: number, days: number[]) => days.map((d) => ({ weight: start + perDay * d, logged_on: new Date(Date.UTC(2026, 9, 9 - 21 + d)).toISOString().slice(0, 10) }));
  const days = [0, 3, 7, 10, 14, 17, 21];
  // Not enough data: say nothing.
  assert.equal(weightTrendCheck([], 'cut', today), null);
  assert.equal(weightTrendCheck(series(80, -0.1, [0, 3, 7]), 'cut', today), null, 'fewer than 4 weigh-ins');
  assert.equal(weightTrendCheck(series(80, -0.1, [14, 16, 18, 21]), 'cut', today), null, 'spans under 14 days');
  assert.equal(weightTrendCheck(series(80, -0.1, days).map((w) => ({ ...w, logged_on: '2026-08-01' })), 'cut', today), null, 'old weigh-ins ignored');
  // 80 kg losing 0.2 kg/day = 1.4 kg/week ≈ 1.8%/week: too fast for a cut.
  const fast = weightTrendCheck(series(80, -0.2, days), 'cut', today)!;
  assert.equal(fast.tone, 'warn'); assert.ok(fast.perWeekPct < -1 && fast.perWeekPct > -2.2); assert.match(fast.text, /eating a little more/);
  // 0.08 kg/day ≈ 0.7%/week: fine for a cut, too fast for a gain (mirrored), steady fails for maintenance.
  assert.equal(weightTrendCheck(series(80, -0.08, days), 'cut', today)!.tone, 'pos');
  assert.equal(weightTrendCheck(series(80, 0.08, days), 'gain', today)!.tone, 'warn');
  assert.equal(weightTrendCheck(series(80, 0.03, days), 'gain', today)!.tone, 'pos');
  assert.equal(weightTrendCheck(series(80, 0, days), 'cut', today)!.tone, 'warn', 'a cut that is not dropping');
  assert.equal(weightTrendCheck(series(80, 0, days), 'maintain', today)!.tone, 'pos');
  assert.equal(weightTrendCheck(series(80, -0.08, days), 'recomp', today)!.tone, 'warn');
  // One outlier day does not flip a steady trend.
  const noisy = series(80, 0, days); noisy[3] = { ...noisy[3], weight: 82 };
  assert.equal(weightTrendCheck(noisy, 'maintain', today)!.tone, 'pos');
  // Bad values are ignored, never NaN.
  assert.ok(Number.isFinite(weightTrendCheck([...series(80, 0, days), { weight: NaN, logged_on: '2026-10-08' }], 'maintain', today)!.perWeekPct));
  assert.equal(fast.explanation.label, 'rule');
});

test('weekly trend (J-02): completed weeks only, week boundaries, missing RIR is not zero, 4-week averages', async () => {
  const { weeklyTrend } = await import('./stats.ts');
  const now = new Date(2026, 9, 9, 12); // Friday 9 Oct 2026, local time
  const at = (y: number, m: number, d: number, h = 18) => new Date(y, m, d, h).toISOString();
  assert.equal(weeklyTrend([], now), null);
  assert.equal(weeklyTrend([{ created_at: at(2026, 8, 30), rir: 2 }], now), null, 'one week is not a trend');
  assert.equal(weeklyTrend([{ created_at: at(2026, 9, 6), rir: 2 }, { created_at: at(2026, 9, 7), rir: 2 }], now), null, 'the current week alone is not counted');
  const sets = [
    { created_at: at(2026, 8, 21), rir: 2 }, { created_at: at(2026, 8, 21), rir: 0 }, // week of 21 Sep: 2 sets, avg 1
    // week of 28 Sep: nothing logged
    { created_at: at(2026, 9, 4, 23), rir: null }, // Sunday night: still the week of 28 Sep
    { created_at: at(2026, 9, 5, 0), rir: 3 }, // Monday 00:00: week of 5 Oct = this week, still filling up: left out
    { created_at: 'not a date', rir: 1 },
  ];
  const t = weeklyTrend(sets, now)!;
  assert.equal(t.length, 2, '21 Sep and 28 Sep (the current week 5 Oct is not complete)');
  assert.deepEqual(t.map((w) => w.sets), [2, 1], 'Sunday 23:00 belongs to the week before Monday 00:00');
  assert.deepEqual(t.map((w) => w.avgRir), [1, null], 'a week whose only set has no RIR has no average, not 0');
  assert.deepEqual(t.map((w) => w.rirSets), [2, 0]);
  assert.deepEqual(t.map((w) => w.setsAvg4), [2, 1.5]);
  assert.deepEqual(t.map((w) => w.rirAvg4), [1, 1], 'weighted by sets: (2 + 0) / 2; the missing RIR is not counted');
  const longer = weeklyTrend([...sets, { created_at: at(2026, 8, 14), rir: 3 }], now)!;
  assert.deepEqual(longer.map((w) => w.rirAvg4), [3, 1.7, 1.7], 'weighted by sets: (3 + 2 + 0) / 3');
  // An empty week in the middle counts as 0 sets.
  const gap = weeklyTrend([{ created_at: at(2026, 8, 14), rir: 2 }, { created_at: at(2026, 8, 30), rir: 2 }], now)!;
  assert.deepEqual(gap.map((w) => w.sets), [1, 0, 1]);
  // Out-of-range RIR is ignored for the average; the window is capped.
  assert.equal(weeklyTrend([{ created_at: at(2026, 8, 21), rir: 99 }, { created_at: at(2026, 8, 30), rir: -1 }], now)!.every((w) => w.avgRir === null), true);
  assert.equal(weeklyTrend([{ created_at: at(2020, 0, 1), rir: 2 }, { created_at: at(2026, 8, 30), rir: 2 }], now)!.length, 26);
  // Future-dated rows are ignored.
  assert.equal(weeklyTrend([{ created_at: at(2027, 0, 1), rir: 2 }], now), null);
});

test('RIR calibration (E-02): isolation only, strict validation, honest summary', async () => {
  const { calibrationResult, calibrationSummary, canCalibrate, CALIBRATION_WHY } = await import('../engine/calibration.ts');
  const { EXERCISE_BY_ID } = await import('../engine/exercises.ts');
  const { REFERENCES } = await import('../engine/references.ts');
  assert.equal(canCalibrate(EXERCISE_BY_ID.bb_squat), false, 'never on a heavy compound');
  assert.equal(canCalibrate(EXERCISE_BY_ID.cable_fly), true);
  assert.equal(canCalibrate(undefined), false);
  // Valid: noted 10 reps at "2 left", reached 14: actually 4 left, 2 more than guessed.
  const r = calibrationResult(2, '10', '14');
  assert.ok(r.ok && r.actual === 4 && r.gap === 2 && /2 more than you thought/.test(r.text));
  const exact = calibrationResult(3, 8, 11);
  assert.ok(exact.ok && exact.gap === 0 && /Spot on/.test(exact.text));
  const over = calibrationResult(3, 8, 9);
  assert.ok(over.ok && over.gap === -2 && /2 fewer/.test(over.text));
  // Boundaries and invalid input: never a result from bad numbers.
  for (const [p, g, t] of [[0, 10, 12], [6, 10, 12], [2.5, 10, 12], [2, '', 12], [2, '0', 5], [2, '10.5', 12], [2, '10', '9'], [2, '51', '55'], [2, '10', '61'], [2, '-3', '5'], [2, 'ten', '12'], [2, '1e1', '12']] as const) {
    assert.equal(calibrationResult(p as number, g as string, t as string).ok, false, `${p}/${g}/${t} must be refused`);
  }
  assert.ok(calibrationResult(1, 50, 60).ok && calibrationResult(5, 1, 1).ok, 'inclusive bounds; total = guess means 0 left');
  // Summary: nothing without data, no tendency below 3, direction from the signed mean.
  assert.equal(calibrationSummary([]), null);
  const e = (predicted: number, actual: number) => ({ exerciseId: 'cable_fly', predicted, actual, at: '2026-10-09' });
  assert.match(calibrationSummary([e(2, 4)])!.text, /A few more are needed/);
  const under = calibrationSummary([e(2, 4), e(2, 3), e(1, 3)])!;
  assert.equal(under.bias, 1.7); assert.equal(under.meanAbs, 1.7); assert.match(under.text, /more left than you guessed/);
  assert.match(calibrationSummary([e(3, 1), e(3, 2), e(2, 1)])!.text, /less left than you guessed/);
  assert.match(calibrationSummary([e(2, 3), e(2, 1), e(2, 2)])!.text, /no clear lean/);
  for (const id of CALIBRATION_WHY.refIds) assert.ok(REFERENCES[id], `${id} is a real reference`);
});
