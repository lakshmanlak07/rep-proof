-- Migration 4: abuse limits, size caps, least-privilege grants, server-authoritative workout saves
-- (security audit and remediation, 2026-10-06).
-- Supabase: SQL Editor -> New query -> paste this file -> Run. Run after migrations 1-3.
-- Then run supabase/tests/security_tests.sql to verify (it rolls everything back).

-- ───────────── 1. Least privilege ─────────────
-- Every table needs a signed-in user, so the anonymous role gets nothing (row-level security already
-- returned no rows; this also removes the privileges themselves).
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
-- TRUNCATE ignores row-level security. The API cannot issue it, but nobody needs it.
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- Insert-only tables, the server-only cache, and history that is never edited after saving.
revoke select, update, delete on public.events, public.feedback from authenticated;
revoke all on public.food_cache from authenticated;
revoke update on public.workouts, public.logged_sets from authenticated;

-- ───────────── 2. Per-user rate limits (fixed windows), in a schema the API does not expose ─────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.rate_limits (
  user_id uuid not null references auth.users on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);

-- Counts one hit for the calling user; false once the window's limit is passed.
-- Requests without a user id are not counted: anonymous requests are refused by grants and
-- row-level security anyway, and the service role / SQL editor are trusted.
-- The upsert is atomic, so concurrent requests cannot both slip under the limit.
create function private.hit(p_bucket text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  secs double precision := extract(epoch from p_window);
  w timestamptz;
  n int;
begin
  if uid is null then return true; end if;
  w := to_timestamp(floor(extract(epoch from now()) / secs) * secs);
  insert into private.rate_limits as r (user_id, bucket, window_start, hits)
    values (uid, p_bucket, w, 1)
    on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
    returning hits into n;
  if n = 1 then -- first hit of a new window: drop this user's stale windows
    delete from private.rate_limits where user_id = uid and window_start < now() - interval '2 days';
  end if;
  return n <= p_max;
end;
$$;
revoke all on function private.hit(text, int, interval) from public, anon, authenticated;

-- BEFORE INSERT/UPDATE trigger: TG_ARGV = (max writes, window). Raises P0001 with a fixed, non-revealing message.
create function private.enforce_write_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.hit(tg_table_name || ':' || lower(tg_op), tg_argv[0]::int, tg_argv[1]::interval) then
    raise exception 'rate limit exceeded' using errcode = 'P0001', hint = 'Too many requests. Try again later.';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_write_limit() from public, anon, authenticated;

-- Generous for real use (a lifter logs ~20-60 sets a day), tight enough to stop scripted spam.
-- Row triggers: a bulk insert of N rows counts N times, through the API or any RPC.
create trigger rate_limit before insert on public.events          for each row execute function private.enforce_write_limit('2000', '1 day');
create trigger rate_limit before insert on public.feedback        for each row execute function private.enforce_write_limit('20', '1 day');
create trigger rate_limit before insert on public.workouts        for each row execute function private.enforce_write_limit('30', '1 day');
create trigger rate_limit before insert on public.logged_sets     for each row execute function private.enforce_write_limit('1500', '1 day');
create trigger rate_limit before insert on public.programs        for each row execute function private.enforce_write_limit('100', '1 day');
create trigger rate_limit before insert on public.food_logs       for each row execute function private.enforce_write_limit('300', '1 day');
create trigger rate_limit before insert on public.saved_meals     for each row execute function private.enforce_write_limit('50', '1 day');
create trigger rate_limit before insert on public.cardio_logs     for each row execute function private.enforce_write_limit('50', '1 day');
create trigger rate_limit before insert on public.bodyweight_logs for each row execute function private.enforce_write_limit('50', '1 day');
-- The two tables with large rows that clients also rewrite.
create trigger rate_limit_update before update on public.programs for each row execute function private.enforce_write_limit('500', '1 day');
create trigger rate_limit before insert or update on public.profiles for each row execute function private.enforce_write_limit('200', '1 day');

-- Food search allowance for the `food` edge function (USDA's key is shared by every user).
create function public.food_search_allowed() returns boolean
language sql security definer set search_path = '' as $$
  select auth.uid() is not null
     and private.hit('food_search_min', 20, interval '1 minute')
     and private.hit('food_search_day', 500, interval '1 day');
$$;
revoke execute on function public.food_search_allowed() from public, anon;
grant execute on function public.food_search_allowed() to authenticated;

-- ───────────── 3. Size and range caps on every client-writable field ─────────────
-- NOT VALID: enforced for every new or changed row, without failing this migration on rows saved before it.
-- (Numeric bounds on sets, food and bodyweight are in migration 2.) JSON is measured as text:
-- pg_column_size can report the compressed size, which a repetitive payload would shrink.
alter table public.events
  add constraint events_props_size check (props is null or octet_length(props::text) <= 1024) not valid;
alter table public.feedback
  add constraint feedback_answers_size check (answers is null or octet_length(answers::text) <= 1024) not valid;
alter table public.programs
  add constraint programs_plan_size check (octet_length(plan::text) <= 262144) not valid,
  add constraint programs_split_len check (char_length(split) <= 32) not valid,
  add constraint programs_next_day_range check (next_day between 0 and 13) not valid;
alter table public.workouts
  add constraint workouts_day_name_len check (char_length(day_name) <= 64) not valid,
  add constraint workouts_day_index_range check (day_index between 0 and 13) not valid,
  add constraint workouts_checkin_size check (checkin is null or octet_length(checkin::text) <= 256) not valid,
  add constraint workouts_perf_drops_range check (perf_drops between 0 and 50) not valid;
alter table public.logged_sets
  add constraint logged_sets_exercise_len check (char_length(exercise_id) <= 64) not valid;
alter table public.food_logs
  add constraint food_logs_name_len check (char_length(name) <= 200) not valid,
  add constraint food_logs_macro_max check (kcal <= 100000 and protein <= 10000 and fat <= 10000 and carbs <= 10000) not valid;
alter table public.saved_meals
  add constraint saved_meals_items_size check (octet_length(items::text) <= 65536) not valid;
alter table public.profiles
  add constraint profiles_avoid_size check (octet_length(avoid::text) <= 1024) not valid;

-- ───────────── 4. Server-authoritative, atomic, idempotent workout saves ─────────────
-- client_id: generated by the app when a workout starts; a retried save returns the first one.
alter table public.workouts add column client_id uuid;
create unique index workouts_client_id on public.workouts (user_id, client_id) where client_id is not null;

-- Times come from the server on every insert path (RPC or direct API call): the finish time is
-- always now(), and the start time is clamped to the last 24 hours (a workout left open for days
-- still saves, it just cannot claim an impossible duration).
create function private.workout_times() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.finished_at := now();
  new.started_at := least(greatest(coalesce(new.started_at, now()), now() - interval '1 day'), now());
  return new;
end;
$$;
create trigger server_times before insert on public.workouts for each row execute function private.workout_times();
revoke all on table private.rate_limits from public, anon, authenticated;

-- Security invoker: row-level security, grants and triggers apply exactly as for direct inserts,
-- so ownership is checked by the same policies (the program must be the caller's own).
create function public.save_workout(
  p_client_id uuid, p_program_id uuid, p_day_index int, p_day_name text, p_checkin jsonb,
  p_started_at timestamptz, p_perf_drops int, p_next_day int, p_sets jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  wid uuid;
begin
  if p_client_id is null then raise exception 'client id required' using errcode = '22023'; end if;
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) > 100 then
    raise exception 'invalid sets' using errcode = '22023';
  end if;

  select id into wid from public.workouts where user_id = auth.uid() and client_id = p_client_id;
  if wid is not null then return wid; end if; -- retry of a save that already went through

  begin
    insert into public.workouts (client_id, program_id, day_index, day_name, checkin, started_at, perf_drops)
      values (p_client_id, p_program_id, p_day_index, p_day_name, p_checkin, p_started_at, p_perf_drops)
      returning id into wid;
  exception when unique_violation then
    -- A concurrent save with the same client id committed first: return that one, add nothing.
    select id into wid from public.workouts where user_id = auth.uid() and client_id = p_client_id;
    return wid;
  end;
  insert into public.logged_sets (workout_id, exercise_id, set_index, weight, reps, rir, overridden)
    select wid, s->>'exercise_id', (s->>'set_index')::int, (s->>'weight')::numeric, (s->>'reps')::int,
           (s->>'rir')::int, coalesce((s->>'overridden')::boolean, false)
    from jsonb_array_elements(p_sets) as s;
  update public.programs set next_day = p_next_day where id = p_program_id;
  return wid;
end;
$$;
revoke execute on function public.save_workout(uuid, uuid, int, text, jsonb, timestamptz, int, int, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, uuid, int, text, jsonb, timestamptz, int, int, jsonb) to authenticated;
