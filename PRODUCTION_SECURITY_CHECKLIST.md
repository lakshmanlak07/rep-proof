# Production security checklist

Status as of 2026-10-06. Tick items as you do them. Dashboard menu names are Supabase's and GitHub's current
labels; if one has moved, search the settings page for the setting name.

## 1. Automatically fixed (changed in the repo and verified)

| Fixed | Verified by |
| --- | --- |
| Per-user write limits on every table (bulk inserts and RPCs count every row); plan/profile rewrite limits | `npm run test:db` (incl. mutation checks) |
| Size caps on every free-form field; JSON measured as text so compressible payloads cannot slip through | `npm run test:db` |
| Anonymous role stripped of all table privileges; users cannot TRUNCATE, read analytics/feedback/cache/counters, or edit saved workouts | `npm run test:db` |
| Workout saves: atomic, idempotent, concurrent duplicates return the first save, server-set finish time, clamped start time (also for direct API inserts) | `npm run test:db` |
| Food search: per-user quota, signed-in only, POST only, 1 KB body cap, validated input, upstream timeout, key never in URLs or logs, generic errors, cache purge | `npm test`, `deno check` |
| No raw server/database/auth text in the UI; no account-existence hints; dev-only error logging | `npm test` |
| Login session moved from plain SQLite to Keychain/Keystore, with one-time migration and reinstall protection | `npm test` |
| Unsaved workout (check-in answers) erased whenever the session ends | code review |
| Health answers and pain reports removed from analytics | `npm test` |
| Malformed or oversized deep links routed home (mitigates `decode-uri-component`) | `npm test` |
| CI: read-only token, SHA-pinned actions + Dependabot, DB security and mutation tests, production bundle build, secret scan of repo + history + bundle, critical audit gate | GitHub Actions |
| Live outsider probes (anonymous access, forged/unsigned/expired tokens, error bodies) | `npm run test:live` |

## 2. Manual Supabase actions

Do 2.1 and 2.2 first; the rest before public launch.

