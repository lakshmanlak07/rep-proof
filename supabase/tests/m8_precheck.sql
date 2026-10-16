-- Read-only check: is migration 8 (20261014000000_privilege_tidy.sql) in effect on this database? Changes nothing.
-- Before migration 8: api_roles_have_maintain and/or api_roles_have_sequence_access true, replace_program_locked and
-- food_quota_ordered false. After it: those four flip, rate_limits_rls_on stays true.
--   npx supabase db query --linked -f supabase/tests/m8_precheck.sql
select
  current_setting('server_version_num')::int >= 170000 as pg17_or_newer,
  exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and (has_table_privilege('anon', c.oid, 'MAINTAIN') or has_table_privilege('authenticated', c.oid, 'MAINTAIN'))
  ) as api_roles_have_maintain,
  exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
      and (has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
        or has_sequence_privilege('authenticated', c.oid, 'USAGE,SELECT,UPDATE'))
  ) as api_roles_have_sequence_access,
  (select relrowsecurity from pg_class where oid = 'private.rate_limits'::regclass) as rate_limits_rls_on,
  (select prosrc like '%pg_advisory_xact_lock%' from pg_proc
    where oid = 'public.replace_program(text,jsonb,int)'::regprocedure) as replace_program_locked,
  (select l.lanname = 'plpgsql' from pg_proc p join pg_language l on l.oid = p.prolang
    where p.oid = 'public.food_search_allowed()'::regprocedure) as food_quota_ordered;
