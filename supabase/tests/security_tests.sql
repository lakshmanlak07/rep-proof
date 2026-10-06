-- RepProof database security regression tests.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Requires migrations 1-4.
-- Locally / in CI: `npm run test:db` runs the migrations and this file on an in-memory Postgres.
-- Everything runs inside one transaction and is ROLLED BACK at the end: no data is kept.
-- Each check prints "PASS ..." as a notice; any failure stops the script with "FAIL ...".

begin;

-- ── helpers ──
create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  -- assert_failure, not the default P0001: the rate-limit error is P0001 and is caught by the checks below.
  if cond then raise notice 'PASS %', label; else raise exception 'FAIL %', label using errcode = 'assert_failure'; end if;
end $$;
grant execute on function pg_temp.as_user(uuid), pg_temp.as_anon(), pg_temp.ok(boolean, text) to public;

-- ── fixtures (as the database owner, so row-level security does not apply) ──
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'sec-test-a@example.invalid', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'sec-test-b@example.invalid', 'authenticated', 'authenticated');
insert into public.profiles (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes, bodyweight, height_cm, unit)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 1995, now(), 'intermediate', 'muscle', 'commercial', 4, 60, 80, 180, 'kg'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 1990, now(), 'beginner', 'strength', 'home', 3, 45, 70, 170, 'kg');
insert into public.programs (id, user_id, split, plan, next_day) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000000a', 'upper_lower', '{}', 0),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-00000000000b', 'full_body', '{}', 0);
insert into public.workouts (id, user_id, program_id, day_index, day_name, checkin) values
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'Full body A',
   '{"sleep":1,"soreness":5,"energy":1}');
insert into public.logged_sets (user_id, workout_id, exercise_id, set_index, weight, reps, rir) values
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-0000000000b2', 'bb_bench', 0, 60, 8, 2);
insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs) values
  ('bbbbbbbb-0000-4000-8000-00000000000b', current_date, 'lunch', 0, 'B private meal', 100, 200, 10, 5, 20);
insert into public.cardio_logs (user_id, kind, minutes, intensity) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'run', 30, 'easy');
insert into public.saved_meals (user_id, name, items) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'B meal', '[]');
insert into public.bodyweight_logs (user_id, weight) values ('bbbbbbbb-0000-4000-8000-00000000000b', 70);
insert into public.events (user_id, name) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'b_event');
insert into public.feedback (user_id, kind, message) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'feedback', 'B private note');
insert into public.food_cache (key, results) values ('q:test', '[]');

-- ── 1. Cross-account reads (attacker C): user A sees none of user B's rows ──
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  select count(*) into n from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 0, 'A cannot read B profile');
  select count(*) into n from public.profiles; perform pg_temp.ok(n = 1, 'A sees exactly one profile (own)');
  select count(*) into n from public.programs where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 0, 'A cannot read B programs');
  select count(*) into n from public.workouts; perform pg_temp.ok(n = 0, 'A cannot read B workouts or check-ins');
  select count(*) into n from public.logged_sets; perform pg_temp.ok(n = 0, 'A cannot read B sets');
  select count(*) into n from public.food_logs; perform pg_temp.ok(n = 0, 'A cannot read B food logs');
  select count(*) into n from public.cardio_logs; perform pg_temp.ok(n = 0, 'A cannot read B cardio');
  select count(*) into n from public.saved_meals; perform pg_temp.ok(n = 0, 'A cannot read B saved meals');
  select count(*) into n from public.bodyweight_logs; perform pg_temp.ok(n = 0, 'A cannot read B bodyweight');
end $$;
reset role;

do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin select count(*) into n from public.events; perform pg_temp.ok(false, 'users cannot read analytics events');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'users cannot read analytics events'); end;
  begin select count(*) into n from public.feedback; perform pg_temp.ok(false, 'users cannot read feedback');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'users cannot read feedback'); end;
  begin select count(*) into n from public.food_cache; perform pg_temp.ok(false, 'users cannot read the food cache');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'users cannot read the food cache'); end;
  begin select count(*) into n from private.rate_limits; perform pg_temp.ok(false, 'users cannot read rate-limit counters');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'users cannot read rate-limit counters'); end;
end $$;
reset role;

-- ── 2. Cross-account writes: update/delete touch nothing ──
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  update public.profiles set days = 6 where id = 'bbbbbbbb-0000-4000-8000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot update B profile');
  delete from public.logged_sets where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot delete B sets');
  delete from public.workouts; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot delete B workouts');
  delete from public.food_logs; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot delete B food logs');
  delete from public.saved_meals; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot delete B saved meals');
  update public.programs set plan = '{"x":1}' where id = 'bbbbbbbb-0000-4000-8000-0000000000b1'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot change B plan');
  update public.programs set user_id = 'aaaaaaaa-0000-4000-8000-00000000000a' where id = 'bbbbbbbb-0000-4000-8000-0000000000b1'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot take over B plan');
