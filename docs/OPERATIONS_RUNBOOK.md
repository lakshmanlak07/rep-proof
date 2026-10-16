# Operations runbook

For the owner running RepProof after launch. Nothing here has been executed against production yet. Where a step needs the dashboard or credentials, only the owner does it.

## 1. Configuration

**App (`.env`, all public; see `.env.example` for names only):**
- `EXPO_PUBLIC_SUPABASE_URL`.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Publishable key only, never the secret key.
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`: optional.
- `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_DELETE_ACCOUNT_URL`: set once the pages are hosted.

**Server secrets:** set with `npx supabase secrets set …`, never in the repo.
- `FDC_API_KEY` for the food function.
- The service-role key exists only inside Supabase.

`npm run scan:secrets -- --history` must stay clean before every release.

## 2. Database migrations

1. Back up first (`docs/BACKUP_AND_RECOVERY.md`).
2. Locally, `npm run test:db` must pass. It applies every migration to a throwaway Postgres and runs the security and mutation tests.
3. Apply in order in the SQL Editor (one file per run). Migrations are written to be applied once. If one fails, stop: do not edit and re-run blindly. Read the error, then write a forward fix as a new migration.
4. Verify by running `supabase/tests/security_tests.sql` in the SQL Editor. It runs inside one transaction and ends in `rollback;`. Prefer a Supabase branch or a restored copy. The script is verified to roll back on a disposable database (`npm run test:db:safety`), but it briefly writes and locks rows. If you run it on production, paste and run it as one execution, and do not edit out the final `rollback;`.

**Status 2026-10-14:** migration 6 applied 2026-10-11 and migration 7 (`20261013000000_policy_initplan.sql`) 2026-10-13, both with `supabase db query --linked -f`. Migration 8 (`20261014000000_privilege_tidy.sql`) is NOT applied. Supabase's migration history is empty for all seven: run `supabase migration repair --linked --status applied <each version>` once (owner), and repeat it after every manual apply. **Rollback is not lossless:** retreating from migration 6 drops RPE values and crash reports written since; prefer a forward fix. Migration 7 only changes policy expressions, one revoke and one index, so its retreat is re-creating the old `auth.uid()` policies.

Migration 6 (`20261009000000_rpe_and_crash_reports.sql`) was described as safe on existing data:
- One new nullable column (`logged_sets.rpe`).
- Two checks on it:
  - RPE 1–10 in half steps;
  - RPE must match the set's RIR (RIR = 10 − RPE rounded toward failure; RPE 6 = 4+).
  - Every existing row has `rpe` null, so both pass on existing data.
- One new table (`client_errors`).
- `save_workout` replaced with the same signature. It now gives the sets of one save increasing timestamps, so the order is preserved.
- Added 2026-10-10 after the database review:
  - 11 indexes for foreign-key cascades and the app's queries;
  - `revoke delete on programs`;
  - `profiles_birth_year_min` (`>= 1900`);
  - a `consent_time` trigger: the disclaimer time is stamped by the server and cannot be changed afterwards.
- Added later on 2026-10-10 (section 5, least privilege, from the second database review):
  - `revoke delete on profiles`; `revoke update on saved_meals, cardio_logs` (the app never does either);
  - `events` and `feedback` become insert-only on the columns the app sends (`name, props` / `kind, message, answers`), so `created_at` cannot be forged;
  - `programs_plan_size_64k` (`NOT VALID`; the largest plan the engine builds is 5.4 KB), programs limited to 30 new a day (was 100), events to 500 a day (was 2,000);
  - default privileges: a function added by a later migration is executable by nobody until that migration grants it. This also applies to functions from a later `create extension` run as `postgres`: grant execute on the ones the app calls, explicitly, in the same migration.
- The new checks are added `NOT VALID` and then validated. The file sets `lock_timeout = '5s'`: if it times out on a busy table, run it again.

### Migration 6 deployment checklist

**What is stored today, without migration 6**
- The app always computes RIR from RPE on the phone and sends both.
- The live `save_workout` (migration 4) reads only the fields it knows. It stores weight, reps and **RIR**, and silently drops `rpe`.
- History screens fall back to a query without `rpe` (error `42703`).
- Crash reports fail quietly: the table is missing and sending is best effort.
- Nothing breaks, but RPE entries and crash reports are lost until the migration is applied.

**Proven locally on disposable Postgres (`npm run test:db`)**
- Saving with `rpe` before the migration keeps the set and its RIR.
- Applying the migration keeps every existing row.
- After it, `rpe` is stored.
- Bad RPE values are refused: outside half steps, above 10, contradicting RIR, or without RIR.
- Re-running the migration is harmless.
- Each new check is covered by a mutation test.

**Steps (owner)**
0. **Pre-flight (read-only).** `select count(*) from public.profiles where birth_year < 1900;` must return 0, or validating `profiles_birth_year_min` aborts the whole file (it fails safely: nothing is applied). Also `select max(octet_length(plan::text)) from public.programs;` should be far below 65536.
1. **Back up** (`docs/BACKUP_AND_RECOVERY.md`): on the Free plan, a manual `pg_dump` of `public` from Project Settings › Database.
2. **Branch first, if possible.** Create a Supabase branch (or restore the dump into a scratch project) and apply the migration there. Then run `supabase/tests/security_tests.sql`: it must print `ALL SECURITY TESTS PASSED` and end in rollback.
3. **Production.** Paste the whole migration file into the SQL Editor and run it once.
4. **Verify in production.** Run each of these:
   - `select count(*) from public.logged_sets where rpe is not null;` returns 0 straight after the migration.
   - `select conname from pg_constraint where conname like 'logged_sets_rpe%';` returns 2 rows.
   - `select count(*) from pg_indexes where schemaname = 'public' and indexname in ('logged_sets_workout','workouts_user_finished','events_user');` returns 3.
   - `select tgname from pg_trigger where tgname = 'consent_time';` returns 1 row.
   - `select to_regclass('public.client_errors');` is not null.
   - `select has_table_privilege('authenticated', 'public.profiles', 'delete');` returns false, and `select has_column_privilege('authenticated', 'public.events', 'created_at', 'insert');` returns false.
   - Then finish one workout with the RPE scale on a test account and check that its row has `rpe`.
5. **Rollback, if the migration fails part-way.** Each statement is guarded, so fix the cause and re-run the same file.
   - Do not hand-drop objects while app builds that send RPE are in use.
   - To retreat fully (only if needed):
     ```sql
     alter table public.logged_sets drop constraint if exists logged_sets_rpe_matches_rir;
     alter table public.logged_sets drop constraint if exists logged_sets_rpe_range;
     alter table public.logged_sets drop column if exists rpe;
     drop table if exists public.client_errors;
     drop trigger if exists consent_time on public.profiles;
     grant delete on public.programs to authenticated; -- only if a retreat must restore the old grants exactly
     -- Section 5 needs no retreat for older app builds: they never delete profiles, edit saved meals or cardio,
     -- or send created_at on events or feedback.
     ```
   - The indexes and `profiles_birth_year_min` can stay: they are harmless to older app versions.
   - Then re-apply migration 4's `save_workout` from `20261006000000_abuse_limits_and_atomic_saves.sql`.
   - The app keeps working after a retreat. It returns to the "what is stored today" behaviour above.
6. **Forward recovery is preferred.** Problems after the migration (for example, a valid RPE refused) are fixed by a new migration that adjusts the check, never by editing this file.

## 3. Releases and rollback

- Version: `app.json` `version` and `android.versionCode`. With EAS production builds the versionCode is managed remotely (`eas.json`: `appVersionSource: remote`).
- **Roll out gradually:** in Play Console, use a staged rollout (for example 10%, then 50%, then 100%).
- **Bad release:** halt the staged rollout in Play Console, then ship a fixed build with a higher versionCode. Play cannot downgrade users. RepProof has no over-the-air updates (no expo-updates), so every fix is a new store build.
- Database changes must stay compatible with the previous app version until the old build is gone: add columns and tables, do not rename or drop them.

## 4. Crash reports (after migration 6)

Weekly, in the SQL Editor:

```sql
select context->>'version' as version, context->>'route' as screen, message, count(*) as reports, max(created_at) as last_seen
from public.client_errors
where created_at > now() - interval '7 days'
group by 1, 2, 3
order by reports desc
limit 50;
```

Reports are scrubbed on the phone, rate-limited to 50 per user per day, and cleared after 90 days.

## 5. Support requests

- In-app feedback lands in the `feedback` table: `select created_at, kind, message, answers from public.feedback order by created_at desc limit 50;`
- Reply from the support address on the deletion page. Never ask users for passwords or codes.

## 6. Account-deletion requests (the web page promises action within 30 days)

1. Confirm the request came from the email address on the account. Reply to that address and ask them to confirm.
2. Supabase Dashboard › Authentication › Users › find the email › Delete user. Every RepProof table references `auth.users` with `on delete cascade`, so all their rows go with it. This is verified for crash reports, workouts, profile and feedback in `security_tests.sql` §11.
3. Reply to confirm. Keep only a dated note that a deletion was completed, with no personal data.

## 7. Incidents

**Something is broken (crash spike, failed saves):**
1. Check crash reports (§4) and the Supabase logs.
2. Halt the rollout (§3).
3. Fix, run `npm test` and `npm run test:db`, and ship.

**Suspected data exposure, or a leaked key or credential:**
1. Rotate the affected key in the Supabase dashboard (publishable or secret key, database password) and the `FDC_API_KEY` if involved.
2. Check the Supabase logs for unusual access.
3. If personal data may have been exposed, write down what, whose and when. Depending on where your users live, data-protection law may require notifying a regulator and the people affected within a short deadline (for example 72 hours under the GDPR). Get advice.
4. Fix the cause, add a regression test to `security_tests.sql`, and record the incident in `SECURITY.md`.

**Abuse (spam sign-ups, scripted writes):**
- Turn on CAPTCHA (`PRODUCTION_SECURITY_CHECKLIST.md`).
- Per-user write limits are already in the database (migration 4).

## 8. Dependency updates

- Monthly, and on every Expo SDK release: `npx expo install --check`, then `npm audit --omit=dev`.
- Compare the result with the analysis in `SECURITY.md` › Dependency audit.
- Upgrade with `npx expo install <pkg>` (SDK-compatible versions), never `npm audit fix --force`, which suggests downgrading Expo.
- After any upgrade, run `bash scripts/check-all.sh /tmp/checks.log`, then a release build and an emulator smoke test.
