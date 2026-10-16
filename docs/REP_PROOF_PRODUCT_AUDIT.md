# RepProof — Product Audit (Phase 1 + Phase 3)

Audit date: 2026-10-09. Branch `ui-refresh` (2 commits ahead of `origin/main`, unpushed). Audit only; no code changed.

Related docs (not duplicated here): `SECURITY.md`, `PRODUCTION_SECURITY_CHECKLIST.md`, `README.md`.

## 1. Baseline checks actually run this session

| Check | Command | Observed result |
|---|---|---|
| Types | `npx tsc --noEmit` | pass, 0 errors |
| Lint | `npm run lint` | pass |
| Unit tests | `npm test` | 58/58 pass |
| DB / RLS tests (PGlite) | `npm run test:db` | ~80 PASS, all security tests pass, 15/15 mutations caught |
| Live probe (anon, read-only) | `npm run test:live` | 35 ok / 0 fail |
| Secret scan | `npm run scan:secrets` | clean |
| Dependency audit | `npm audit` | 0 critical, 19 high, 11 moderate (not yet triaged runtime vs dev) |
| Live signed-in tests | `test:live:auth`, `test:live:app` | **not run this turn** (throwaway creds absent from `.env.local`); passed in an earlier session |
| Android release build | `eas build` | **never run** |
| Real device | — | **never run** (deferred by owner) |

## 1b. Re-run after the sprint (2026-10-09)

| Check | Result |
|---|---|
| tsc / lint | clean / clean |
| `npm test` | 65/65 (74/74 after the final verification pass; see TEST_EVIDENCE.md) |
| `npm run test:db` | 93 PASS, 19/19 mutations caught (106 PASS, 21/21 after the deep audit) |
| `npm run test:live` | 35/35 ok |
| `npm run scan:secrets -- --history dist` | clean |
| `npm audit --omit=dev` | 0 critical, 19 high (all build tooling; triaged) |
| `expo export --platform android` | success; bundle points at the production Supabase project, no secret keys |
| Local Gradle release build | APK + AAB built (debug-signed); first two runs failed transiently (clang killed by memory pressure, then a packaging step); the third run succeeded |
| Emulator (Android 15) | release APK starts; signed-out flows pass; signed-in flows **not tested** (no credentials) |

## 2. Feature inventory

