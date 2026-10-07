# Security

Last audit and remediation: 2026-10-06. No app is "unhackable". This file lists what is protected, how each
control is tested, and what is still open. The launch to-do list is in [PRODUCTION_SECURITY_CHECKLIST.md](PRODUCTION_SECURITY_CHECKLIST.md).

## Reporting a problem

Use GitHub's private reporting: Security tab -> Report a vulnerability. Please do not open a public issue for security problems.

## Threat model

The client is assumed hostile: anyone can change the app's JavaScript, its storage and its requests, or call
Supabase directly with the public key. Every security decision is therefore made on the server
(Postgres grants, row-level security, triggers, functions) or in the food edge function. The app's own checks
are for usability only.

## Controls

| Area | Control | Where | Tested by |
| --- | --- | --- | --- |
| Accounts | Supabase Auth (email + password; phone code optional). JWTs are verified by the API gateway; forged, unsigned and expired tokens are refused. Wrong passwords are rate limited per IP (stopped after 30 in 5 minutes). | Supabase | `npm run test:live` |
| Account enumeration | Wrong password and unknown email get the same answer; reset and resend answer the same for every address; sign-up shows the same "enter the code" step for new and existing addresses. | `src/lib/authFlow.ts`, `src/lib/errors.ts` | `npm test`, `npm run test:live` (+ `test:live:auth` with a test account) |
| Password reset | 6-10 digit code from the email, typed into the app (no link carries a session). The recovery session lives in a throwaway in-memory client, never on the device; after the new password is set, every session of the account is ended and the user signs in again. Wrong or expired codes get one generic message; resend has a 60 s cooldown on top of Supabase's per-address limit. | `src/app/forgot-password.tsx` | `npm test`, `npm run test:live`, browser test |
| Email confirmation | Same code flow after sign-up (and when an unconfirmed account signs in with the right password), with resend + cooldown. Works whether confirmation is on or off. | `src/app/sign-in.tsx` | `npm test` |
| CAPTCHA | Cloudflare Turnstile in a locked-down WebView (fixed page, validated site key, validated messages, navigation limited to Cloudflare) sends a single-use token with every request Supabase checks: sign-up, password sign-in, phone code, reset, resend. Without a site key nothing is shown or sent; if the check fails the user gets a retry button. | `src/auth-ui.tsx`, `src/lib/captcha.ts` | `npm test` (incl. a scan that every gated call sends a token), `npm run test:live` |
| Sessions | Sessions only come from the app's own sign-in calls: never from links (`detectSessionInUrl: false`, auth parameters stripped from incoming links), so a crafted link cannot plant someone else's session. Sign-out ends the session everywhere (refresh tokens revoked). | `src/lib/supabase.ts`, `src/lib/links.ts` | `npm test`, `npm run test:live:auth` |
| Data isolation | Row-level security on every table: a user reads and writes only rows with their own `user_id`; workouts and sets must point at the user's own program and workout. | migrations 1-2 | `npm run test:db` |
| Least privilege | Anonymous role has no table privileges. Users cannot TRUNCATE, cannot read analytics, feedback, the food cache or rate-limit counters, and cannot edit saved workouts or sets. | migration 4 | `npm run test:db` |
| Privilege escalation | `plan_tier` is not writable by users (column grants). Admin metric and rate limiter are not callable by users. A forged `role` claim changes nothing. | migrations 2, 4 | `npm run test:db` |
| Abuse limits | Per-user write limits on every table (row triggers, so bulk inserts and RPCs count every row), plan and profile rewrite limits, size caps on every free-form field (JSON measured as text, so compressible payloads do not slip through). | migrations 2, 4 | `npm run test:db` |
| Workout integrity | `save_workout()` is one transaction, idempotent per client id (unique index; a concurrent duplicate returns the first save), and the server sets the finish time and clamps the start time on every insert path. | migration 4 | `npm run test:db` |
| Food search | Signed-in users only (`verify_jwt` + a per-user check as the caller), POST only, body ≤ 1 KB, validated and normalised input, 20 searches a minute and 500 a day per user, 8 s upstream timeout, fixed upstream hosts, USDA key sent in a header (never in URLs or logs), generic error replies, expired cache entries purged. | `supabase/functions/food` | `npm test`, `deno check` |
| Error messages | Users see fixed messages only: no table, column or constraint names, no stack traces, and sign-in/sign-up errors do not reveal whether an account exists. Full errors are logged in development builds only. | `src/lib/errors.ts` | `npm test` |
| Session on the device | Stored in the iOS Keychain / Android Keystore (`expo-secure-store`, this device only), split into chunks under the platform size limit. Sessions saved by older versions are moved over once and erased from plain storage. A reinstall does not inherit an old Keychain session. | `src/lib/chunked.ts`, `src/lib/supabase.ts` | `npm test` |
| Local health data | The unsaved workout (with check-in answers) is erased whenever the session ends, however it ends. | `src/lib/supabase.ts` | code review |
| Deep links | Links that do not decode cleanly, are over 2 KB, or carry auth tokens or codes go to the home screen instead of the router (blocks the `decode-uri-component` slow path and session fixation). | `src/app/+native-intent.tsx` | `npm test` |
| Analytics | Events carry no health answers: check-in events record only that a check-in happened; pain reports are not sent. | `src/app/workout.tsx` | `npm test` (source scan) |
| Secrets | Only the Supabase URL and publishable key ship in the app. The service key and USDA key live in Supabase secrets. Repo, full git history and the built bundle are scanned on every push. | `scripts/secret-scan.mjs` | CI |
| CI | Read-only token, no secrets, actions pinned to commit SHAs (kept current by Dependabot), production bundle build, critical `npm audit` gate. | `.github/workflows/ci.yml` | GitHub Actions |

