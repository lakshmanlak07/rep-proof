# Production security checklist

Status as of 2026-10-07. Tick items as you do them. Dashboard menu names are Supabase's, Cloudflare's and
GitHub's current labels; if one has moved, search the settings page for the setting name.

## 1. Automatically fixed (changed in the repo and verified)

| Fixed | Verified by |
| --- | --- |
| Per-user write limits on every table (bulk inserts and RPCs count every row); plan/profile rewrite limits | `npm run test:db` (incl. mutation checks) |
| Size caps on every free-form field; JSON measured as text so compressible payloads cannot slip through; caps apply to new rows so old data cannot block the migration | `npm run test:db` |
| Anonymous role stripped of all table privileges; users cannot TRUNCATE, read analytics/feedback/cache/counters, or edit saved workouts | `npm run test:db` |
| Workout saves: atomic, idempotent, concurrent duplicates return the first save, server-set finish time, clamped start time (also for direct API inserts) | `npm run test:db` |
| Food search: per-user quota, signed-in only, POST only, 1 KB body cap, validated input, upstream timeout, key never in URLs or logs, generic errors, cache purge | `npm test`, `deno check` |
| No raw server/database/auth text in the UI; no account-existence hints; dev-only error logging | `npm test` |
| Login session in Keychain/Keystore, with one-time migration and reinstall protection | `npm test` |
| Unsaved workout (check-in answers) erased whenever the session ends; health answers and pain reports kept out of analytics | `npm test` |
| Malformed or oversized deep links routed home; links carrying auth tokens or codes never reach the router (no session from a link) | `npm test` |
| **Password reset** with an emailed code typed into the app; same answer for every address; recovery session kept in memory only; new password checked; all sessions ended afterwards | `npm test`, browser test, `npm run test:live` |
| **Email confirmation** by code, with resend and a 60 s cooldown; works whether confirmation is on or off | `npm test`, `npm run test:live` |
| **CAPTCHA** (Cloudflare Turnstile) on every endpoint Supabase gates: sign-up, password sign-in, phone code, reset, resend. Off until a site key is set; retry button if the check fails | `npm test` |
| CI: read-only token, SHA-pinned actions + Dependabot, DB security and mutation tests, production bundle build, secret scan of repo + history + bundle, critical audit gate | GitHub Actions |
| Live outsider probes: anonymous access, forged/unsigned/expired tokens, enumeration via sign-in/reset/resend, guessed codes, brute force, CAPTCHA state | `npm run test:live` |

## 2. Manual Supabase settings

- [ ] **2.1 Apply migration 4 (not live as of 2026-10-07).** The live API still reports `column workouts.client_id does not exist`, so the earlier run did not take effect. The most likely cause: a row saved before the migration broke one of its new size limits (for example a food name over 200 characters), and the SQL Editor rolled the whole script back. The migration now applies those limits to new rows only.
  SQL Editor -> New query -> paste the **current** `supabase/migrations/20261006000000_abuse_limits_and_atomic_saves.sql` -> Run. If it shows an error, copy the message.
  Check it: `select to_regclass('private.rate_limits') is not null as migration_4_applied;` must return `true`.
- [ ] **2.2 Verify on the real database.** SQL Editor -> paste `supabase/tests/security_tests.sql` -> Run. Expect `ALL SECURITY TESTS PASSED` (it rolls back). Then `npm run test:live`; every line should say `ok`.
- [ ] **2.3 Password policy.** Authentication -> Sign In / Providers -> Email: minimum password length **10**; password requirements **letters and digits** (the app asks for the same). "Prevent use of leaked passwords": **on** (Pro plan).
- [ ] **2.4 Email OTP.** Authentication -> Sign In / Providers -> Email: Email OTP expiration **900** seconds (15 minutes); Email OTP length **6**.
- [ ] **2.5 Email templates (code only).** Authentication -> Emails -> Templates:
  - "Confirm signup": paste `supabase/templates/confirm-signup.html`; subject "Your RepProof code".
  - "Reset Password": paste `supabase/templates/reset-password.html`; subject "Your RepProof reset code".
  The templates contain `{{ .Token }}` and no link. Do this before 2.6, or confirmation emails will contain a link the app ignores.