end $$;
reset role;

-- ── 3. Forged user ids and parent rows (attacker E) ──
do $$ begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin
    insert into public.programs (user_id, split, plan, active) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'x', '{}', false);
    perform pg_temp.ok(false, 'A cannot create a program as B');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot create a program as B'); end;
  begin
    insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs)
      values ('bbbbbbbb-0000-4000-8000-00000000000b', current_date, 'lunch', 0, 'x', 1, 1, 1, 1, 1);
    perform pg_temp.ok(false, 'A cannot log food as B');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot log food as B'); end;
  begin
    insert into public.events (user_id, name) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'forged');
    perform pg_temp.ok(false, 'A cannot write events as B');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot write events as B'); end;
  begin
    insert into public.workouts (program_id, day_index, day_name) values ('bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'x');
    perform pg_temp.ok(false, 'A cannot attach a workout to B program');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot attach a workout to B program'); end;
  begin
    insert into public.logged_sets (workout_id, exercise_id, set_index, weight, reps) values ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bb_bench', 1, 100, 1);
    perform pg_temp.ok(false, 'A cannot add sets to B workout');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot add sets to B workout'); end;
end $$;
reset role;

-- ── 4. Privilege escalation (attacker D) ──
do $$ begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin
    update public.profiles set plan_tier = 'pro' where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
    perform pg_temp.ok(false, 'A cannot change own plan_tier');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot change own plan_tier'); end;
  begin
    perform public.beta_week4_metric();
    perform pg_temp.ok(false, 'A cannot run the admin metric');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot run the admin metric'); end;
  begin
    perform private.hit('x', 1000000, interval '1 day');
    perform pg_temp.ok(false, 'A cannot call the private rate limiter');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot call the private rate limiter'); end;
  begin
    truncate public.events;
    perform pg_temp.ok(false, 'A cannot truncate tables (TRUNCATE ignores row-level security)');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot truncate tables (TRUNCATE ignores row-level security)'); end;
end $$;
reset role;

-- A forged "role" claim does not grant anything: the database role is what counts.
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-00000000000a', 'role', 'service_role')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.profiles; perform pg_temp.ok(n = 1, 'forged service_role claim still sees only own profile');
end $$;
reset role;

-- ── 5. Anonymous access (attacker A) ──
do $$ begin
  perform pg_temp.as_anon();
  begin perform count(*) from public.profiles; perform pg_temp.ok(false, 'anonymous cannot read profiles');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot read profiles'); end;
  begin perform count(*) from public.logged_sets; perform pg_temp.ok(false, 'anonymous cannot read sets');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot read sets'); end;
  begin insert into public.events (name) values ('anon'); perform pg_temp.ok(false, 'anonymous cannot write events');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot write events'); end;
  begin perform public.delete_account(); perform pg_temp.ok(false, 'anonymous cannot call delete_account');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot call delete_account'); end;
  begin perform public.food_search_allowed(); perform pg_temp.ok(false, 'anonymous cannot use food search');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot use food search'); end;
  begin perform public.replace_program('x', '{}', 0); perform pg_temp.ok(false, 'anonymous cannot replace programs');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot replace programs'); end;
  begin perform public.save_workout(gen_random_uuid(), gen_random_uuid(), 0, 'x', null, now(), 0, 0, '[]');
    perform pg_temp.ok(false, 'anonymous cannot save workouts');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot save workouts'); end;
end $$;
reset role;

-- ── 6. Size and range caps (attacker E: giant or absurd payloads) ──
do $$ begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin
    insert into public.events (name, props) values ('x', jsonb_build_object('blob', repeat('a', 5000)));
    perform pg_temp.ok(false, 'oversized (even highly compressible) event props refused');
  exception when check_violation then perform pg_temp.ok(true, 'oversized (even highly compressible) event props refused'); end;
  begin
    insert into public.events (name) values (repeat('n', 100));
    perform pg_temp.ok(false, 'long event name refused');
  exception when check_violation then perform pg_temp.ok(true, 'long event name refused'); end;
  begin
    update public.programs set plan = jsonb_build_object('blob', repeat('a', 300000)) where id = 'aaaaaaaa-0000-4000-8000-0000000000a1';
    perform pg_temp.ok(false, 'oversized plan refused');
  exception when check_violation then perform pg_temp.ok(true, 'oversized plan refused'); end;
  begin
    update public.profiles set avoid = array[repeat('p', 900), repeat('q', 900)] where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
    perform pg_temp.ok(false, 'oversized avoid list refused');
  exception when check_violation then perform pg_temp.ok(true, 'oversized avoid list refused'); end;
  begin
    insert into public.food_logs (logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs) values (current_date, 'lunch', 0, 'x', 100, 1e9, 1, 1, 1);
    perform pg_temp.ok(false, 'absurd calories refused');
  exception when check_violation then perform pg_temp.ok(true, 'absurd calories refused'); end;
  begin
    insert into public.feedback (kind, message) values ('feedback', repeat('m', 3000));
    perform pg_temp.ok(false, 'long feedback refused');
  exception when check_violation then perform pg_temp.ok(true, 'long feedback refused'); end;
  begin
    update public.profiles set birth_year = extract(year from now())::int - 10 where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
    perform pg_temp.ok(false, 'under-18 birth year refused');
  exception when check_violation then perform pg_temp.ok(true, 'under-18 birth year refused'); end;
  begin
    insert into public.workouts (program_id, day_index, day_name) values ('aaaaaaaa-0000-4000-8000-0000000000a1', 99, 'x');
    perform pg_temp.ok(false, 'out-of-range day index refused');
  exception when check_violation then perform pg_temp.ok(true, 'out-of-range day index refused'); end;
end $$;
reset role;

-- ── 7. Workout saves: server-authoritative, atomic, idempotent ──
do $$
declare w1 uuid; w2 uuid; n int; t timestamptz;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  w1 := public.save_workout('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', null, now(), 0, 1,
    '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"overridden":false},{"exercise_id":"bb_bench","set_index":1,"weight":60,"reps":8,"rir":0,"overridden":false}]');
  w2 := public.save_workout('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', null, now(), 0, 1,
    '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"overridden":false}]');
  perform pg_temp.ok(w1 = w2, 'same request twice returns the same workout');
  select count(*) into n from public.logged_sets where workout_id = w1; perform pg_temp.ok(n = 2, 'retried save does not duplicate sets');
  select count(*) into n from public.workouts where client_id = 'cccccccc-0000-4000-8000-00000000000c'; perform pg_temp.ok(n = 1, 'retried save creates one workout');
  select count(*) into n from public.workouts where id = w1 and finished_at = now(); perform pg_temp.ok(n = 1, 'finish time is set by the server');
  select next_day into n from public.programs where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'; perform pg_temp.ok(n = 1, 'save moves the plan to the next day');

  -- Same client id through the direct API (the path a concurrent save races on): the unique index refuses it.
  begin
    insert into public.workouts (client_id, program_id, day_index, day_name) values ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x');
    perform pg_temp.ok(false, 'a second workout with the same client id is refused');
  exception when unique_violation then perform pg_temp.ok(true, 'a second workout with the same client id is refused'); end;

  -- Altered completion time through the direct API: the server replaces it.
  insert into public.workouts (program_id, day_index, day_name, finished_at) values ('aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', now() + interval '1 year')
    returning finished_at into t;
  perform pg_temp.ok(t = now(), 'client-supplied finish time is replaced by server time');
  begin
    update public.workouts set finished_at = now() + interval '1 year' where id = w1;
    perform pg_temp.ok(false, 'saved workouts cannot be edited afterwards');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'saved workouts cannot be edited afterwards'); end;
  begin
    update public.logged_sets set weight = 1999 where workout_id = w1;
    perform pg_temp.ok(false, 'saved sets cannot be edited afterwards');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'saved sets cannot be edited afterwards'); end;
  w2 := public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now() + interval '1 day', 0, 1, '[]');
  select count(*) into n from public.workouts where id = w2 and started_at = now(); perform pg_temp.ok(n = 1, 'future start time clamped to server time');
  w2 := public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now() - interval '30 days', 0, 1, '[]');
  select count(*) into n from public.workouts where id = w2 and started_at = now() - interval '1 day'; perform pg_temp.ok(n = 1, 'stale start time clamped to 24 hours');

  -- Another user's program.
  begin
    perform public.save_workout(gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'x', null, now(), 0, 1, '[]');
    perform pg_temp.ok(false, 'cannot save a workout on B program');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'cannot save a workout on B program'); end;

  -- Malformed and oversized payloads.
  begin
    perform public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1, '{"not":"an array"}');
    perform pg_temp.ok(false, 'non-array sets refused');
  exception when invalid_parameter_value then perform pg_temp.ok(true, 'non-array sets refused'); end;
  begin
    perform public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1,
      (select jsonb_agg(jsonb_build_object('exercise_id', 'bb_bench', 'set_index', 0, 'weight', 1, 'reps', 1)) from generate_series(1, 101)));
    perform pg_temp.ok(false, 'more than 100 sets refused');
  exception when invalid_parameter_value then perform pg_temp.ok(true, 'more than 100 sets refused'); end;
  begin
    perform public.save_workout(null, 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1, '[]');
    perform pg_temp.ok(false, 'missing client id refused');
  exception when invalid_parameter_value then perform pg_temp.ok(true, 'missing client id refused'); end;
  begin
    perform public.save_workout('eeeeeeee-0000-4000-8000-00000000000e', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1,
      '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2},{"exercise_id":"bb_bench","set_index":1,"weight":"lots","reps":8}]');
    perform pg_temp.ok(false, 'garbage values refused');
  exception when invalid_text_representation then perform pg_temp.ok(true, 'garbage values refused'); end;
  begin
    perform public.save_workout('eeeeeeee-0000-4000-8000-00000000000e', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1,
      '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2},{"exercise_id":"bb_bench","set_index":1,"weight":60,"reps":-1,"rir":2}]');
    perform pg_temp.ok(false, 'a bad set aborts the whole save');
  exception when check_violation then perform pg_temp.ok(true, 'a bad set aborts the whole save'); end;
  begin
    perform public.save_workout('eeeeeeee-0000-4000-8000-00000000000e', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 99, '[]');
    perform pg_temp.ok(false, 'a bad next day aborts the whole save');
  exception when check_violation then perform pg_temp.ok(true, 'a bad next day aborts the whole save'); end;
  select count(*) into n from public.workouts where client_id = 'eeeeeeee-0000-4000-8000-00000000000e';
  perform pg_temp.ok(n = 0, 'failed saves left nothing half-written');
