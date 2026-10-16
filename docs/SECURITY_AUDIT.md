# Security audit (independent re-audit, 2026-10-09)

The project's ongoing security notes are in `SECURITY.md` (threat model, controls, data map, dependency audit) and `PRODUCTION_SECURITY_CHECKLIST.md` (dashboard settings). This file records **this audit**: what was checked, how, what was found and fixed, and what was not assessed. No system can be shown free of vulnerabilities. This lists what was verified.

## Scope

**Assessed:**
- Every migration in `supabase/migrations/` (1-6).
- `supabase/functions/food`.
- The Supabase client and session handling (`src/lib/supabase.ts`, `data.tsx`, `authFlow.ts`, `chunked.ts`).
- Crash reporting (`crash.ts`, `scrub.ts`), analytics (`track()` call sites), data export (`exportCollect.ts`, `exportTables.ts`) and account deletion.
- The privacy policy and public pages.
- Android manifest permissions (from the built APK).
- Dependency advisories.

**Not assessed:**
- Live Supabase dashboard settings: auth limits, SMTP, CAPTCHA enforcement, JWT expiry. These need the owner's dashboard.
- Authenticated live tests: no throwaway credentials were available.
- iOS.
- Physical devices.
- Penetration testing of Supabase-hosted infrastructure (out of scope; read-only probes only).

## Methods

1. Read every migration, policy, grant, function and trigger.
2. Ran the database suite on a disposable in-memory Postgres (PGlite) with Supabase's roles and `auth.uid()` emulated. Two users are tested against each other, plus anonymous access.
3. Mutation testing: 21 deliberate weakenings, each re-run against the suite, which must fail for every one.
4. Anonymous, read-only live probes (`npm run test:live`).
5. Grepped every `track()` call, `console.*` call and swallowed error.
6. Inspected the built APK's merged manifest and signing (`aapt`, `apksigner`, `jarsigner`).
7. `npm audit` with dependency paths and npm registry version checks.

## Data-access matrix (verified against the migrations)

Every table below has row-level security enabled. The anonymous role has no table privileges (migration 4; tested in §5: anonymous reads of profiles and sets, writes to events, and calls to every RPC are refused).

| Table | Owner column | Client SELECT | INSERT | UPDATE | DELETE | Extra server checks | Tests |
|---|---|---|---|---|---|---|---|
| profiles | id | own | own (column grant: no `plan_tier`) | own (same columns) | n/a (cascade from auth) | Birth-year 18+ check; size caps | §1-4, 6 |
| programs | user_id | own | own | own (rate-limited) | own | Plan size cap | §1-3, 6, 8 |
| workouts | user_id | own | own, and the program must be yours | **revoked** | own | Server sets times; client_id unique | §1-3, 7 |
| logged_sets | user_id | own | own, and the workout must be yours | **revoked** | own | Weight/reps/RIR/RPE bounds | §1-3, 7, 9 |
| food_logs | user_id | own | own | own; the new row must still be yours | own | Macro and size caps | §1-3, 2b, 6 |
| saved_meals | user_id | own | own | own | own | Items size cap | §1-3, 2b |
| cardio_logs | user_id | own | own | own | own | Minutes, kind length | §1-3, 2b, 8 |
| bodyweight_logs | user_id | own | own | own | own | 0 < weight ≤ 700; one per day | §1, 2b |
| events | user_id | **none** | own (insert-only) | none | none | Props ≤ 1 KB; 500/day | §1, 3, 6 |
| feedback | user_id | **none** | own (insert-only) | none | none | Message ≤ 2000; 20/day | §1, 6, 8 |
| client_errors (m6) | user_id | **none** | own (column grant: message, stack, context) | none | none | Size caps; 50/day; 90-day purge | §9 |
| food_cache | — | **none** | none | none | none | Edge function (service role) only | §1 |
| private.rate_limits | user_id | none (schema not exposed) | — | — | — | Security-definer helpers only | §1, 4 |

**RPCs:**

