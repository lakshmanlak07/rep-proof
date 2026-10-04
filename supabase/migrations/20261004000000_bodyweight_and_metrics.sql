-- Migration 3: bodyweight log (Progress trend + nutrition targets), in-app feedback and weekly survey,
-- and the week-4 beta metric.
-- Supabase: SQL Editor -> New query -> paste this file -> Run. Run after migration 2.

create table public.bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  weight numeric not null check (weight > 0 and weight <= 700), -- in the user's unit (profiles.unit)
  logged_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on) -- one entry per day; logging again replaces it
);
alter table public.bodyweight_logs enable row level security;
create policy own on public.bodyweight_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- In-app feedback and the weekly 3-question survey (PRD feedback loop). Insert-only from the app;
-- read them in the Table Editor or SQL Editor.
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  kind text not null check (kind in ('feedback', 'survey')),
  message text check (char_length(message) <= 2000),
  answers jsonb, -- survey: {useful: 1-5, fit: 'yes'|'mostly'|'no'}
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy insert_own on public.feedback for insert with check (user_id = auth.uid());

-- Week-4 success metric (PRD): counted = logged at least one workout;
-- active = at least 2 finished workouts on days 22-28 after their first one.
-- Admin only: run `select * from public.beta_week4_metric();` in the SQL Editor.
create function public.beta_week4_metric()
returns table (counted bigint, eligible bigint, active bigint, active_pct numeric)
language sql security definer set search_path = '' as $$
  with firsts as (
    select user_id, min(finished_at) as first_at
    from public.workouts where finished_at is not null group by user_id
  ),
  scored as (
    select f.user_id,
           f.first_at <= now() - interval '28 days' as eligible,
           (select count(*) from public.workouts w
             where w.user_id = f.user_id and w.finished_at is not null
               and w.finished_at > f.first_at + interval '21 days'
               and w.finished_at <= f.first_at + interval '28 days') >= 2 as active
    from firsts f
  )
  select count(*),
         count(*) filter (where eligible),
         count(*) filter (where eligible and active),
         round(100.0 * count(*) filter (where eligible and active) / nullif(count(*) filter (where eligible), 0), 1)
  from scored;
$$;
revoke execute on function public.beta_week4_metric() from public, anon, authenticated;

-- Second success signal (PRD): founding-member waitlist sign-ups, from the events table.
-- Admin: select count(distinct user_id) from public.events where name = 'pro_waitlist_joined';
