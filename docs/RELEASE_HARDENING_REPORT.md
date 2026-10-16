# RepProof release-hardening report (2026-10-14)

Scope: final production-hardening audit of the source, the production backend (read-only), the release bundle and the
100,000-user claim. Nothing in production was changed during this audit: no migrations, no deploys, no settings,
no uploads, no commits. Earlier in the week migration 7 was applied to production without the owner's explicit
approval (2026-10-13); this audit did not repeat that, and migration 8 below is written and tested only.

## Verdicts

1. **Production launch readiness: NOT READY.** The code that ships today has a confirmed progression bug (H1, fixed in
   source, not in any built bundle), the release bundle predates every fix in this report, transactional email cannot
   reach real users, and the owner-side Play, privacy and device gates are open. See "Remaining launch blockers".
2. **100,000-user capacity: NOT DEMONSTRATED.** Per-request cost was measured flat on a local single-process database up to
   3,000 users (3.6M sets); no concurrent load test has been run on staging, and the first real limits (disk, USDA quota,
   auth email, egress) are owner and plan decisions. See "Capacity assessment" and docs/LOAD_TEST_PLAN.md.

## ECC audit record

- ECC 2.2.3 (plugin `ecc`, 71 agents, 302 skills). GateGuard fact-forcing hooks were active throughout.
- Agents ran independently and read-only; each finding was then checked against the code by hand:

| Area | Agent | Result |
|---|---|---|
| Security and privacy | `ecc:security-reviewer` | 0 critical/high; F1 fixed, F7 fixed (not deployed), F3/F4/F5 owner, F2 not verified, F6 rejected (stale docs; migrations 6-7 are live, verified read-only) |
| React Native / TypeScript | `ecc:react-reviewer` | 11 findings; R1, R3, R4 (copy + warning), R5, R9 fixed; R2, R6, R7, R8, R10, R11 documented |
| Database and backend | `ecc:database-reviewer` (read-only production catalog) | No drift across 290 catalog signatures; F1 (migration history), F2 (backups) owner; F3/F4/F5 fixed in migration 8 (not applied); F6, F10 documented; F7 rollback note added to the runbook |
| Reliability | `ecc:silent-failure-hunter` | H1 (High) fixed; M1 fixed; L6 fixed; M2, M3, L1-L5 documented or merged with React findings |
| Accessibility | `ecc:a11y-architect` | 1, 2, 4, 6, 8 fixed, 3 partly (Training headings); 5, 7, 9, 10, 11 documented. No TalkBack device run |
| Android release | no ECC agent for this; done by hand with `jarsigner`, `keytool`, `unzip -t` and a protobuf manifest decoder | see "Release artifact" |
| Scalability | `ecc:performance-optimizer` | Capacity model and pass criteria (docs/LOAD_TEST_PLAN.md); SCALING_100K.md corrected |
| Final re-review | `ecc:code-reviewer` | see "Final review" |

## Release artifact (version code 5)

Inspected `C:\Users\laksh\Downloads\repproof-release.aab` on 2026-10-14.

| Check | Result | Evidence |
|---|---|---|
| Integrity | PASS | `unzip -t`: no errors; SHA-256 `15b8be4714389eeff2ba6edfcffb561c2d0fd6b9e2998049f786883062ae96ee` |
| Signature | PASS | `jarsigner -verify`: jar verified; certificate SHA-256 `EB:0C:72:75:A2:F3:A7:A1:00:F5:31:29:3D:95:8E:D4:5A:DA:45:F8:FA:C2:89:F1:1B:E9:FA:2E:07:66:04:0F`, the same EAS upload key as version codes 2 and 4 |
| Identity | PASS | `com.repproof.app`, versionName 1.0.0, versionCode 5, minSdk 24, targetSdk 36, compileSdk 36 |
| Debuggable, backup, cleartext | PASS | no `debuggable`; `allowBackup=false` with SecureStore backup exclusion rules; no `usesCleartextTraffic` or network-security override (Android 9+ default: HTTPS only) |
| Exported components | PASS | `MainActivity` (launcher and `repproof://` scheme only); `FirebaseInstanceIdReceiver` (guarded by `c2dm.permission.SEND`); `ProfileInstallReceiver` (guarded by `DUMP`); everything else `exported=false` |
| Permissions | PASS | CAMERA, INTERNET, VIBRATE, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK, internal receiver permission; app.json blocks 24 others |
| Endpoints | PASS | embedded config and bundle point at the production Supabase project only; the two `http://localhost` strings are library dev fallbacks |
| Firebase | NOTE | Firebase Messaging and Installations ship with expo-notifications, but no `google-services.json` is configured, so Firebase is not initialised |
| Source correspondence | NOT VERIFIED | EAS records no commit. The bundle contains strings from the 2026-10-13 fixes but **predates every fix in this report** (it has the H1 bug) |

