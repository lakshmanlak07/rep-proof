-- Migration 2: security hardening found in the 2026-10-02 audit. Safe to run once on the beta project.
-- Supabase: SQL Editor -> New query -> paste this file -> Run.

-- 1. plan_tier is server-controlled. Users could set their own tier (paywall bypass once paid tiers exist).
--    Clients may only write the columns they own; plan_tier and created_at are excluded.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes,
              bodyweight, height_cm, nutrition_phase, sex, unit, avoid, deload_until)
  on public.profiles to authenticated;
grant update (id, birth_year, disclaimer_accepted_at, experience, goal, setup, days, session_minutes,
              bodyweight, height_cm, nutrition_phase, sex, unit, avoid, deload_until)
  on public.profiles to authenticated;

-- 2. Rows may only point at the user's own parent rows (foreign keys alone ignore ownership).
drop policy own on public.workouts;
create policy own on public.workouts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));

drop policy own on public.logged_sets;
create policy own on public.logged_sets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- 3. Replace the active program in one transaction (the app falls back to two steps if this is missing).
create function public.replace_program(p_split text, p_plan jsonb, p_next_day int) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.programs set active = false where user_id = auth.uid() and active;
  insert into public.programs (split, plan, next_day) values (p_split, p_plan, p_next_day);
end;
$$;
revoke execute on function public.replace_program(text, jsonb, int) from public, anon;
grant execute on function public.replace_program(text, jsonb, int) to authenticated;

-- 4. Sanity bounds so one bad request cannot store absurd values.
alter table public.logged_sets
  add constraint logged_sets_bounds check (weight <= 2000 and reps <= 200 and set_index between 0 and 50);
alter table public.food_logs
  add constraint food_logs_bounds check (grams <= 10000 and kcal >= 0 and protein >= 0 and fat >= 0 and carbs >= 0);
alter table public.cardio_logs
  add constraint cardio_logs_kind_len check (char_length(kind) <= 30);
alter table public.saved_meals
  add constraint saved_meals_name_len check (char_length(name) <= 100);
alter table public.events
  add constraint events_name_len check (char_length(name) <= 64);
alter table public.profiles
  add constraint profiles_bodyweight_max check (bodyweight <= 700),
  add constraint profiles_avoid_len check (cardinality(avoid) <= 20);
