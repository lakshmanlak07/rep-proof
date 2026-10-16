-- Migration 7: RLS policies evaluate auth.uid() once per query instead of once per row
-- (Supabase advisor 0003, auth_rls_initplan), and a forgotten revoke on a trigger function.
-- Same rules, same roles: only the expressions are wrapped in (select ...). Re-running is harmless.

alter policy own on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy own on public.programs using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy own on public.bodyweight_logs using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy own on public.cardio_logs using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy own on public.food_logs using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy own on public.saved_meals using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy own on public.workouts using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.programs p where p.id = workouts.program_id and p.user_id = (select auth.uid())));
alter policy own on public.logged_sets using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = logged_sets.workout_id and w.user_id = (select auth.uid())));
alter policy insert_own on public.events with check (user_id = (select auth.uid()));
alter policy insert_own on public.feedback with check (user_id = (select auth.uid()));
alter policy insert_own on public.client_errors with check (user_id = (select auth.uid()));

-- Trigger function from migration 4: never callable directly, but keep the grants as tight as every other function.
revoke all on function private.workout_times() from public, anon, authenticated;

-- Scale: "recent foods" reads a user's food log newest first (food.ts recentFoods); the existing index is by day.
create index if not exists food_logs_user_time on public.food_logs (user_id, created_at desc);
