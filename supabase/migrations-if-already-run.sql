-- Only if you ran an older schema.sql before these columns existed. Safe to run once.
alter table public.workouts add column if not exists day_name text not null default '';
alter table public.profiles add column if not exists height_cm numeric not null default 175 check (height_cm between 100 and 250);
alter table public.profiles add column if not exists nutrition_phase text not null default 'maintain' check (nutrition_phase in ('gain', 'maintain', 'cut'));
alter table public.workouts add column if not exists perf_drops int not null default 0;
-- Then run, from schema.sql, the create table + enable row level security + create policy lines for:
-- cardio_logs, food_logs, saved_meals, food_cache.
