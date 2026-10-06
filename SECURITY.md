# Security

Last audit: 2026-10-06. No app is "unhackable"; this file lists what is protected, how it is tested, and what is still open.

## Reporting a problem

Use GitHub's private reporting: Security tab -> Report a vulnerability. Please do not open a public issue for security problems.

## How the app is protected

| Layer | Protection | Tested by |
| --- | --- | --- |
| Accounts | Supabase Auth (email + password, optional phone code). Sessions are Supabase JWTs. | Supabase |
| Data access | Row-level security on every table: a user reads and writes only rows with their own `user_id`. Workouts and sets must point at the user's own program and workout. | `supabase/tests/security_tests.sql` |
| Privilege | Users cannot change `profiles.plan_tier` (column grants). Admin metric, rate limiter and food cache are not reachable by users. | same |
| Abuse | Per-user insert limits on every table and size caps on every free-form field (migration 4). Food search: 20 a minute, 500 a day. | same |
| Integrity | Workout saves are one transaction, retry-safe (client id), with a server-set finish time. | same |
| Errors | The app never shows raw server messages; sign-in errors do not say whether an account exists. | `npm test` |
| Secrets | Only the Supabase URL and publishable key ship in the app. The USDA key and service-role key live only in Supabase secrets. Git history scanned: no secrets. | manual scan |
| Food function | Signed-in users only (`verify_jwt`), POST only, input trimmed and length-capped, per-user quota. | `deno check` |
| CI | Read-only token, actions pinned to commit SHAs, `npm audit` gate (critical). | GitHub Actions |

`npm run test:db` runs every migration plus the security tests on an in-memory Postgres (PGlite) with a stand-in for Supabase's `auth` schema. It proves the policies, grants and triggers behave as written. It does not replace running `security_tests.sql` on the real project once.

## Data map (for the privacy policy)

| Data | Where | Who can read it | Deleted by |
| --- | --- | --- | --- |
| Email or phone number, password hash | Supabase Auth | User; project owner | Delete account |
| Birth year, sex (optional), height, bodyweight, experience, goal, schedule, unit | `profiles` | User; project owner | Delete account |
| Programs, workouts, sets, check-ins (sleep, soreness, energy), pain reports | `programs`, `workouts`, `logged_sets`, `events` | User; project owner | Delete account |
| Food, saved meals, cardio, bodyweight logs | own tables | User; project owner | Delete account |
| Feedback and survey answers | `feedback` | Project owner only | Delete account |
| Usage events (screen actions, no free text) | `events` | Project owner only | Delete account |
| Food search text and barcodes | Sent to Open Food Facts (from the phone) and USDA (via the food function); cached by query, not by user | Those services | Cache expires after 30 days |
| Session token, unsaved workout, coach notes | Phone storage (SQLite) | Anyone with the unlocked phone | Sign out / uninstall |

Check-ins and pain reports are health-related. Say so in the privacy policy and store data-safety forms.

## Known remaining risks

- Email confirmation is off for the beta: someone can sign up with an address they do not own. Turn it on (with custom SMTP) before public launch.
- Phone sign-in can be abused to send paid texts (SMS pumping). Enable CAPTCHA and SMS limits before switching it on.
- The session token is stored unencrypted on the phone (normal for Supabase apps; a stolen unlocked phone is out of scope).
- `npm audit` reports advisories in build tools and in `decode-uri-component` (a malformed deep link could freeze the app). No compatible fix upstream yet; recheck on each Expo upgrade.
- The repository is public. No secrets are in it, but the database design is visible.
- The food function allows any web origin (CORS `*`). It uses no cookies, so this does not expose user data.

## Production checklist

See the "Manual actions" list in the 2026-10-06 audit report; the short version:

1. Run migration 4, then `supabase/tests/security_tests.sql` (expect `ALL SECURITY TESTS PASSED`).
2. Auth settings: minimum password length 8, leaked-password protection on, rate limits reviewed, CAPTCHA on.
3. Before public launch: email confirmation on with custom SMTP; phone sign-in only with CAPTCHA and SMS limits.
4. Deploy the food function with `npx supabase functions deploy food` (keeps `verify_jwt`).
5. Publish a privacy policy that matches the data map above.
6. GitHub repo -> Settings -> Security -> turn on private vulnerability reporting and Dependabot alerts.
