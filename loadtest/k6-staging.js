// k6 load test for a STAGING copy of RepProof's backend (Supabase project with migrations 1-7 and the food function).
// Never point this at production: it refuses the production project, and it writes workouts.
// Plan, assumptions and pass criteria: docs/LOAD_TEST_PLAN.md.
//
//   k6 run -e STAGING_REF=<staging-ref> -e STAGING_URL=https://<staging-ref>.supabase.co -e STAGING_KEY=<staging publishable key> \
//          -e USERS_FILE=./users.json -e PEAK_VUS=300 loadtest/k6-staging.js
//
// users.json: [{"email": "...", "password": "..."}], one staging test account per virtual user, created in the
// staging project only. Each account needs a profile and an active program (see the plan's seeding step).
/* global __ENV, __VU, open */ // k6 runtime globals
/* eslint-disable import/no-unresolved */ // k6 modules resolve inside k6, not node
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const PRODUCTION_REF = 'hxxmhnxktgeueugkeday';
const URL = __ENV.STAGING_URL || '';
const KEY = __ENV.STAGING_KEY || '';
if (!URL || !KEY) throw new Error('Set STAGING_URL and STAGING_KEY (staging project only).');
if (URL.includes(PRODUCTION_REF)) throw new Error('Refusing to load-test the production project.');
// Allow-list, not just a deny-list: the URL must be exactly the staging project named in STAGING_REF.
if (!__ENV.STAGING_REF || URL.replace(/\/$/, '') !== `https://${__ENV.STAGING_REF}.supabase.co`) throw new Error('STAGING_URL must be https://<STAGING_REF>.supabase.co');

const users = new SharedArray('users', () => JSON.parse(open(__ENV.USERS_FILE || './users.json')));
const PEAK = Number(__ENV.PEAK_VUS || 300);

export const options = {
  scenarios: {
    // Ramp to the peak, hold (soak), ramp down. Set PEAK_VUS from the capacity model in the plan.
    app: {
      executor: 'ramping-vus',
      stages: [
        { duration: '5m', target: Math.round(PEAK / 3) },
        { duration: '10m', target: PEAK },
        { duration: __ENV.SOAK || '30m', target: PEAK },
        { duration: '5m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_failed{kind:read}': ['rate<0.005'],
    'http_req_failed{kind:write}': ['rate<0.005'],
    'http_req_duration{kind:read}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{kind:write}': ['p(95)<600'],
    'http_req_duration{kind:food}': ['p(95)<2500'],
  },
};

const headers = (token) => ({ apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const sessions = {};

function signIn(u) {
  const r = http.post(`${URL}/auth/v1/token?grant_type=password`, JSON.stringify(u),
    { headers: { apikey: KEY, 'Content-Type': 'application/json' }, tags: { kind: 'auth' } });
  check(r, { 'signed in': (x) => x.status === 200 });
  return r.json('access_token');
}

const get = (token, path) => http.get(`${URL}/rest/v1/${path}`, { headers: headers(token), tags: { kind: 'read' } });
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();

export default function () {
  const u = users[(__VU - 1) % users.length];
  const token = sessions[__VU] || (sessions[__VU] = signIn(u)); // ponytail: no refresh; keep runs under the JWT expiry (1 h default)

  // App start (data.tsx refresh) and the Home tab, as the app issues them.
  const program = get(token, 'programs?select=id,split,plan,next_day&active=eq.true');
  check(program, { 'program 200': (r) => r.status === 200 });
  get(token, 'profiles?select=*');
  get(token, `workouts?select=id,day_name,finished_at,logged_sets(count)&finished_at=not.is.null&finished_at=gte.${daysAgo(120)}&order=finished_at.desc`);
  get(token, `logged_sets?select=exercise_id,weight,workout_id,created_at&created_at=gte.${daysAgo(90)}&order=created_at.desc&limit=1000`);
  sleep(Math.random() * 3 + 2);

  // Fuel tab: today's log plus a food search (the edge function; common terms mostly hit its 30-day cache).
  const today = new Date().toISOString().slice(0, 10);
  get(token, `food_logs?select=id,meal,fdc_id,name,grams,kcal,protein,fat,carbs&logged_on=eq.${today}&order=created_at`);
  const term = ['chicken', 'rice', 'oats', 'banana', 'greek yogurt', 'salmon', 'eggs', 'apple'][Math.floor(Math.random() * 8)];
  const food = http.post(`${URL}/functions/v1/food`, JSON.stringify({ query: term }), { headers: headers(token), tags: { kind: 'food' } });
  check(food, { 'food 200 or 429': (r) => r.status === 200 || r.status === 429 });
  sleep(Math.random() * 5 + 3);

  // Finish a workout about 1 in 10 iterations: the save_workout RPC with 20 sets.
  const programId = program.status === 200 && program.json('0.id');
  if (programId && Math.random() < 0.1) {
    const sets = Array.from({ length: 20 }, (_, i) => ({ exercise_id: 'bb_bench', set_index: i, weight: 60, reps: 8, rir: 2 }));
    const body = { p_client_id: uuidv4(), p_program_id: programId, p_day_index: 0, p_day_name: 'Upper', p_checkin: null,
      p_started_at: daysAgo(1 / 24), p_perf_drops: 0, p_next_day: 1, p_sets: sets };
    const r = http.post(`${URL}/rest/v1/rpc/save_workout`, JSON.stringify(body), { headers: headers(token), tags: { kind: 'write' } });
    check(r, { 'workout saved': (x) => x.status === 200 });
  }
  sleep(Math.random() * 10 + 5);
}
