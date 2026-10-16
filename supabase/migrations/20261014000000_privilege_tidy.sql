-- Migration 8: tidy-up found by the 2026-10-14 database reviews. Defence in depth: none of these is reachable
-- through PostgREST today. NOT APPLIED to production; needs the owner's approval (docs/RELEASE_HARDENING_REPORT.md).
-- Re-running is harmless. Requires Postgres 17+ (MAINTAIN); production is 17.11.

-- Fail fast instead of queueing every app write behind a lock if a table is busy; just re-run it.
set lock_timeout = '3s';

-- MAINTAIN (Postgres 17: VACUUM, ANALYZE, REINDEX, LOCK TABLE ...) came with Supabase's default grants after
-- migration 4's revoke list was written. The app never needs it; an API role must not be able to lock a table.
revoke maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated;

-- Identity sequences (events, feedback, client_errors): inserts do not need sequence privileges, so none are kept.
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- Production already has RLS on for private.rate_limits (enabled outside the migrations); record it here so a
-- rebuilt database matches. Only when off: the ALTER takes an exclusive lock that every write's rate-limit check needs.
do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'private.rate_limits'::regclass) then
    alter table private.rate_limits enable row level security;
  end if;
end $$;

-- Two plan rebuilds at once (a double tap on two devices) could fail the second with a unique violation on
-- one_active_program: serialise them per user. Same signature, so existing grants are kept.
create or replace function public.replace_program(p_split text, p_plan jsonb, p_next_day int) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('replace_program:' || auth.uid()::text, 0));
  update public.programs set active = false where user_id = auth.uid() and active;
  insert into public.programs (split, plan, next_day) values (p_split, p_plan, p_next_day);
end;
$$;

-- Food quota: a refused per-minute burst must not also spend the daily allowance. SQL AND has no guaranteed
-- evaluation order; plpgsql does.
create or replace function public.food_search_allowed() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if not private.hit('food_search_min', 20, interval '1 minute') then return false; end if;
  return private.hit('food_search_day', 500, interval '1 day');
end;
$$;

reset lock_timeout;
