-- Migration 6: optional RPE on logged sets, client crash reports, indexes, and integrity hardening.
-- Supabase: SQL Editor -> New query -> paste this file -> Run. Run after migrations 1-5.
-- Then verify with supabase/tests/security_tests.sql (one transaction ending in ROLLBACK; prefer a Supabase branch, see docs/OPERATIONS_RUNBOOK.md).
-- Safe on existing data: one new nullable column, one new table, new indexes and checks that every existing
-- row already meets, and save_workout replaced with the same signature (older app versions keep working).
-- Re-running it is harmless: every statement is guarded (tested in supabase/tests/run.mjs).

-- Fail fast instead of queueing every app query behind this migration if a table is busy; just re-run it.
set lock_timeout = '5s';

-- ───────────── 1. Optional RPE (1-10 in half steps) ─────────────
-- RIR stays the value the engine uses; RPE is what the lifter entered when they chose the RPE scale.
alter table public.logged_sets add column if not exists rpe numeric(3,1);
-- Checks are added NOT VALID (no full-table scan under an exclusive lock), then validated (a lighter lock;
-- every existing row has rpe null, so both pass). Guarded so a re-run is harmless.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'logged_sets_rpe_range') then
    alter table public.logged_sets add constraint logged_sets_rpe_range
      check (rpe is null or (rpe between 1 and 10 and rpe * 2 = floor(rpe * 2))) not valid;
  end if;
  -- RPE and RIR must agree (RIR = 10 - RPE, half steps rounded toward failure; RPE 6 = 4 or more), so a
  -- client cannot store an RPE that contradicts the RIR the progression engine reads.
  if not exists (select 1 from pg_constraint where conname = 'logged_sets_rpe_matches_rir') then
    alter table public.logged_sets add constraint logged_sets_rpe_matches_rir
      check (rpe is null or (rir is not null and rir = greatest(0, floor(10 - rpe))::int)) not valid;
  end if;
end $$;
alter table public.logged_sets validate constraint logged_sets_rpe_range;
alter table public.logged_sets validate constraint logged_sets_rpe_matches_rir;

create or replace function public.save_workout(
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
  -- Sets get increasing timestamps in the order sent (one transaction would give them all the same now(),
  -- leaving the order of exercises on the workout screen up to the database).
  insert into public.logged_sets (workout_id, exercise_id, set_index, weight, reps, rir, overridden, rpe, created_at)
    select wid, s->>'exercise_id', (s->>'set_index')::int, (s->>'weight')::numeric, (s->>'reps')::int,
           (s->>'rir')::int, coalesce((s->>'overridden')::boolean, false), (s->>'rpe')::numeric,
           now() + o * interval '1 millisecond'
    from jsonb_array_elements(p_sets) with ordinality as t(s, o);
  update public.programs set next_day = p_next_day where id = p_program_id;
  return wid;
end;
$$;
revoke execute on function public.save_workout(uuid, uuid, int, text, jsonb, timestamptz, int, int, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, uuid, int, text, jsonb, timestamptz, int, int, jsonb) to authenticated;

-- ───────────── 2. Client crash reports (insert-only; no passwords, tokens or health data) ─────────────
-- The app scrubs messages before sending (src/lib/scrub.ts); these caps bound whatever arrives.
-- Read them as the owner in the SQL Editor: select * from public.client_errors order by created_at desc;
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  context jsonb check (context is null or octet_length(context::text) <= 1024),
  created_at timestamptz not null default now()
);
alter table public.client_errors enable row level security;
drop policy if exists insert_own on public.client_errors;
create policy insert_own on public.client_errors for insert with check (user_id = auth.uid());
revoke all on public.client_errors from anon, authenticated;
grant insert (message, stack, context) on public.client_errors to authenticated;
drop trigger if exists rate_limit on public.client_errors;
create trigger rate_limit before insert on public.client_errors for each row execute function private.enforce_write_limit('50', '1 day');
-- Retention (privacy policy): each new report clears every report older than 90 days.
create index if not exists client_errors_age on public.client_errors (created_at);
create or replace function private.purge_client_errors() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.client_errors where created_at < now() - interval '90 days';
  return null;
