# Backups and recovery

Status (9 October 2026):
- **No automatic backups exist.** The project is on the Supabase Free plan, which has no daily backups and no point-in-time recovery.
- Nothing below has been run yet: each step needs the database password, which only the owner holds.

## What needs protecting

- **All user data** lives in the Supabase Postgres database:
  - `auth.users`.
  - Every `public` table (profiles, programs, workouts, logged_sets, food_logs, saved_meals, cardio_logs, bodyweight_logs, feedback, events, client_errors).
  - `private.rate_limits`.
- **The schema is not at risk:** it is fully reproducible from `supabase/migrations/` (in git).
- **Edge function code** is in git. Its secrets (e.g. `FDC_API_KEY`) are not: keep a copy in your password manager.

## Option A: paid plan (recommended once real users exist)

Supabase Pro adds daily backups (7-day retention), with point-in-time recovery as an add-on. This is a recurring cost, so it is the owner's decision. Restore from Dashboard, Database, Backups.

## Option B: manual dumps on the Free plan

Run weekly, and before every migration:

```bash
npx supabase login
npx supabase link --project-ref hxxmhnxktgeueugkeday
npx supabase db dump --linked -f backups/schema.sql
npx supabase db dump --linked --data-only -f backups/data.sql
npx supabase db dump --linked --role-only -f backups/roles.sql
```

- The CLI asks for the database password. Never paste it into chat or commit it.
- `backups/` is personal data: keep it out of git (`backups/` is in `.gitignore`) and store it encrypted.
- `db dump` uses Docker on Windows. If Docker is not installed, use `pg_dump` with the connection string from Dashboard, Project Settings, Database.

## Which method covers the sign-in records (`auth.users`, `auth.identities`)

Checked against CLI 2.121.0 with `supabase db dump --dry-run` (16 Oct 2026):

| File | Contains `auth` data? |
|---|---|
| `schema.sql` (`db dump`) | **No.** It excludes the `auth`, `storage` and other platform schemas; a new Supabase project already has them. |
| `data.sql` (`db dump --data-only`) | **Yes.** Only platform schemas such as `realtime`, `vault`, `extensions` and `supabase_migrations` are excluded, plus `auth.schema_migrations`. So `auth.users`, `auth.identities` and the other `auth` tables are included, together with `public` and `private.rate_limits`. |
| `roles.sql` (`db dump --role-only`) | Custom roles only. No user rows. |
| Supabase Pro daily backup | A whole-database backup managed by Supabase, `auth` included, restored from the dashboard. You cannot download it as these three files. The app uses no Storage buckets, so nothing lives outside the database. |

- A schema-only dump does **not** back up users. Never treat it as a backup on its own.
- After every manual dump, confirm the users are in it:
  ```bash
  grep -cE '^(INSERT INTO|COPY) "auth"\."users"' backups/data.sql
  ```
  The count must be at least 1. The dump quotes every identifier and puts up to 100,000 rows in one statement, so this counts statements, not users. For the real number of users, use the drill's `select count(*) from auth.users`.
- `data.sql` holds password hashes and email addresses. Store it encrypted.

## Restore drill (do this once before launch)

1. Create a second, empty Supabase project (or a local Postgres).
2. Apply `roles.sql`, then `schema.sql`, then `data.sql` with `psql`.
3. Point a local build at it (`EXPO_PUBLIC_SUPABASE_URL` and key in `.env.local`).
4. Check that the sign-in records came across: run `select count(*) from auth.users;` in the drill project's SQL editor and compare the count with production. Then sign in with the throwaway test account, using its existing password with no reset, and check that workouts, food logs and progress show up.
5. Run `npm run test:live` against it.
6. Delete the drill project.

## If data is lost or corrupted

1. Stop writes: pause the project in the dashboard, or revoke the publishable key.
2. Restore the newest good dump (or the Pro backup) into a fresh project. Never test a restore on production.
3. Re-run `supabase/tests/security_tests.sql` against it. It rolls back everything it changes.
4. Switch the app to the restored project (rebuild with its URL and key) and tell affected users what was lost.