end $$;
reset role;
do $$
declare n int;
begin
  select next_day into n from public.programs where id = 'bbbbbbbb-0000-4000-8000-0000000000b1';
  perform pg_temp.ok(n = 0, 'B plan position unchanged by A');
end $$;

-- ── 8. Rate limits (attacker F) ──
do $$
declare i int; allowed boolean;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  for i in 1..20 loop insert into public.feedback (kind, message) values ('feedback', 'test'); end loop;
  begin
    insert into public.feedback (kind, message) values ('feedback', 'one too many');
    perform pg_temp.ok(false, '21st feedback in a day is refused');
  exception when raise_exception then perform pg_temp.ok(true, '21st feedback in a day is refused'); end;

  -- A new session (different session id in the token) is the same user: same counters.
  perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-00000000000a', 'role', 'authenticated', 'session_id', gen_random_uuid())::text, true);
  begin
    insert into public.feedback (kind, message) values ('feedback', 'new session');
    perform pg_temp.ok(false, 'a new session does not reset the limit');
  exception when raise_exception then perform pg_temp.ok(true, 'a new session does not reset the limit'); end;

  -- One bulk request counts every row.
  begin
    insert into public.cardio_logs (kind, minutes, intensity) select 'run', 10, 'easy' from generate_series(1, 51);
    perform pg_temp.ok(false, 'a bulk insert over the limit is refused');
  exception when raise_exception then perform pg_temp.ok(true, 'a bulk insert over the limit is refused'); end;

  -- Rewriting a big row repeatedly is limited too.
  begin
    for i in 1..501 loop update public.programs set next_day = 0 where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'; end loop;
    perform pg_temp.ok(false, 'repeated plan rewrites are limited');
  exception when raise_exception then perform pg_temp.ok(true, 'repeated plan rewrites are limited'); end;

  -- Food search: 20 a minute.
  for i in 1..20 loop allowed := public.food_search_allowed(); end loop;
  perform pg_temp.ok(allowed, '20 food searches a minute are allowed');
  allowed := public.food_search_allowed();
  perform pg_temp.ok(not allowed, '21st food search in a minute is refused');
end $$;
reset role;

do $$ begin
  -- B's counters are separate: A's spam does not lock B out.
  perform pg_temp.as_user('bbbbbbbb-0000-4000-8000-00000000000b');
  insert into public.feedback (kind, message) values ('feedback', 'B is fine');
  perform pg_temp.ok(true, 'limits are per user');
end $$;
reset role;

-- ── 9. Account deletion removes only the caller's data ──
do $$ begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  perform public.delete_account();
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.profiles where id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'deleted account: profile gone');
  select count(*) into n from public.workouts where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'deleted account: workouts gone');
  select count(*) into n from public.feedback where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'deleted account: feedback gone');
  select count(*) into n from private.rate_limits where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'deleted account: rate-limit counters gone');
  select count(*) into n from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 1, 'other accounts untouched');
  raise notice 'ALL SECURITY TESTS PASSED';
end $$;

rollback;
