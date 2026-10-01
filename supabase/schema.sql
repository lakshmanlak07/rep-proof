-- RepProof beta schema. Paste into Supabase: SQL Editor -> New query -> Run.
-- Exercises and references live in app code (src/engine), not here.
-- Every table is locked to its owner with row-level security.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  birth_year int not null check (birth_year <= extract(year from now())::int - 18),
  plan_tier text not null default 'free',
  disclaimer_accepted_at timestamptz not null,
  experience text not null check (experience in ('beginner', 'intermediate', 'advanced')),
  goal text not null check (goal in ('muscle', 'strength', 'both')),
  setup text not null check (setup in ('commercial', 'home')),
  days int not null check (days between 2 and 6),
  session_minutes int not null check (session_minutes between 20 and 180),
  bodyweight numeric not null check (bodyweight > 0),
  height_cm numeric not null check (height_cm between 100 and 250),
  nutrition_phase text not null default 'maintain' check (nutrition_phase in ('gain', 'maintain', 'cut')),
  sex text check (sex in ('male', 'female')), -- null = prefer not to say
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  avoid text[] not null default '{}',
  deload_until date,
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  split text not null,
  plan jsonb not null, -- engine Program: days, weekly sets, explanations
  next_day int not null default 0, -- index of the next day to train
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_program on public.programs (user_id) where active;

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  program_id uuid not null references public.programs on delete cascade,
  day_index int not null,
  day_name text not null,
  checkin jsonb, -- {sleep, soreness, energy}; null = skipped
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.logged_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  workout_id uuid not null references public.workouts on delete cascade,
  exercise_id text not null,
  set_index int not null,
  weight numeric not null check (weight >= 0),
  reps int not null check (reps >= 0),
  rir int check (rir between 0 and 10),
  overridden boolean not null default false,
  created_at timestamptz not null default now()
);
create index logged_sets_history on public.logged_sets (user_id, exercise_id, created_at desc);

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  props jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.workouts enable row level security;
alter table public.logged_sets enable row level security;
alter table public.events enable row level security;

create policy own on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy own on public.programs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on public.logged_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- events: users can add their own, never read or change them
create policy insert_own on public.events for insert with check (user_id = auth.uid());

-- In-app account deletion (App Store requirement). Cascades to every table above.
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Week-4 success metric (run in SQL Editor as admin):
-- counted = finished onboarding + logged >= 1 workout; active = >= 2 workouts on days 22-28 after the first.
-- with firsts as (select user_id, min(finished_at) first_at from workouts where finished_at is not null group by user_id)
-- select count(*) counted,
--        count(*) filter (where (select count(*) from workouts w where w.user_id = f.user_id and w.finished_at
--          between f.first_at + interval '21 days' and f.first_at + interval '28 days') >= 2) active
-- from firsts f;