## Fixed in this audit (source and tests; nothing deployed or built)

| ID | Severity | Defect | Fix | Regression test |
|---|---|---|---|---|
| H1 | High | Since migration 6 each saved set gets its own timestamp; `history()` read sets newest first, so `suggest()` saw the failure set as set 1 and held progress ("set 1 went to 0 in reserve") for users on the default effort style | `sessionsFromRows` orders each session by `set_index` (`src/engine/session.ts`, `src/lib/data.tsx`) | `engine.test.ts`: newest-first rows give [2, 2, 0] and no hold; the old order reproduced the false hold |
| R1 | Medium | Signing in showed onboarding's age check to a returning user until the profile loaded; an under-18 year there deletes the account | `load()` shows the spinner while a different account's data loads (`src/lib/data.tsx`) | `session.test.tsx` |
| R3 | Medium | Swapping to an exercise already in the workout created two items sharing every set | `substitutes(..., taken)` (`src/engine/exercises.ts`, `src/app/workout.tsx`) | `engine.test.ts` |
| R4 | Medium | Signing out silently discarded an unfinished workout while the copy said it was kept | the sign-out sheet warns when a draft exists; data copy corrected (`src/app/(tabs)/profile.tsx`) | copy and warning only |
| F1 | Low | A session ending without a manual sign-out (expiry, revoked, deleted) left coaching notes, calibration and exported files on the phone | `SIGNED_OUT` clears every per-account key and export file (`src/lib/prefs.ts`, `src/lib/supabase.ts`) | `device.test.tsx` |
| R5 | Low | "Save as meal" double tap saved two meals | `once()` lock (`src/app/(tabs)/nutrition.tsx`) | `fuel.test.tsx` |
| R9 | Low | In a daylight-saving fall-back week a late-Sunday workout was missing from the week dots | calendar-day indexing (`src/lib/stats.ts`) | `engine.test.ts` (America/New_York, 1 Nov 2026); the old logic was run and fails it |
| L6 | Low | "72,5" (comma keyboards) was NaN in food amounts, bodyweight and cardio | `toNumber` (`nutrition.tsx`, `progress.tsx`, `food.tsx`) | helper already unit-tested |
| M1 | Medium | A failed undo of a profile change was swallowed | reported to crash reports (`plan.tsx`, `training.tsx`, `workout.tsx`) | not separately tested (reporting only) |
| F7 | Info | The food query cap could split an emoji, making the upstream URL encoding throw | code-point cap, NFC, lone surrogates removed (`supabase/functions/food/request.ts`) | `security.test.ts`. **Not deployed** |
| A11y 1, 4 | High, Medium | The workout save failure and warning banners were not announced | `announceForAccessibility` (`workout.tsx`, `ui.tsx` Banner) | `workout.test.tsx`, `device.test.tsx` |
| A11y 2 | High | Welcome, age, plan-ready, offline and error screens could not scroll at large text | `Screen scroll={false}` scrolls when content is taller; children use `flexGrow` | screen tests render them; not checked at 200 % on a device |
| A11y 6 | Low-Medium | "Today" in the week plan was shown by colour only | spoken label and underline (`plan.tsx`, new `T label` prop) | `plan.test.tsx` |
| A11y 8 | Low | Cooldown ring 2.8:1 and Stepper border 1.3:1 | `C.control` (4.2:1) | token change |
| A11y 3 | Medium | Training settings groups had no headings | `header` on group titles | not separately tested |
| DB F3-F5 | Low | API roles hold MAINTAIN and sequence privileges; RLS on `private.rate_limits` exists in production but not in the migrations | migration 8 `20261014000000_privilege_tidy.sql`, **not applied** | 3 security assertions and 3 deliberately weakened controls; 38/38 caught |

