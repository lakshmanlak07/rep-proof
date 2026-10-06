-- RepProof database security regression tests.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Requires migrations 1-4.
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
  if cond then raise notice 'PASS %', label; else raise exception 'FAIL %', label; end if;
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
insert into public.workouts (id, user_id, program_id, day_index, day_name, finished_at) values
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'Full body A', now());
insert into public.logged_sets (user_id, workout_id, exercise_id, set_index, weight, reps, rir) values
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-0000000000b2', 'bb_bench', 0, 60, 8, 2);
insert into public.food_logs (user_id, logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs) values
  ('bbbbbbbb-0000-4000-8000-00000000000b', current_date, 'lunch', 0, 'B private meal', 100, 200, 10, 5, 20);

-- ── 1. Cross-account reads: user A sees none of user B's rows ──
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  select count(*) into n from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 0, 'A cannot read B profile');
  select count(*) into n from public.profiles; perform pg_temp.ok(n = 1, 'A sees exactly one profile (own)');
  select count(*) into n from public.programs where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 0, 'A cannot read B programs');
  select count(*) into n from public.workouts; perform pg_temp.ok(n = 0, 'A cannot read B workouts');
  select count(*) into n from public.logged_sets; perform pg_temp.ok(n = 0, 'A cannot read B sets');
  select count(*) into n from public.food_logs; perform pg_temp.ok(n = 0, 'A cannot read B food logs');
  select count(*) into n from public.food_cache; perform pg_temp.ok(n = 0, 'users cannot read the food cache');
end $$;
reset role;

-- ── 2. Cross-account writes: update/delete touch nothing; forged inserts are refused ──
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  update public.profiles set days = 6 where id = 'bbbbbbbb-0000-4000-8000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot update B profile');
  delete from public.logged_sets where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot delete B sets');
  delete from public.food_logs; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot delete B food logs');
  update public.programs set plan = '{"x":1}' where id = 'bbbbbbbb-0000-4000-8000-0000000000b1'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A cannot change B plan');
end $$;
reset role;

do $$ begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin
    insert into public.programs (user_id, split, plan, active) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'x', '{}', false);
    perform pg_temp.ok(false, 'A cannot create a program as B');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot create a program as B'); end;
  begin
    insert into public.workouts (program_id, day_index, day_name) values ('bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'x');
    perform pg_temp.ok(false, 'A cannot attach a workout to B program');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot attach a workout to B program'); end;
  begin
    insert into public.logged_sets (workout_id, exercise_id, set_index, weight, reps) values ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bb_bench', 1, 999, 1);
    perform pg_temp.ok(false, 'A cannot add sets to B workout');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'A cannot add sets to B workout'); end;
end $$;
reset role;

-- ── 3. Privilege escalation and admin functions ──
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
end $$;
reset role;

-- ── 4. Anonymous access ──
do $$
declare n int;
begin
  perform pg_temp.as_anon();
  select count(*) into n from public.profiles; perform pg_temp.ok(n = 0, 'anonymous cannot read profiles');
  select count(*) into n from public.logged_sets; perform pg_temp.ok(n = 0, 'anonymous cannot read sets');
  begin
    insert into public.events (name) values ('anon');
    perform pg_temp.ok(false, 'anonymous cannot write events');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot write events'); end;
  begin
    perform public.delete_account();
    perform pg_temp.ok(false, 'anonymous cannot call delete_account');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot call delete_account'); end;
  begin
    perform public.food_search_allowed();
    perform pg_temp.ok(false, 'anonymous cannot use food search');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot use food search'); end;
end $$;
reset role;

-- ── 5. Input validation: size caps and ranges ──
do $$ begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin
    insert into public.events (name, props) values ('x', jsonb_build_object('blob', repeat('a', 10000)));
    perform pg_temp.ok(false, 'oversized event props refused');
  exception when check_violation then perform pg_temp.ok(true, 'oversized event props refused'); end;
  begin
    insert into public.food_logs (logged_on, meal, fdc_id, name, grams, kcal, protein, fat, carbs) values (current_date, 'lunch', 0, 'x', 100, 1e9, 1, 1, 1);
    perform pg_temp.ok(false, 'absurd calories refused');
  exception when check_violation then perform pg_temp.ok(true, 'absurd calories refused'); end;
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

-- ── 6. Atomic, idempotent workout save ──
do $$
declare w1 uuid; w2 uuid; n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  w1 := public.save_workout('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', null, now(), 0, 1,
    '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"overridden":false},{"exercise_id":"bb_bench","set_index":1,"weight":60,"reps":8,"rir":0,"overridden":false}]');
  w2 := public.save_workout('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', null, now(), 0, 1,
    '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"overridden":false}]');
  perform pg_temp.ok(w1 = w2, 'retried save returns the same workout');
  select count(*) into n from public.logged_sets where workout_id = w1; perform pg_temp.ok(n = 2, 'retried save does not duplicate sets');
  select count(*) into n from public.workouts where id = w1 and finished_at = now(); perform pg_temp.ok(n = 1, 'finish time is set by the server');
  begin
    perform public.save_workout('dddddddd-0000-4000-8000-00000000000d', 'bbbbbbbb-0000-4000-8000-0000000000b1', 0, 'x', null, now(), 0, 1, '[]');
    perform pg_temp.ok(false, 'cannot save a workout on B program');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'cannot save a workout on B program'); end;
  begin
    perform public.save_workout('eeeeeeee-0000-4000-8000-00000000000e', 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1,
      '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2},{"exercise_id":"bb_bench","set_index":1,"weight":60,"reps":-1,"rir":2}]');
    perform pg_temp.ok(false, 'a bad set aborts the whole save');
  exception when check_violation then
    select count(*) into n from public.workouts where client_id = 'eeeeeeee-0000-4000-8000-00000000000e';
    perform pg_temp.ok(n = 0, 'a bad set aborts the whole save (nothing half-written)');
  end;
end $$;
reset role;

-- ── 7. Rate limits ──
do $$
declare i int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  for i in 1..20 loop insert into public.feedback (kind, message) values ('feedback', 'test'); end loop;
  begin
    insert into public.feedback (kind, message) values ('feedback', 'one too many');
    perform pg_temp.ok(false, '21st feedback in a day is refused');
  exception when raise_exception then perform pg_temp.ok(true, '21st feedback in a day is refused'); end;
end $$;
reset role;

-- ── 8. Account deletion removes only the caller's data ──
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  perform public.delete_account();
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.profiles where id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'deleted account: profile gone');
  select count(*) into n from public.workouts where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'deleted account: workouts gone');
  select count(*) into n from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 1, 'other accounts untouched');
  raise notice 'ALL SECURITY TESTS PASSED';
end $$;

rollback;