- [ ] **2.1 Apply migration 4.** SQL Editor -> New query -> paste `supabase/migrations/20261006000000_abuse_limits_and_atomic_saves.sql` -> Run. Until then the rate limits, size caps, grant changes and server-side saves are **not live**.
- [ ] **2.2 Verify on the real database.** SQL Editor -> paste `supabase/tests/security_tests.sql` -> Run. Expect `ALL SECURITY TESTS PASSED` (it rolls back; no data kept). Then run `npm run test:live` locally; every line should say `ok`.
- [ ] **2.3 Password policy.** Authentication -> Sign In / Providers -> Email: minimum password length **10** (at least 8); password requirements **letters and digits**. "Prevent use of leaked passwords": **on** (needs the Pro plan; if you are on Free, note it as an accepted risk).
- [ ] **2.4 Email confirmation.** First set up custom SMTP (Authentication -> Emails -> SMTP Settings, e.g. Resend, Postmark, SES); Supabase's built-in sender only mails your own team and is limited to a few emails an hour. Then Authentication -> Sign In / Providers -> Email: **Confirm email: on**, **Secure email change: on**, **Secure password change: on**. With confirmation off, anyone can sign up with an address they do not own, and the raw Auth API reveals whether an email is registered.
- [ ] **2.5 Redirect URLs.** Authentication -> URL Configuration: Site URL `repproof://`; Redirect URLs: `repproof://**`. Remove `localhost` entries for production.
- [ ] **2.6 Sessions.** Authentication -> Sessions: refresh token reuse detection **on** (reuse interval 10 s). JWT expiry: keep **3600 s** (do not raise it). Optional (Pro): inactivity timeout 30 days.
- [ ] **2.7 Auth rate limits.** Authentication -> Rate Limits: keep sign-ups/sign-ins at the default (about 30 per 5 minutes per IP) or lower; token verifications 30 per 5 minutes; SMS per hour as low as your testers need (e.g. 10).
- [ ] **2.8 Phone sign-in.** Leave the Phone provider **off** unless you need it. If you turn it on: SMS provider with a spending cap, allow only the countries you serve (in the SMS provider's console, e.g. Twilio Geo Permissions), and keep the SMS rate limit low. SMS pumping fraud costs real money.
- [ ] **2.9 CAPTCHA: do not switch on yet.** Authentication -> Attack Protection -> CAPTCHA would block every sign-in, because the app does not send CAPTCHA tokens. Turning it on needs an app change first (hCaptcha or Turnstile in a web view, passing `captchaToken` to sign-up/sign-in/OTP). Do this before a public launch or before enabling phone sign-in.
- [ ] **2.10 Data API.** Project Settings -> Data API: exposed schemas **public** only (never add `private`); max rows **1000**.
- [ ] **2.11 Database.** Database -> Settings: SSL enforcement **on**. Keep the database password long and unique; never put it in the app or the repo.
- [ ] **2.12 Food function (optional).** `npx supabase secrets set FDC_API_KEY=<key>` then `npx supabase functions deploy food` (uses `supabase/config.toml`: `verify_jwt = true`). Never deploy it with `--no-verify-jwt`.
- [ ] **2.13 Account security.** Turn on MFA for your Supabase account (Account -> Security). Invite collaborators with the least role they need.
- [ ] **2.14 Backups.** Free plan: daily backups, 7 days. Before real users depend on it, consider Pro for point-in-time recovery.

Why not `supabase config push`? It would also push every setting missing from `config.toml` at its default
(for example the Site URL), so the dashboard is the safer place for these settings.

## 3. Manual GitHub actions

- [ ] Settings -> Code security: **Private vulnerability reporting: on**, **Dependabot alerts: on**, **Dependabot security updates: on**, **Secret scanning** and **Push protection: on** (free on public repos).
- [ ] Settings -> Branches -> add a rule (or ruleset) for `main`: require the **CI** checks to pass; block force pushes and deletion.
- [ ] Settings -> Actions -> General: workflow permissions **Read repository contents**; do not allow Actions to approve pull requests.
- [ ] Turn on two-factor authentication for your GitHub account.
- [ ] Decide on visibility. The repo is public: no secrets are in it (scanned, including history), but the database design is visible. If you make it private, secret scanning needs GitHub Advanced Security; keep the CI secret scan.

## 4. Manual app-store actions

- [ ] **Device test the new session storage**: on a phone (Expo Go or a build), sign in, close and reopen the app (still signed in), sign out, sign in again. Existing testers should stay signed in after updating.
- [ ] Privacy policy at a public URL, matching the data map in `SECURITY.md` (health-related check-ins included; no third-party analytics or ads).
- [ ] App Store Connect -> App Privacy: Contact info (email / phone), Health & Fitness, User ID, Product interaction; all linked to the user, not used for tracking.
- [ ] Google Play -> Data safety: same data; encrypted in transit; users can request deletion. Play also requires a **web link for account deletion**: add a page or email address that deletes accounts on request.
- [ ] Keep `ITSAppUsesNonExemptEncryption: false` (the app uses only standard HTTPS and OS encryption).
- [ ] Signing keys: let EAS manage them (`npx eas-cli@latest credentials`); never commit `.jks`, `.p8`, `.p12` or `.mobileprovision` files (already in `.gitignore`).
- [ ] Before each release: `npm ci && npm test && npm run test:db && npm run scan:secrets -- --history`.

## 5. Remaining accepted risks

| Risk | Why it remains | Mitigation |
| --- | --- | --- |
| `decode-uri-component` advisory (moderate, GHSA-vcc3-ghjq-m6fr) | Ships inside expo-router 57 via `query-string`. The only fixed version is ESM-only and breaks `query-string`; the fix is expo-router 58 (Expo SDK 58), a major upgrade. | Deep-link guard sends malformed or oversized links home before parsing. Remove the risk by upgrading to SDK 58 after the beta. |
| Build-tool advisories (`braces`, `micromatch`, `node-forge`, `uuid`, `xcode`, metro, Expo CLI) | Used only when building, not shipped in the app. npm's suggested "fixes" are downgrades that break Expo. | Recheck on each `npx expo install --fix` / SDK upgrade. CI fails on any critical advisory. |
| Account enumeration and squatting via the raw Auth API | Confirmation is off for the beta (needs SMTP). | Fixed by checklist item 2.4. The app's own messages do not reveal accounts. |
| No CAPTCHA | Needs app work (see 2.9). | Supabase's per-IP auth rate limits; phone sign-in kept off. |
| Mass account creation by bots | Same as above. | Per-IP auth limits; per-user write limits cap what each account can do. |
| Read flooding by a signed-in user (own rows only) | Postgres cannot rate-limit reads cheaply; Supabase's platform limits apply. | Max rows 1000; users can only read their own data. |
| Rooted or jailbroken phone | Keychain/Keystore can be read on a compromised device. | Out of scope for an app of this kind. |
| Concurrent-save branch of `save_workout` | The test database has one connection, so two truly simultaneous saves cannot be run in CI. | The unique index that guarantees one result is tested; the handler only returns the existing row. |
| CORS `*` on the food function | Needed for the web build. | Bearer-token auth only (no cookies), so another website gains nothing. |
| Public repository | Your choice (see section 3). | No secrets in repo or history; CI scans every push. |