### How the tests prove something

- `npm run test:db` runs every migration and `supabase/tests/security_tests.sql` (77 checks) on an in-memory
  Postgres with a stand-in for Supabase's `auth` schema and default grants. It then removes 15 controls one at
  a time (row-level security, ownership check, column grants, anonymous grants, rate limits, size cap, duplicate
  guard, server time, food quota, ...) and fails unless the suite catches every one.
- `npm test` covers the app-side controls; each was also checked by deliberately breaking it.
- `npm run test:live` probes the real project as an outsider (no account, forged tokens). It creates nothing.
- The stand-in is not Supabase itself, so run `security_tests.sql` once on the real project too (checklist).

## Data map (for the privacy policy)

| Data | Where | Who can read it | Deleted by |
| --- | --- | --- | --- |
| Email or phone number, password hash | Supabase Auth | User; project owner | Delete account |
| Birth year, sex (optional), height, bodyweight, experience, goal, schedule, unit, movements to avoid | `profiles` | User; project owner | Delete account |
| Programs, workouts, sets | `programs`, `workouts`, `logged_sets` | User; project owner | Delete account |
| **Health-related:** check-ins (sleep, soreness, energy) | `workouts.checkin`; on the phone in the unsaved workout until it is saved or the session ends | User; project owner | Delete account / sign-out (phone copy) |
| **Health-related:** pain reports | Not stored or sent. If the user chooses "avoid this movement", only the movement pattern is added to `profiles.avoid` | User; project owner | Delete account |
| Food, saved meals, cardio, bodyweight logs | own tables | User; project owner | Delete account |
| Feedback and survey answers | `feedback` | Project owner only | Delete account |
| Usage events (button-level actions; no free text, no health answers) | `events` | Project owner only | Delete account |
| Food search text and barcodes | Open Food Facts (from the phone, and from the food function) and USDA (from the food function). Cached by query, not by user | Those services | Cache entries expire after 30 days |
| Login session | iOS Keychain / Android Keystore | This app on this device | Sign-out / delete account |
| Security check (when CAPTCHA is on) | Cloudflare Turnstile sees the device's IP address and browser signals during sign-in, sign-up and reset | Cloudflare | Cloudflare's retention |
| Emails with codes (when custom SMTP is on) | Your email provider sends them | The provider | Provider's retention |
| Coach notes (training decisions), survey and waitlist flags | Phone storage (SQLite), per user | Anyone with the unlocked phone | Uninstall |

Nothing is sent to third-party analytics, crash reporting or advertising services. Logs: the food function
logs only an error type; the app logs errors only in development builds.

## Known remaining risks

See "Remaining accepted risks" in [PRODUCTION_SECURITY_CHECKLIST.md](PRODUCTION_SECURITY_CHECKLIST.md).