- [ ] **2.6 Email confirmation: after section 3 (SMTP) works.** Authentication -> Sign In / Providers -> Email: **Confirm email: on**, **Secure email change: on**, **Secure password change: on**. Then sign up with a fresh address in the app: you should get a code, and entering it should open onboarding.
- [ ] **2.7 Redirect URLs.** Authentication -> URL Configuration: Site URL `repproof://`; Redirect URLs `repproof://**` only (remove `localhost` entries). The app does not use links for sign-in, but Supabase needs a safe default.
- [ ] **2.8 Sessions.** Authentication -> Sessions: "Detect and revoke potentially compromised refresh tokens" **on**, reuse interval **10** s. JWT expiry (Project Settings -> JWT / API): **1800** s or less. A signed-out access token still works against the database until it expires, so shorter is safer; 900-3600 s is the usual range.
- [ ] **2.9 Auth rate limits.** Authentication -> Rate Limits: sign-ups and sign-ins **30 per 5 minutes per IP** (measured: wrong passwords stopped after 30); token verifications **30 per 5 minutes**; emails per hour: what your SMTP plan allows (e.g. 100); SMS per hour **10** if phone is on.
- [ ] **2.10 Phone sign-in.** Leave the Phone provider **off** unless needed. If on: CAPTCHA first (section 4), SMS provider spending cap, allowed countries only (e.g. Twilio Geo Permissions), low SMS rate limit.
- [ ] **2.11 Data API.** Project Settings -> Data API: exposed schemas **public** only; max rows **1000**.
- [ ] **2.12 Database.** Database -> Settings: SSL enforcement **on**; long unique database password, never in the app or repo.
- [ ] **2.13 Food function (optional).** `npx supabase secrets set FDC_API_KEY=<key>`, then `npx supabase functions deploy food` (keeps `verify_jwt = true`).
- [ ] **2.14 Account security and backups.** MFA on your Supabase account; least-privilege roles for collaborators; consider Pro for point-in-time recovery.
- [ ] **2.15 Account checks.** Create a throwaway account in the app, put `RP_TEST_EMAIL` / `RP_TEST_PASSWORD` in `.env.local` (git-ignored), run `npm run test:live:auth` **while CAPTCHA is still off**. It checks enumeration against a real account, refresh-token replay and reuse detection, and sign-out revocation.

Why not `supabase config push`? It also pushes every setting missing from `config.toml` at its default
(for example the Site URL), so the dashboard is the safer place for these settings.

## 3. Manual SMTP settings (needed before email confirmation)

Supabase's built-in sender only delivers to your own team's addresses and a few emails an hour, so testers
would never get their codes.

- [ ] Pick a provider: Resend, Postmark, Amazon SES, Brevo or SendGrid. A free tier is enough for the beta.
- [ ] Verify a sending domain you own (add the SPF, DKIM and DMARC DNS records the provider gives you). Use a subdomain such as `mail.yourdomain.com`.
- [ ] Authentication -> Emails -> SMTP Settings: **Enable custom SMTP**; host / port **587** / username / password from the provider; sender email e.g. `no-reply@mail.yourdomain.com`; sender name `RepProof`. Keep the SMTP password only here.
- [ ] Authentication -> Rate Limits: raise "emails sent per hour" to your plan's allowance.
- [ ] Test: Forgot password in the app with your own address -> the code arrives within a minute, not in spam -> set a new password -> sign in.
- [ ] Then do 2.6.

## 4. Manual CAPTCHA settings (Cloudflare Turnstile)

Order matters: the app must send tokens **before** Supabase requires them, or every sign-in fails.