| Function | Security | Search path | Who can EXECUTE | Purpose |
|---|---|---|---|---|
| `delete_account()` | definer | `''` | authenticated | Deletes only `auth.uid()` |
| `save_workout(…)` | invoker | `''` | authenticated | Row-level security applies |
| `replace_program(…)` | invoker | `''` | authenticated | |
| `food_search_allowed()` | definer | `''` | authenticated | |
| `beta_week4_metric()` | definer | `''` | owner only | |
| `private.*` | — | — | revoked from all client roles | |

**Storage:** no storage buckets exist. **Client keys:** the bundle contains only the publishable key and the project URL. Verified in the production export: the secret scan is clean, and the one `sb_secret` string match was Hermes concatenating an unrelated string.

## Findings

| ID | Severity | Location | Finding | Fix | Regression test | Status |
|---|---|---|---|---|---|---|
| SEC-1 | P2 | `src/lib/data.tsx` `load()` | **Deleted or revoked account soft-lock.** Precondition: the account is deleted on the server (for example by an owner-handled web deletion request) while the device holds an unexpired access token. Expected: sign-out. Actual: the app sees "no profile", opens onboarding, and every save fails until the token expires (about 1 h). | When the profile is missing, `auth.getUser()` checks with the server. A definite rejection (`user_not_found`, `session_not_found`, `user_banned`, `bad_jwt`, 401/403) signs out locally. Network errors keep the old behaviour. | `auth.test.ts` "a deleted or revoked account signs the device out; a network failure never does" (8 cases) | Fixed; unit-verified. A live end-to-end check needs a throwaway account |
| SEC-2 | P2 (privacy disclosure) | `(tabs)/profile.tsx` Privacy sheet; `lib/privacyPolicy.ts` | The disclosure said usage events "never [include] your answers or numbers". The code sends the set count, setup choices (goal, experience, days, minutes), survey answers and cardio type and intensity. | Both texts now list what events contain and what they never contain; `track()` now filters every payload at runtime with `safeProps()` (sensitive keys dropped unless the value is a boolean flag, no nested values, strings capped at 64) | `features.test.ts` "BUG-4 guard": scans every `track()` call and fails on check-in, body, food, lift or identity fields. Its pattern was itself shown to flag bad payloads. It also requires every call to use a literal payload. `safeProps` has 8 behavioural tests | Fixed |
| SEC-3 | P3 | `lib/exportCollect.ts` | **Export pagination had no `order by`**, so exports over 1000 rows could skip or repeat rows. Nothing checked that new tables are exported. | Pages ordered by `id`. The table list moved to `exportTables.ts`. The export file now says what is excluded and why (`not_included`). | `features.test.ts` "data export covers every table" (parses migrations) and "export paging" (`pageAll` at page boundaries, error abort) | Fixed |
| SEC-4 | P3 | migration 6 | Not safe to re-run: a duplicate execution would fail partway. | Guards (`if not exists`, `drop … if exists`, `create or replace`) | `run.mjs` applies the newest migration twice | Fixed (migration not yet applied anywhere) |
| SEC-5 | P3 (test gap) | `security_tests.sql` | Cross-account UPDATE, and moving an owned row into another account, were untested for food, bodyweight, cardio and saved meals. | The policies were already correct; 12 checks added | §2b, plus mutations "food log owner reassignment allowed" and "cardio cross-account edits allowed", both caught | No vulnerability found; coverage added |
| SEC-6 | Info | `lib/crash.ts` | `installCrashReporting()` could wrap the global handler twice on a module reload, causing double reports. | Idempotency guard | Code inspection | Fixed |
| SEC-7 | P3 (privacy disclosure) | `privacyPolicy.ts` | The policy omitted who emails sign-in codes, and that Open Food Facts is also queried from the server. | Both added | Rebuilt the public page and checked its text in the browser | Fixed |
| SEC-8 | Info | `functions/food` | `req.text()` reads the body before the size check when no `content-length` header is sent. The Supabase gateway limits body size, and the parsed size is checked anyway. | None | — | Accepted |
| SEC-9 | Info | `functions/food`, `portion.ts` | Serving sizes given in ml are treated as grams (an approximation for liquids). | Documented | — | Accepted (accuracy note) |
| DEP-1…4 | High/Moderate (advisories) | node_modules | See `SECURITY.md` › Dependency audit: braces and node-forge (no patched release), decode-uri-component (shipped; mitigated by `safeLink`), uuid (build-time). | Documented; no unsafe overrides | `auth.test.ts` safeLink tests | Open with evidence |

