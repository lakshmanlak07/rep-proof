// npm run test:live:app -- replays the app's own database calls (same tables, columns, RPCs and options as
// src/lib/data.tsx, src/lib/food.ts, src/app/onboarding.tsx and the progress screen) against the LIVE project,
// as the throwaway test account from .env.local (RP_TEST_EMAIL / RP_TEST_PASSWORD).
// It proves the app's data paths still work under the live grants, policies, triggers and limits.
// Prints check names and status codes only. Removes the rows it adds, except the test profile and plan.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

import { buildProgram } from '../../src/engine/plan.ts';

const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]);
const root = new URL('../../', import.meta.url);
const env = Object.fromEntries([...read(new URL('.env', root)), ...read(new URL('.env.local', root))]);
if (!env.RP_TEST_EMAIL || !env.RP_TEST_PASSWORD) {
  console.log('Skipped: add RP_TEST_EMAIL and RP_TEST_PASSWORD for a throwaway account to .env.local.');
  process.exit(0);
}
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let failed = 0;
const report = (good, what, detail) => {
  if (!good) failed++;
  console.log(`${good ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`);
};
const err = (r) => (r.error ? `${r.error.code ?? ''} ${r.status ?? ''}`.trim() : `HTTP ${r.status}`);
const localDate = () => new Date().toLocaleDateString('en-CA');

// Sign in (the app's email sign-in).
const signIn = await supabase.auth.signInWithPassword({ email: env.RP_TEST_EMAIL, password: env.RP_TEST_PASSWORD });
report(!signIn.error, 'sign in', signIn.error ? signIn.error.code : 'session');
if (signIn.error) process.exit(1);
const userId = signIn.data.user.id;

// Onboarding (src/app/onboarding.tsx finish()).
const row = {
  id: userId, birth_year: 1990, disclaimer_accepted_at: new Date().toISOString(), experience: 'intermediate', goal: 'muscle',
  setup: 'commercial', days: 4, session_minutes: 60, bodyweight: 80, height_cm: 180, nutrition_phase: 'maintain', sex: null, unit: 'kg', avoid: [],
};
let r = await supabase.from('profiles').upsert(row);
report(!r.error, 'onboarding: save profile (upsert)', err(r));
const plan = buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] });
r = await supabase.rpc('replace_program', { p_split: plan.split, p_plan: plan, p_next_day: 0 });
report(!r.error, 'onboarding: save plan (replace_program)', err(r));
r = await supabase.from('bodyweight_logs').upsert({ weight: 80 }, { onConflict: 'user_id,logged_on' });
report(!r.error, 'onboarding: first bodyweight (upsert)', err(r));
r = await supabase.from('events').insert({ name: 'onboarding_done', props: { experience: 'intermediate', days: 4 } });
report(!r.error, 'analytics event (insert, no read-back)', err(r));

// App start (DataProvider load).
const p = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
report(!p.error && p.data?.id === userId, 'startup: load profile', err(p));
const g = await supabase.from('programs').select('id, split, plan, next_day').eq('active', true).maybeSingle();
report(!g.error && !!g.data?.id, 'startup: load active plan', err(g));
const program = g.data;

// Workout (src/app/workout.tsx + saveWorkout in src/lib/data.tsx).
const day = program.plan.days[program.next_day];
const ex = day.exercises[0].exerciseId;
r = await supabase.from('logged_sets').select('workout_id, weight, reps, rir, created_at, set_index').eq('exercise_id', ex)
  .order('created_at', { ascending: false }).order('set_index', { ascending: true }).limit(60);