Also added: `npm run test:capacity` (local capacity check), `loadtest/k6-staging.js` (refuses the production project),
`SKIP_LIVE=1` for `scripts/check-all.sh` (logged as skipped, never as passed).

## Verified pass (executed in this audit)

- Read-only production checks: the objects of migrations 1-7 are present; all 11 policies use `(select auth.uid())`;
  no drift across 290 catalog signatures; 0 rows violate the NOT VALID checks; no storage buckets.
- Secrets: `scripts/secret-scan.mjs` clean. `.env` holds two values, the Supabase URL and an `sb_publishable_` key,
  unchanged since its only commit (e4dd92b) and never a secret or service-role key; `.env.example` holds placeholders.
  The publishable key gives `anon` no table or function access (grants and RLS covered by the test suite). No rotation needed.
- Unit tests 88/88; database security tests pass with 38/38 weakened controls caught; screen tests and the full
  check run: see "Check run".
- Local capacity test at 1,000 and 3,000 users (docs/LOAD_TEST_PLAN.md §1).
- Git: every entry of the morning's status (67 modified, 35 untracked, 5 staged deletions) is unchanged in kind;
  nothing reset, stashed, cleaned or committed.

## Not verified

- Signed-in use of the live backend with a real account, on a real phone.
- TalkBack, 200 % font scale, keyboard behaviour, barcode camera and notifications on hardware.
- Supabase dashboard settings: password policy, leaked-password protection, CAPTCHA, email OTP length, anonymous
  sign-ins, SMTP.
- The sign-up rate-limit message for an unconfirmed address (security F2; needs a throwaway live account).
- `test:live` was skipped in this audit's check run: it sends refused anonymous requests and guessed sign-in codes to
  production, which this audit's rules forbid. It last passed on 2026-10-13.

## Blocked (owner, money, device or approval)

| Item | Why blocked | Minimum action |
|---|---|---|
| Rebuild the bundle with these fixes | Uploads source to Expo; not authorised in this audit | `npx eas-cli@latest build --platform android --profile production` (version code 6), then verify it |
| Record migration history | Writes production metadata | `supabase migration repair --linked --status applied 20261001000000 20261002000000 20261004000000 20261006000000 20261008000000 20261009000000 20261013000000` |
| Apply migration 8 | Production change | Approve, then `supabase db query --linked -f supabase/migrations/20261014000000_privilege_tidy.sql` and `supabase migration repair --linked --status applied 20261014000000`. Until then the three new assertions in `security_tests.sql` fail against production |
| Deploy the food function (F7) | Production deploy | `supabase functions deploy food --use-api` after approval |
| Custom SMTP | Email-provider account | Supabase → Authentication → Emails → SMTP settings |
| Auth hardening | Dashboard | Password minimum 10 with letters and digits, leaked-password protection, CAPTCHA (Turnstile), Email OTP length 8, confirm anonymous sign-ins are off |
| Backups and restore drill | Plan and dashboard | Pro plan for daily backups; a `supabase db dump` that includes `auth.users`, restored once into a scratch project |
| Privacy and deletion pages | Hosting | Host `site/dist`, set `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_DELETE_ACCOUNT_URL`, rebuild |
| Play Console | Owner account | Create the app, upload to internal testing, Data safety, health declaration, content rating, listing, screenshots |
| Closed test | Personal developer account | 12 testers opted in for 14 consecutive days before production access |
| Device testing | Phone | docs/AUTHENTICATED_TEST_CHECKLIST.md, including TalkBack and large text |
| Monitoring | Owner choice | Disk, CPU and error-rate alerts in Supabase; a weekly look at `client_errors` |

## Remaining launch blockers (ranked)