No P0 or P1 issue was found in the areas assessed.

## Android manifest (built APK, inspected with aapt)

Permissions:
- `CAMERA`: barcode scanning.
- `INTERNET`, `ACCESS_NETWORK_STATE`.
- `VIBRATE`, `POST_NOTIFICATIONS`, `WAKE_LOCK`: local rest alerts.
- `com.repproof.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`: AndroidX internal.

Removed with `blockedPermissions`, with each confirmed unused:
- Push messaging (c2dm) and the install referrer.
- Launcher badge permissions.
- Biometrics: secure store is used without biometric prompts.
- Overlay.
- Legacy storage.
- Boot-completed: alerts are short and need no rescheduling after a reboot.

## Remaining risks

1. Dashboard settings are unverified (SMTP, CAPTCHA, password policy, JWT expiry). See `PRODUCTION_SECURITY_CHECKLIST.md`.
2. Migrations 6 and 7 are applied live (2026-10-11, 2026-10-13). Migration 8 (MAINTAIN and sequence revokes, RLS on private.rate_limits) is written and tested but not applied.
3. No authenticated live test this sprint; SEC-1 is unit-verified only.
4. The dependency advisories in DEP-1…4.
5. The Free plan has no backups (`docs/BACKUP_AND_RECOVERY.md`).

## Database test safety (final verification pass)

`supabase/tests/security_tests.sql`, reviewed statement by statement:
- One transaction: `begin;` at the top, `rollback;` at the end.
- No CREATE, ALTER, GRANT, REVOKE or policy changes. The only DDL is `pg_temp` helpers, which are session-scoped.
- The one `truncate` is attempted as the `authenticated` role and is expected to be refused.
- Fixtures use fixed UUIDs (`aaaaaaaa-…`, `bbbbbbbb-…`, `cccccccc-…-c1`) and a cache key `q:test`.
- **Side effects that would touch real data if the transaction were ever committed:** the crash-report purge deletes **every** report older than 90 days, and `delete_account()` deletes fixture user A. Both are undone by the rollback.

**Runtime check (`npm run test:db:safety`, disposable in-memory Postgres):**
- Seeded with pre-existing user data and a 100-day-old crash report.
- Ran the full script, and separately a copy with a failure injected after every write.
- Both left all tables, rate-limit counters and policies unchanged.

**Verdict:**
- **Safe for a disposable database: verified.**
- **On production: not verified.** It is designed to roll back, and Postgres never commits an aborted transaction. But it would briefly lock and write rows, and it would abort if any fixture UUID or the `q:test` cache key already exists there.
- **Recommendation:** run it on a Supabase branch or a restored copy, not on production.

## Authenticated-testing sprint (later on 2026-10-09)

- **Analytics (VER-2 upgraded):** the blocklist filter became a per-event allowlist (`EVENT_SCHEMA`): only declared keys of known events, with exact types, strings capped at 64. A static test ties every `track()` call site to the schema. The privacy policy now states the rule.
- **Export and deletion against RLS:** `npm run test:export` runs the app's export code as the `authenticated` role on PGlite. A client that asks for another user's id still gets only its own rows; `delete_account` leaves no row of the caller in any user table or `auth.users`.
- **Database review:** no new findings. The 106 security checks and 21 mutations still pass, and migration 6 re-runs cleanly. Migration 6 was **not** applied to production, and no mutating test was run against it.
- **Dependencies:** reconciled in `SECURITY.md`. New advisory: sprintf-js (test tooling only, no patched release).