report(!r.error, 'workout: load exercise history', err(r));
r = await supabase.from('logged_sets').select('weight').eq('exercise_id', ex).order('weight', { ascending: false }).limit(1);
report(!r.error, 'workout: load best weight', err(r));
const clientId = crypto.randomUUID();
const save = {
  p_client_id: clientId, p_program_id: program.id, p_day_index: program.next_day, p_day_name: day.name, p_checkin: { sleep: 3, soreness: 3, energy: 3 },
  p_started_at: new Date(Date.now() - 45 * 60000).toISOString(), p_perf_drops: 0, p_next_day: (program.next_day + 1) % program.plan.days.length,
  p_sets: [
    { exercise_id: ex, set_index: 0, weight: 60, reps: 8, rir: 2, overridden: false },
    { exercise_id: ex, set_index: 1, weight: 60, reps: 7, rir: 0, overridden: false },
  ],
};
const s1 = await supabase.rpc('save_workout', save);
report(!s1.error && !!s1.data, 'workout: finish and save (save_workout)', err(s1));
const s2 = await supabase.rpc('save_workout', save);
report(!s2.error && s2.data === s1.data, 'workout: a retried save returns the same workout', err(s2));
const w = await supabase.from('workouts').select('id, finished_at, started_at').eq('id', s1.data).single();
report(!w.error && !!w.data.finished_at && Math.abs(Date.parse(w.data.finished_at) - Date.now()) < 120000, 'workout: saved with a server finish time', err(w));
const sets = await supabase.from('logged_sets').select('id').eq('workout_id', s1.data);
report(!sets.error && sets.data.length === 2, 'workout: both sets saved once', sets.error ? err(sets) : `${sets.data.length} sets`);
const g2 = await supabase.from('programs').select('next_day').eq('id', program.id).single();
report(!g2.error && g2.data.next_day === save.p_next_day, 'workout: plan moved to the next day', err(g2));
r = await supabase.from('workouts').select('finished_at, checkin, perf_drops').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(4);
report(!r.error && r.data.length >= 1, 'home: recent workouts', err(r));
r = await supabase.from('programs').update({ plan: program.plan }).eq('id', program.id);
report(!r.error, 'coach: update plan', err(r));

// Food (src/lib/food.ts).
const item = { fdc_id: 0, name: 'Smoke test oats', grams: 50, kcal: 190, protein: 6.5, fat: 3.5, carbs: 33 };
r = await supabase.from('food_logs').insert([{ ...item, meal: 'breakfast', logged_on: localDate() }]);
report(!r.error, 'food: log food', err(r));
const day1 = await supabase.from('food_logs').select('id, meal, fdc_id, name, grams, kcal, protein, fat, carbs').eq('logged_on', localDate()).order('created_at');
report(!day1.error && day1.data.some((x) => x.name === item.name), "food: today's log", err(day1));
r = await supabase.from('food_logs').select('fdc_id, name, grams, kcal, protein, fat, carbs').order('created_at', { ascending: false }).limit(60);
report(!r.error, 'food: recent foods', err(r));
r = await supabase.from('saved_meals').insert({ name: 'Smoke test meal', items: [item] });
report(!r.error, 'food: save meal', err(r));
const meals = await supabase.from('saved_meals').select('id, name, items').order('created_at', { ascending: false });
report(!meals.error, 'food: saved meals', err(meals));

// Weight and cardio (progress screen).
r = await supabase.from('bodyweight_logs').upsert({ weight: 79.5, logged_on: localDate() }, { onConflict: 'user_id,logged_on' });
report(!r.error, 'weight: log weight (upsert)', err(r));
r = await supabase.from('profiles').update({ bodyweight: 79.5 }).eq('id', userId);
report(!r.error, 'weight: update profile bodyweight', err(r));
r = await supabase.from('bodyweight_logs').select('weight, logged_on').order('logged_on', { ascending: false }).limit(30);
report(!r.error && r.data.length >= 1, 'weight: history', err(r));
r = await supabase.from('cardio_logs').insert({ kind: 'run', minutes: 20, intensity: 'easy', logged_on: localDate() });
report(!r.error, 'cardio: log', err(r));
const cardio = await supabase.from('cardio_logs').select('id, kind, minutes, intensity, logged_on').order('created_at', { ascending: false }).limit(10);
report(!cardio.error, 'cardio: history', err(cardio));

// Feedback (src/app/feedback.tsx).
r = await supabase.from('feedback').insert({ kind: 'feedback', message: 'Automated smoke test (throwaway account)', answers: null });
report(!r.error, 'feedback: send', err(r));

// Clean up the rows this run added (the app's own delete paths where it has them).
const cleanup = [
  await supabase.from('food_logs').delete().eq('name', item.name),
  await supabase.from('saved_meals').delete().eq('name', 'Smoke test meal'),
  await supabase.from('cardio_logs').delete().in('id', (cardio.data ?? []).map((c) => c.id)),
  await supabase.from('workouts').delete().eq('id', s1.data),
];
report(cleanup.every((c) => !c.error), 'cleanup of test rows', cleanup.map(err).join(', '));

// Sign out (the app's "Sign out": global).
const refreshToken = signIn.data.session.refresh_token;
r = await supabase.auth.signOut();
report(!r.error, 'sign out', r.error ? r.error.code : 'ok');
const after = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
  method: 'POST', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }),
});
report(after.status >= 400, 'signed-out session cannot be refreshed', `HTTP ${after.status}`);

console.log(failed ? `${failed} check(s) failed` : 'All app data paths work against the live database.');
process.exit(failed ? 1 : 0);