1. **The built code has H1** (wrong progression advice for most users): rebuild; do not upload version code 5.
2. **Auth email cannot reach users** (built-in SMTP: 2 an hour, team addresses only): sign-up confirmation and password
   reset fail for real users.
3. **No backups or restore drill on the Free plan**, and the project pauses after a week of inactivity.
4. **Privacy policy and deletion URLs not hosted**; Play requires both.
5. **No signed-in, on-device test** of a release build (sign-in, save, delete, TalkBack, large text).
6. **Supabase migration history is empty**: a future `supabase db push` would try to re-run migration 1.
7. **Food search quota**: one account at the per-user limit (20 a minute) can use most of the shared USDA hourly quota
   (security F3); needs a lower per-user cap or a higher USDA limit before a public launch.
8. Play Console forms and the 12-tester, 14-day closed test.

## Documented, not fixed (lower priority)

- R2: starting a workout offline is blocked (no cached history). R6: a days-old draft resumes silently. R7: Home shows
  "0 of 3" before data loads. R8: overlapping refreshes have no sequence guard. R10: a screen left open overnight shows
  yesterday until refocused. R11: onboarding answers live in memory only.
- M2: errors with a server code (expired JWT, RLS) read "Check your connection" and are not reported. M3 rejected:
  auth-js returns errors instead of throwing, so the sign-in busy flags reset. L3 waitlist metric, L4 PGRST202 fallback
  without a client id, L5 "Swap in plan" lock.
- Accessibility 5 (fixed heights and `numberOfLines` at large text), 7 (more headings), 9 (label-in-name),
  10 (targets under 48 dp), 11 (icon glyphs).
- Security F2 (sign-up rate-limit message), F3 (per-account storage abuse), F4 (6-digit OTP), F5 (anonymous sign-ins
  unverified). Database F6 (15 NOT VALID checks; validating them in a migration breaks the upgrade-path test on old
  rows), F10 (`workouts.program_id` cascades if a program is ever deleted by the owner).
- Engine: a 30-minute, 2-day full-body plan runs about 45 minutes on its second day in both coverage modes.

## Capacity assessment

Measured (local, single process): every app read uses an index; per-request medians unchanged from 1,000 to 3,000
users; `save_workout` 6.7-10.6 ms p50; heavy-user deletion 21-24 ms. Estimated (model, docs/LOAD_TEST_PLAN.md §2):
about 160 requests a second at the peak second for 100k MAU (354 for a single-timezone launch), within one database's
reach; the first limits are disk (about 51 GB a year at 30 % active), the shared USDA quota, auth email, egress
(about 650 GB a month uncompressed) and crash-report bursts. Unproven: concurrency, pooling, network latency, Supabase
plan limits under load, provider behaviour. Pass criteria: docs/LOAD_TEST_PLAN.md §5.

## Check run

`SKIP_LIVE=1 bash scripts/check-all.sh` on 2026-10-14 after the last change: exit 0, "done: all local checks passed
(live probes SKIPPED)". Typecheck 0, lint 0, unit tests 88/88, database security tests passed with 38/38 weakened
controls caught, rollback safety and export integration verified, screen tests 124/124 (21 suites), dependency audit
0 critical (shipped: 12 moderate, 19 high, unchanged; the shipped path is `decode-uri-component` behind `safeLink`),
Android JS export ok, secret scan clean. Live probes: SKIPPED. An earlier run in this audit failed lint once (a React
Compiler immutability error introduced by a fix); it was restructured, not suppressed.

## Final review

`ecc:code-reviewer` re-reviewed every change in this report: **APPROVE**, with six small items. Fixed: `load()` from
an auth event now falls back to the Offline screen instead of a permanent spinner if it throws (test in
`session.test.tsx`); the post-workout "Swap in plan" suggestion skips exercises already in that plan day; the age and
disclaimer screens use `flexGrow`; a run with live probes skipped no longer prints "all checks passed"; the security
test header names migrations 1-8. Accepted: the two `Screen` branches are now equivalent (cosmetic); any forced sign-out
also discards an unsaved draft (privacy over convenience; the sign-out sheet warns, an involuntary one cannot).
Production is Postgres 17.11, so migration 8's MAINTAIN revoke is valid there.

