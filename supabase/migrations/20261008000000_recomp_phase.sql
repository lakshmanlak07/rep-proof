-- Migration 5: allow "recomp" (eat at maintenance, train hard) as a nutrition goal.
-- Supabase: SQL Editor -> New query -> paste this file -> Run. Safe to run once; existing rows are unaffected.
alter table public.profiles drop constraint profiles_nutrition_phase_check;
alter table public.profiles add constraint profiles_nutrition_phase_check
  check (nutrition_phase in ('gain', 'maintain', 'cut', 'recomp'));