end;
$$;
revoke all on function private.purge_client_errors() from public, anon, authenticated;
drop trigger if exists purge_old on public.client_errors;
create trigger purge_old after insert on public.client_errors for each statement execute function private.purge_client_errors();

-- ───────────── 3. Indexes for the app's queries, cascades and account deletion ─────────────
-- Without these, deleting a workout or an account scans every user's rows, and history, Home and Progress
-- scan and sort each user's tables. Plain CREATE INDEX is fine at beta size (it briefly blocks writes).
create index if not exists logged_sets_workout    on public.logged_sets (workout_id);
create index if not exists logged_sets_user_time  on public.logged_sets (user_id, created_at desc);
create index if not exists workouts_user_finished on public.workouts (user_id, finished_at desc);
create index if not exists workouts_program       on public.workouts (program_id);
create index if not exists programs_user          on public.programs (user_id);
create index if not exists events_user            on public.events (user_id);
create index if not exists feedback_user          on public.feedback (user_id);
create index if not exists cardio_logs_user_time  on public.cardio_logs (user_id, created_at desc);
create index if not exists saved_meals_user_time  on public.saved_meals (user_id, created_at desc);
create index if not exists client_errors_user     on public.client_errors (user_id);
create index if not exists food_cache_fetched     on public.food_cache (fetched_at);

-- ───────────── 4. Integrity ─────────────
-- Deleting a program cascades to every workout logged under it. The app never deletes programs
-- (replace_program deactivates them), so no client may.
revoke delete on public.programs from authenticated;

-- A birth year must be a real one (the 18+ check only bounds it from above).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_birth_year_min') then
    alter table public.profiles add constraint profiles_birth_year_min check (birth_year >= 1900) not valid;
  end if;
end $$;
alter table public.profiles validate constraint profiles_birth_year_min;

-- The disclaimer acceptance is a consent record: stamped by the server when the profile is created and never
-- changed afterwards (it was client-supplied and could be rewritten at any time).
create or replace function private.consent_time() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.disclaimer_accepted_at := now();
  else
    new.disclaimer_accepted_at := old.disclaimer_accepted_at;
  end if;
  return new;
end;
$$;
revoke all on function private.consent_time() from public, anon, authenticated;
drop trigger if exists consent_time on public.profiles;
create trigger consent_time before insert or update on public.profiles for each row execute function private.consent_time();

-- ───────────── 5. Least privilege for what the app never does (database review, 2026-10-10) ─────────────
-- The app creates and updates its profile but never deletes it (delete_account removes it by cascade).
-- Deleting and re-inserting it would reset created_at, the consent time and plan_tier.
revoke delete on public.profiles from authenticated;
-- Saved meals and cardio entries are only inserted or deleted; updates sidestepped the insert-only write limits.
revoke update on public.saved_meals, public.cardio_logs from authenticated;
-- Analytics and feedback rows carry only what the app sends (insert-only, as before); the server sets
-- user_id and created_at, so events cannot be backdated.
revoke insert on public.events, public.feedback from authenticated;
grant insert (name, props) on public.events to authenticated;
grant insert (kind, message, answers) on public.feedback to authenticated;

-- Storage growth per account: the engine's largest plan is about 5 KB, so 64 KB leaves wide headroom
-- (was 256 KB at 100 a day). NOT VALID: checked on every new or changed plan; existing rows are not rescanned.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'programs_plan_size_64k') then
    alter table public.programs add constraint programs_plan_size_64k check (octet_length(plan::text) <= 65536) not valid;
  end if;
end $$;
drop trigger if exists rate_limit on public.programs;
create trigger rate_limit before insert on public.programs for each row execute function private.enforce_write_limit('30', '1 day');
drop trigger if exists rate_limit on public.events;
create trigger rate_limit before insert on public.events for each row execute function private.enforce_write_limit('500', '1 day');

-- A function added by a later migration is executable by nobody until that migration grants it.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

reset lock_timeout;