## Next actions

1. Approve and run a new production build (version code 6) so H1 and the other fixes ship; verify it as before.
2. Set up custom SMTP (Supabase → Authentication → Emails → SMTP) and the auth settings under "Blocked".
3. Move to Pro, take a dump that includes `auth.users`, and restore it once into a scratch project.
4. Run `supabase migration repair` for migrations 1-7; then decide on migration 8 and the food-function deploy.
5. Host the privacy and deletion pages, upload version code 6 to Play internal testing, and run the device checklist.

## Addendum: version code 6 and migration history (2026-10-14, after the report)

- Owner built `application-092cf53e-7709-4daa-92cf-bf26df6cc2e0.aab` (90,573,352 bytes, SHA-256
  `29b47e4cdd7704b3ea7c741960ba53b4e37f940d9206b09f5ab1f72e4692f1f1`). Verified: `unzip -t` clean; `jarsigner` jar verified;
  certificate SHA-256 `EB:0C:72:75:…:04:0F` (same upload key); `com.repproof.app` 1.0.0, versionCode 6, minSdk 24,
  targetSdk 36; `allowBackup=false`, not debuggable; manifest identical to version code 5 apart from the version;
  production Supabase project only. The Hermes bundle contains the fixes in this report (`sessionsFromRows`,
  `userKeysOnDevice`, the sign-out draft warning, `profile_revert`, the "today" label). This closes blocker 1 once it is
  uploaded instead of version code 5; it is still untested on a device.
- Owner ran `supabase migration repair` for migrations 1-7: `supabase migration list --linked` now shows all seven
  recorded remotely; migration 8 is local only (not applied). This closes blocker 6.

## Round 2 (2026-10-15): second ECC pass

Agents (read-only): `ecc:typescript-reviewer`, `ecc:pr-test-analyzer`, `ecc:comment-analyzer`, `ecc:security-reviewer`,
`ecc:react-reviewer` (performance), `ecc:database-reviewer` (PGlite only, no production access), then `ecc:code-reviewer`
on the fixes. No critical or high findings in the app. Fixed with tests:

- Streak lost the week after a DST change (`stats.ts`); deload drop could suggest 0.10000000000000009 kg (`progression.ts`,
  now on the plate grid, holds below one step); "1,000" read as 1 (`toNumber` refuses ambiguous thousands, hex, exponent);
  zero-gram rescale guard; Home falls back to day 0 for a stale `next_day` (display and link).
- `sessionRejected` no longer signs a device out (and wipes its draft) on a bare 401/403, only on specific auth codes.
- k6 script: production deny-list plus a `STAGING_REF` allow-list (a regex typo found by the re-review was fixed).
- Privacy policy (app and regenerated `site/dist`): setup vs Training-settings event fields corrected; export cache files
  disclosed; export contents and exclusions stated. Stale copy fixed in onboarding and decisions.
- Migration 8 (still NOT applied): `lock_timeout`, RLS enable only when off, per-user advisory lock in `replace_program`,
  `food_search_allowed` in plpgsql so refused bursts never spend the daily quota.
- Tests: account deletion now checked across every table with a `user_id` column (and the other account's rows kept);
  `replace_program` leaves one active plan; refused food searches keep the daily count at 20.

Check run `SKIP_LIVE=1 bash scripts/check-all.sh`: exit 0; unit 92/92; DB security pass, 38/38 weakened controls caught;
rollback safety and export integration verified; screens 124/124; audit 0 critical (dev total 64, shipped 31 unchanged);
export ok; secret scan clean; live probes SKIPPED. Not built: these fixes need version code 7 to reach users.

Documented, not fixed: birth-year-only age check admits some 17-year-olds (needs full date of birth: owner/legal
decision); crash-report 90-day purge only runs when a new report arrives (daily cron is an owner setup); `replace_program`
lock is not exercised by a concurrent test (PGlite is single-connection); P1-P4 render costs (React Compiler on).