- [ ] **4.1 Create the widget.** Cloudflare dashboard (free account) -> Turnstile -> Add widget: name "RepProof"; hostname **`repproof.app`** (the app's check page uses this name; it is set in `src/lib/captcha.ts`); widget mode **Managed**; pre-clearance **off**. Copy the **site key** and the **secret key**.
- [ ] **4.2 Ship an app that sends tokens.** Put `EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key>` in `.env` (public, safe to commit), make a new build, and confirm sign-in works on a phone: a small "Verify you are human" box appears above the buttons and usually ticks itself. Supabase ignores the tokens at this stage.
- [ ] **4.3 Wait until every tester has updated.** Older builds send no token and will be locked out by 4.4.
- [ ] **4.4 Switch it on.** Supabase -> Authentication -> Attack Protection -> Enable CAPTCHA protection: provider **Turnstile**, paste the **secret key**. Then run `npm run test:live`: it should print "CAPTCHA enforced: missing token refused" and "invalid token refused".
- [ ] **4.5 Check the app once more:** sign in, sign up, Forgot password, resend code.
- [ ] **If Turnstile ever blocks real users** (Cloudflare outage, a phone's WebView cannot load it): switch CAPTCHA off in Supabase. That takes effect immediately and needs no app update.
- [ ] Never put the secret key in the app, `.env` or the repo; the secret scanner only allows the site key there.

## 5. Manual GitHub actions

- [ ] Settings -> Code security: **Private vulnerability reporting**, **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** and **Push protection**: all on.
- [ ] Settings -> Branches: rule for `main`: require the **CI** checks; block force pushes and deletion.
- [ ] Settings -> Actions -> General: workflow permissions **Read repository contents**.
- [ ] Two-factor authentication on your GitHub account.
- [ ] Repo visibility: public is fine (no secrets, scanned); private hides the design but loses free secret scanning.

## 6. Manual app-store actions

- [ ] **Device test** on iPhone and Android (Expo Go or a build): sign in, reopen (still signed in), sign out; Forgot password end to end; sign-up with confirmation code (after 2.6); CAPTCHA box (after 4.2).
- [ ] Privacy policy at a public URL matching the data map in `SECURITY.md`; mention Cloudflare Turnstile (security check) and your email provider as processors.
- [ ] App Store Connect -> App Privacy and Google Play -> Data safety: contact info, health & fitness, user ID, product interaction; linked to the user; not used for tracking.
- [ ] Google Play requires a **web link for account deletion**.
- [ ] Signing keys managed by EAS; never commit key files.
- [ ] Before each release: `npm ci && npm test && npm run test:db && npm run scan:secrets -- --history`.

## 7. Remaining accepted risks

| Risk | Why it remains | Mitigation |
| --- | --- | --- |
| Migration 4 not yet live | Needs you (2.1). | Until then: no write limits, old grants, client-side saves. |
| Email confirmation off | Needs SMTP (section 3). Until then anyone can sign up with an address they do not own, and the raw Auth API reveals whether an email is registered. | App messages reveal nothing; switch on per 2.6. |
| CAPTCHA not yet enforced | Needs the rollout in section 4. | Supabase per-IP limits (wrong passwords stopped after 30 per 5 minutes). |
| Access token valid after sign-out until it expires | How Supabase JWTs work: the database API checks the signature and expiry, not whether the session still exists. | Refresh tokens die at sign-out; keep JWT expiry short (2.8). |
| CAPTCHA depends on Cloudflare | If Turnstile cannot load, sign-in waits on the retry button. | Switch CAPTCHA off in Supabase (instant, no app update). |
| No CAPTCHA on the web build | Turnstile runs in a native WebView; the web build is for development only. | Do not ship the web build while CAPTCHA is on. |
| `decode-uri-component` advisory (moderate) | Only fixed in expo-router 58 (Expo SDK 58), a major upgrade. | Deep-link guard; upgrade after the beta. |
| Build-tool advisories | Not shipped in the app; npm's "fixes" are downgrades that break Expo. | Recheck on each SDK upgrade; CI fails on critical. |
| Read flooding of a user's own rows | Postgres cannot rate-limit reads cheaply. | Max rows 1000; own rows only. |
| Rooted or jailbroken phone | Keychain/Keystore readable on a compromised device. | Out of scope. |
| Concurrent-save branch of `save_workout` | The test database has one connection. | The unique index behind it is tested. |
| CORS `*` on the food function | Needed for the web build. | Bearer-token auth only, no cookies. |
| Public repository | Your choice. | No secrets in repo or history; CI scans every push. |
