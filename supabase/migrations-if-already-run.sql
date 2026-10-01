-- Only if you ran an older schema.sql before these columns existed. Safe to run once.
alter table public.workouts add column if not exists day_name text not null default '';
alter table public.profiles add column if not exists height_cm numeric not null default 175 check (height_cm between 100 and 250);
alter table public.profiles add column if not exists nutrition_phase text not null default 'maintain' check (nutrition_phase in ('gain', 'maintain', 'cut'));