Classification key: VERIFIED WORKING (code + automated test or observed run) · PARTIAL · UI ONLY / MOCKED · BROKEN · NOT IMPLEMENTED · UNABLE TO VERIFY.

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F-01 | Email/password sign-up, sign-in, sign-out | VERIFIED WORKING | `src/lib/authFlow.ts`, `auth.test.ts`; live auth tests passed earlier session |
| F-02 | Forgot password / email OTP codes | VERIFIED WORKING | `forgot-password.tsx`, `auth.test.ts`; live-tested earlier |
| F-03 | Turnstile CAPTCHA | PARTIAL | `src/lib/captcha.ts` present; dashboard-side enforcement rollout is a manual item |
| F-04 | Age gate (18+) + disclaimer acceptance | VERIFIED WORKING | `age.tsx`, `disclaimer.tsx`, `pending.ts` `isAdult`; `beta.test.ts` |
| F-05 | Onboarding profile → program | VERIFIED WORKING | `onboarding.tsx`, `engine/plan.ts` `buildProgram`; `engine.test.ts` |
| F-06 | Split recommendation (full body, U/L, PPL, ULPPL) | VERIFIED WORKING | `plan.ts:27` `recommendSplit`; engine tests |
| F-07 | Effort styles (last set to failure / 1–3 RIR / all to failure) | VERIFIED WORKING | `plan.ts:98` `effortTargets`; engine tests |
| F-08 | Warm-up suggestion | VERIFIED WORKING | `progression.ts:136` `warmup` |
| F-09 | Autoregulated progression from logged RIR | VERIFIED WORKING | `progression.ts:20` `suggest` (spare-RIR step-up, overshoot hold); engine tests |
| F-10 | Readiness check-in (sleep/soreness/energy) + bad-day adjust | VERIFIED WORKING | `workout.tsx:87`, `progression.ts:106` `isBadDay`, `adjustForDay` |
| F-11 | Deload offer (on regression + rough check-ins) | VERIFIED WORKING | `decisions.ts`, science topic "Deloads"; engine tests |
| F-12 | Exercise swap / substitutes | VERIFIED WORKING | `engine/exercises.ts`, `library.ts`; engine tests |
| F-13 | Pain stop flow | VERIFIED WORKING (logic) | `workout.tsx`; not visually re-checked after redesign |
| F-14 | Rest timer (±15 s, skip) + optional rest-end notification | PARTIAL | `workout.tsx` RestPanel; `lib/notify.ts` (opt-in in Account › Notifications, local only). Notification **not yet observed on a device** |
| F-15 | Workout save (atomic RPC, retry, single-flight, input parsing, optional RPE) | VERIFIED WORKING | `lib/workoutSave.ts` + `workoutSave.test.ts` + `features.test.ts`; `save_workout` RPC incl. RPE in DB tests |
| F-16 | Crash-safe workout draft | VERIFIED WORKING | `lib/draft.ts` `isUsableDraft`; ErrorBoundary discard button |
| F-17 | Weekly volume per muscle vs productive range | VERIFIED WORKING | `lib/insights.ts:12-25`, `volume.tsx` (now says so when logged sets fail to load instead of showing zeros), `progress.tsx` |
| F-18 | e1RM / PRs / history / bodyweight charts; saved workout detail; 8-week consistency | VERIFIED WORKING (logic) | `decisions.ts:29` Epley; `progress.tsx`; `history/[id].tsx` (new); `adherence()` tested in `features.test.ts`. Signed-in visual check pending |
| F-19 | "Why?" explanations with evidence labels | VERIFIED WORKING | `src/why.tsx`; labels direct/principle/rule |
| F-20 | Science library (19 topics, 30 PubMed/DOI-checked references) + glossary (20 terms) | VERIFIED WORKING | `engine/science.ts`, `engine/references.ts`, `engine/glossary.ts`; Learn tab Topics/Glossary; `features.test.ts` (every glossary topic exists, no creator names) |
| F-21 | Nutrition targets (Mifflin-St Jeor, phases incl. recomp) | VERIFIED WORKING | `engine/nutrition.ts`; migration 5 live |
| F-22 | Food search (common foods + USDA + Open Food Facts + custom) | VERIFIED WORKING | `lib/food.ts`, `commonFoods.ts`, edge fn `food` live; `food.test.ts` |
| F-23 | Barcode scan | UNABLE TO VERIFY | `expo-camera` wired in `food.tsx`; needs a real device |
| F-24 | Food log edit / units / meal picker / 14-day intake trend | VERIFIED WORKING (logic) | `portion.ts` (`dailyTotals`: unlogged days are gaps, not zeros), `updateLogGrams`; `food.test.ts`, `features.test.ts` |
| F-25 | Weekly survey / feedback | PARTIAL | `feedback.tsx`; not re-tested after redesign |
| F-26 | In-app analytics events | VERIFIED WORKING | `lib/data.tsx:126` inserts into `events` (RLS insert-only). **Must be declared in Data safety** |
| F-27 | In-app account deletion | VERIFIED WORKING | `(tabs)/profile.tsx` (Account › Your data) → `delete_account()` (`settings.tsx` duplicate removed) (cascade) tested in `security_tests.sql` |
| F-28 | Web account-deletion page | PARTIAL | `scripts/build-site.mjs` generates `delete-account.html` (refuses to build without a real contact email). **Not hosted**: needs the owner's hosting choice + contact email |
| F-29 | Privacy policy | PARTIAL | Full policy in-app (`/privacy`, reachable signed out) from `lib/privacyPolicy.ts`, written from the verified data inventory; public page generated by `build:site`. **Not hosted; owner/legal review pending** |
| F-30 | Exercise detail (no demo videos) | VERIFIED WORKING | Placeholder "Movement video coming soon" removed; written steps labelled as such; alternatives with your equipment; safety note. Library gained search + "My equipment" filter |
| F-31 | RPE input (optional, half steps) | VERIFIED WORKING (logic) | `engine/effort.ts`, Account › Effort scale, workout RPE buttons; DB column `logged_sets.rpe` (**migration 6, not applied to the live project yet**) |
| F-32 | Data export (JSON + CSV) | PARTIAL | `lib/exportCollect.ts` + `exportData.ts`/`.web.ts`; CSV quoting/injection tested. Not yet run against a real signed-in account |
| F-33 | Glossary screen | VERIFIED WORKING | Learn › Glossary, searchable, evidence label per term |
| F-34 | Crash reporting | PARTIAL | Own database (`client_errors`, migration 6), scrubbed on device (`lib/scrub.ts`, tested), global handler + error boundary. **Inactive until migration 6 is applied**; no third-party SDK |
| F-35 | Velocity tracking, AI form check, community | NOT IMPLEMENTED (deferred) | Built 2026-10-09, then removed per the sprint scope; preserved in `docs/deferred/` |
| F-36 | Design system v1.0 (tokens, fonts, 5 tabs) | PARTIAL | applied to main screens; Train/plan, workout-day, insights, library, settings, wide rail still old style; signed-in visual pass pending |
| F-37 | App icon / splash / store graphics | VERIFIED WORKING | Generated from the Design System brand mark (`scripts/make-brand-assets.py`); release APK label "RepProof", icon and adaptive layers inspected |

## 3. Training-experience assessment (Phase 3)

Strengths (verified in code):
- The engine encodes the founder rules: warm-up + 1–3 working sets per exercise (`MAX_SETS = 3`), effort styles, RIR-driven progression, no scheduled deloads, bad-day adjustment.
- Every coaching decision carries a "why" with an evidence label, and the science library states what studies do **not** show (e.g. MEV/MRV are "models, not biology", `science.ts:47`).
- No creator names are used as authority in-app (grep for Israetel/Helms/Nippard/Staley/Ethier finds only study authors in `references.ts`).

Gaps:
1. Beginners never get RIR-based step-ups (`usesRir = experience !== 'beginner'`), which is deliberate, but there is no in-app path to calibrate RIR guessing (research D-06).
2. No glossary: a new user meets RIR, e1RM, MEV and recomp without a single lookup screen.
3. Rest timer does not survive backgrounding: a timer notification is the most common gym-app expectation.
4. Exercise detail shows a "coming soon" placeholder, which reads as unfinished to a reviewer.
5. Nutrition and training share one app (solves the research's "two apps" pain), but there is no cross-link (e.g. protein reminder on training days). Low priority.
