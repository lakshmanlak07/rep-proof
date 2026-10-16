# RepProof — Feature Backlog & Decision Gate (Phases 4–5)

Audit date: 2026-10-09.

**Nothing in this file is approved.** Each ID needs explicit owner approval before work starts. Approving one ID does not approve any other.

Decision key: **KEEP** (exists, verified, no work) · **FIX** (exists or required, but defective or missing for launch) · **RECOMMEND** (new work, advised) · **OPTIONAL** (nice to have) · **DEFER** (post-launch, with reason) · **REJECT** (don't build, with reason).

Priority: P0 = blocks Play submission or testing · P1 = before production rollout · P2 = first post-launch update · P3/P4 = later.

Complexity: S ≤ ½ day · M ≤ 2 days · L > 2 days. Research IDs (e.g. D-06) refer to `REP_PROOF_EVIDENCE_REGISTER.md`.

## A. Store & compliance

| ID | Feature | Problem | State | Evidence | Cx | Depends on | Tests | Risks | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-01 | Real app icon, adaptive icon, splash | Template Expo assets | Broken | `icon.png` = template; `splash-icon.png` identical to `expo-logo.png` | S | Owner approves artwork | Hash differs from template; visual check on device masks | Rejection or unprofessional listing | P0 | No template assets; adaptive icon correct in round and squircle masks; 512×512 store icon | FIX |
| A-02 | Hosted privacy policy | Play requires a public URL | Not implemented | Only an in-app sheet (`profile.tsx:123`) | S | Hosting choice; owner approval to publish | URL returns 200 publicly; content matches A-04 | Mismatch with Data safety leads to rejection | P0 | Public URL; lists data types (email, profile, workouts, bodyweight, food logs, analytics events), processors (Supabase, USDA, Open Food Facts), retention, deletion; linked in app and listing | FIX |
| A-03 | Web account-deletion page | Play requires a web deletion path | Not implemented | Only in-app `delete_account()` | S | A-02 hosting | URL public; steps work for a signed-out user | Play blocks updates without it | P0 | Names RepProof and developer; explains in-app steps plus a request contact; states what is deleted and any retention | FIX |
| A-04 | Data safety answers (draft) | Must declare collection | Not started | `events` table analytics (`data.tsx:126`), auth email, fitness and nutrition data | S | A-02 | Cross-check against the schema in migrations | False declaration is a policy violation | P0 | Draft answers in repo; owner submits in Console | FIX |
| A-05 | Health apps declaration, content rating, target audience 18+, ads = none | Required for all apps | Not started | Official Play docs fetched 2026-10-09 | S | — | — | Wrong category or medical claims | P0 | Declared as Health & Fitness (activity, nutrition); no medical features claimed | FIX (owner) |
| A-06 | Store listing | Required to publish | Not started | — | M | A-01, B-04 for screenshots | Text has no medical or cure claims | Health-claim policy | P0 | Title, short (≤80) and full descriptions, ≥2 phone screenshots, 1024×500 feature graphic | FIX |
| A-07 | EAS builds (preview APK + production AAB) | Never built | Not implemented | `eas.json` exists; no build history | M | Owner logs in to Expo/EAS; signing key managed by EAS | Build succeeds; `aapt dump badging` shows targetSdk 36 | Native build errors; first-build time | P0 | AAB uploads to the closed track; APK installs on a phone | FIX |
| A-08 | Closed test: 12+ testers, 14 consecutive days | Mandatory for new personal accounts | Not started | Play Help 14151465 fetched 2026-10-09 | — | A-01…A-07, testers' Google accounts | Console shows ≥12 opted-in testers | **Earliest production access is ~14 days after 12 testers opt in** | P0 | 12+ testers opted in for 14 consecutive days, then apply for production | FIX (owner) |

## B. Reliability & QA

| ID | Feature | Problem | State | Evidence | Cx | Depends on | Tests | Risks | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B-01 | Signed-in visual pass of redesigned screens | Not verified after redesign | Not tested | Owner sign-in pending | S | Owner signs in at localhost | Screenshot each tab and the workout flow | Visual regressions | P0 | Every tab and the workout/food flows render with no console errors | FIX |
| B-02 | Real-device Android smoke test | Never run | Not tested | — | S | A-07 APK | Checklist in RELEASE_PLAN | Native-only bugs (camera, fonts, keyboard) | P0 | Sign-up → onboarding → workout save → food scan → delete account all pass on one phone | FIX |
| B-03 | Crash reporting (e.g. Sentry) | Blind to tester crashes | Not implemented | No SDK in `package.json` | S–M | A-04 must declare it | Forced test crash appears in dashboard | New data processor; PII scrubbing needed | P1 | Crashes reported with no email or body data | RECOMMEND |
| B-04 | Finish design on Train, workout-day, insights, library, settings, wide rail | Mixed old/new styling | Partial | F-36 in audit | M | — | tsc, lint, tests, visual pass | Scope creep | P1 | All screens use the `src/ui.tsx` tokens; no logic changes | RECOMMEND |
| B-05 | Rest-timer notification when backgrounded | Timer is invisible when the app is closed | Partial | RestPanel is in-app only | M | `expo-notifications`; Android 13 notification permission | Device test with screen off | Adds a permission and Data safety impact | P2 | Notification fires at rest end; no permission asked until first use | OPTIONAL |
| B-06 | npm audit triage (19 high) | Unknown runtime exposure | Partial | `npm audit` run 2026-10-09 | S | — | Re-run audit; tests | Breaking upgrades | P1 | Each high finding is classed as dev-only or fixed | FIX |

## C. Security & ops

| ID | Feature | Problem | State | Evidence | Cx | Depends on | Tests | Risks | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | Supabase dashboard hardening: custom SMTP, site URL, password min 10, JWT expiry, CAPTCHA enforcement | Manual items outstanding | Partial | `PRODUCTION_SECURITY_CHECKLIST.md` | S | Owner dashboard access; SMTP provider | `test:live:auth` re-run | **Built-in Supabase email is heavily restricted, so testers may never get sign-up codes. Verify in the dashboard.** | P0 (SMTP) / P1 (rest) | A new tester receives a confirmation code; checklist items ticked | FIX |
| C-02 | Backups | Free plan has no backups | Not implemented | Plan tier | S | Owner choice (paid plan or scheduled dump) | Test restore to a local DB | Data loss | P1 | A documented, tested restore path | RECOMMEND |
| C-03 | Remove throwaway test account and its `.env.local` credentials | Leftover test data | Pending | Earlier session | S | Live tests finished | — | — | P2 | Account deleted; `.env.local` creds cleared | FIX (owner) |

## D. Program & progression

| ID | Feature | State | Evidence | Decision |
|---|---|---|---|---|
| D-01 | Program builder and splits | Verified | `plan.ts` `buildProgram`, `recommendSplit`; engine tests | KEEP |
| D-02 | Load/rep progression | Verified | `progression.ts` `suggest`; Plotkin 2022 | KEEP |
| D-03 | 1–3 working sets + warm-up rule | Verified | `MAX_SETS = 3`, `warmup()` | KEEP |

## E. Effort & RIR

| ID | Feature | Problem | State | Evidence | Cx | Depends on | Tests | Risks | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E-01 | RIR logging + RIR-driven progression | — | Verified | `progression.ts` spare/overshoot logic | — | — | engine tests | — | — | — | KEEP |
| E-02 | RIR calibration aid (occasional rep-out on a safe isolation set to compare predicted vs actual RIR) | Beginners' RIR guesses are unreliable (D-06) | Not implemented | Halperin 2022, Refalo 2024 (app references) | M | Design approval | Engine unit tests for the calibration math | Injury risk if offered on compounds; must be isolation-only and opt-in | P3 | Opt-in; isolation exercises only; shows the predicted-vs-actual gap; never changes the plan silently | OPTIONAL | **Implemented 2026-10-09**: `engine/calibration.ts` and `CalibrationCard` in the workout. Opt-in, isolation-only, kept on the phone, never changes the plan. |
| E-03 | RPE input mode | Some lifters think in RPE | Not implemented | G-02 | M | — | — | Two scales confuse users; doubles test surface | — | — | REJECT (the glossary in I-01 explains RPE ≈ 10 − RIR instead) |

## F. Volume & recovery

| ID | Feature | Problem | State | Evidence | Cx | Pri | Decision / reason |
|---|---|---|---|---|---|---|---|
| F-01 | Weekly volume per muscle vs productive range | — | Verified | `insights.ts` | — | — | KEEP |
| F-02 | Per-muscle soreness adjusting that muscle's volume (O-05) | Global check-in only | Not implemented | No direct evidence that per-muscle soreness should change volume; app's own topic calls soreness a weak proxy | M | — | DEFER: needs evidence first |
| F-03 | Readiness check-in, bad-day adjust, deload offer | — | Verified | `progression.ts`, `decisions.ts` | — | — | KEEP |

## G. Exercise library & form

| ID | Feature | Problem | State | Evidence | Cx | Depends on | Tests | Risks | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G-01 | Remove "Movement video coming soon" placeholder | Looks unfinished to reviewers and testers | UI only | `exercise/[id].tsx:29` | S | — | Visual | — | P1 | No placeholder; cues and muscles shown cleanly | FIX |
| G-02 | Exercise demo media library | No visual form guidance (P-04) | Not implemented | — | L | Content licensing or production | — | Copyright; app size | P3 | Licensed media for every library exercise | DEFER: content production, not code |
| G-03 | AI form check / AR overlay (O-04, O-10) | Form feedback wish | Not implemented | Opinion only | L | — | — | Unvalidated accuracy; video privacy; health-claim exposure | — | — | REJECT for launch; revisit post-launch with evidence |

## H. Nutrition

| ID | Feature | Problem | State | Evidence | Cx | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|
| H-01 | Food logging (common, USDA, OFF, custom, barcode) | — | Verified (barcode unverified on device) | `food.ts`, edge fn | — | — | — | KEEP |
| H-02 | Weight-trend vs goal-rate check (e.g. flag cuts losing faster than ~1% bodyweight/week) | Targets are static estimates (D-07) | **Implemented 2026-10-09** (`weightTrendCheck`, Fuel › Targets; unit + screen tests) | `nutrition.ts:32` already says "adjust to your weight trend" | M | P2 | Uses a ≥2-week trend; suggestion only; labelled REPPROOF RULE | OPTIONAL |
| H-03 | Show protein as 1.6 g/kg target with "up to 2.2" note | C-05 | **Implemented 2026-10-09** (Morton 2018 CI in the target explanation and reference) | Morton 2018 | S | P3 | Copy change only | OPTIONAL |
| H-04 | Training-day protein nudge (O-06) | Weak link between tabs | Not implemented | Principle only | S | P4 | Dismissible; no notification permission | OPTIONAL |

## I. Education & science content

| ID | Feature | Problem | State | Evidence | Cx | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|
| I-01 | Glossary (RIR, RPE ≈ 10 − RIR, e1RM, MEV/MAV/MRV as models, SFR, autoregulation, deload, recomp) | Jargon without a lookup (G-02, G-03) | Not implemented | Terms only inside topics | S | P2 | Searchable in Learn; each term links its topic; no creator attributions | RECOMMEND |
| I-02 | New explainers: junk volume, mind-muscle connection, time under tension, creatine dosing | D-01, D-08, TR-03 | Not implemented | Each needs a PubMed-checked reference before shipping | M | P3 | Same topic format (shows / does not show / in app / source) | OPTIONAL | **Implemented 2026-10-09**: junk volume, mind-muscle connection, time under tension, creatine amounts. 4 new references, each checked against its PubMed record. |
| I-03 | Keep creators out of in-app authority claims | Suspect attributions in the report | Verified | grep of `src/` | — | — | — | KEEP |

## J. Progress & analytics

| ID | Feature | Problem | State | Evidence | Cx | Pri | Acceptance criteria | Decision |
|---|---|---|---|---|---|---|---|---|
| J-01 | Strength, load, sets, body charts; PRs; history | — | Verified (logic) | `progress.tsx` | — | — | — | KEEP |
| J-02 | Trends: weekly sets and average-RIR moving averages (O-09) | Plateaus hard to spot | Not implemented | Principle | M | P3 | 4-week moving average per muscle; empty state below 2 weeks | OPTIONAL | **Implemented 2026-10-09**: `weeklyTrend` (stats.ts) and the Trends card in Progress › Sets. 4-week averages of sets and logged RIR; missing RIR is never counted as 0. |
| J-03 | Data export (CSV of workouts, food, bodyweight) | No portability | Not implemented | — | S–M | P2 | Exports only the signed-in user's rows (RLS); file shared via the OS share sheet | RECOMMEND |

## K. Community & AI

| ID | Feature | Decision / reason |
|---|---|---|
| K-01 | Community forum (P-06) | REJECT for launch: user-generated content triggers Play UGC duties (report, block, moderation) |
| K-02 | AI Q&A bot (O-08) | DEFER: hallucination and health-advice risk; cost; needs grounding in the verified reference set |

## L. Platform & accessibility

| ID | Feature | Pri | Decision / reason |
|---|---|---|---|
| L-01 | TalkBack and large-font pass | P1 | RECOMMEND: labels were added in the redesign but never tested with a screen reader |
| L-02 | Dark mode | — | DEFER: `darkColor` tokens exist; not needed for launch |
| L-03 | Bar velocity from phone sensors (O-07) | — | REJECT: accuracy unvalidated; would undermine "evidence-based" positioning |

## Decision summary

| Decision | IDs |
|---|---|
| KEEP | D-01, D-02, D-03, E-01, F-01, F-03, H-01, I-03, J-01 |
| FIX | A-01…A-08, B-01, B-02, B-06, C-01, C-03, G-01 |
| RECOMMEND | B-03, B-04, C-02, I-01, J-03, L-01 |
| OPTIONAL | B-05, E-02, H-02, H-03, H-04, I-02, J-02 |
| DEFER | F-02, G-02, K-02, L-02 |
| REJECT | E-03, G-03, K-01, L-03 |

## MVP launch scope (proposed; needs approval)

- **Must ship** for the closed test: all FIX items in A, B, C and G-01.
- **Should ship** before production: B-03, B-04, C-02, L-01.
- **First post-launch update:** I-01, J-03, then OPTIONAL items by tester feedback.

## Status after the 2026-10-09 sprint

Milestones: 1 code complete · 2 locally tested · 3 real device · 4 release build · 5 submitted · 6 approved · 7 published. Each item shows the highest milestone actually observed.

**A. Store and compliance**
| ID | State now | Highest milestone | Remaining |
|---|---|---|---|
| A-01 | Icon set, adaptive layers, splash, favicon, notification icon, 512 store icon and feature graphic generated from the Design System brand mark | 2 (assets inspected; the release-APK label is "RepProof") | Owner confirms the mark is final; check the icon on a phone |
| A-02 | Privacy policy written from the verified data inventory; shown in the app (signed in or out); public page built by `npm run build:site` | 2 | Owner review, contact email, hosting, URL in Play |
| A-03 | Deletion page generated; manual email process and Supabase steps documented | 2 | Hosting, contact email, URL in Play |
| A-04 | Data safety answers drafted (`REP_PROOF_LAUNCH_READINESS.md` §7) | 1 | Owner submits |
| A-05 | Health declaration and content rating answers drafted | 1 | Owner submits |
| A-06 | Listing text drafted (`store/listing.md`); graphics ready | 1 | Screenshots (signed-in session), owner submits |
| A-07 | Local release APK (139 MB) and AAB (90.5 MB) built; manifest verified: com.repproof.app, versionCode 1, minSdk 24, targetSdk 36, 7 permissions. **Debug-signed** | 4 (not Play-uploadable) | EAS login or an upload keystore for a Play-signed AAB |
| A-08 | Not started | 0 | Owner: closed track, 12+ testers for 14 days |

**B. Reliability**
| ID | State now | Highest milestone | Remaining |
|---|---|---|---|
| B-01 | Signed-out web smoke test passed | 2 | Owner signs in for the signed-in pass |
| B-02 | Release APK on an Android 15 emulator: launch, fonts and branding, welcome, privacy policy (signed out) with back navigation, age gate including the under-18 block, sign-in screen; no JS or runtime errors in logcat | 2 (emulator, not a device) | Signed-in flows and a physical phone |
| B-03 | Crash reporting to the app's own database (no SDK), scrubbed, rate-limited, 90-day retention; DB-tested | 2 | Apply migration 6 |
| B-04 | Library and exercise detail moved to tokens; off-token colours removed; Home, Train and Volume now say when data failed to load instead of showing zeros | 2 | Signed-in visual pass of every tab |
| B-05 | Rest-end notification (opt-in, local) | 2 | Device check |
| B-06 | Audit triaged: all 19 high findings are build-time tooling; the only "fix" is a downgrade to Expo 44 / RN 0.72 | done | Re-check on the next Expo SDK |

**C. Security and ops**
| ID | State now | Highest milestone | Remaining |
|---|---|---|---|
| C-01 | Unchanged (dashboard) | 0 | Owner: custom SMTP, settings |
| C-02 | Runbook `docs/BACKUP_AND_RECOVERY.md`; **no backups exist** | 1 | Owner: plan choice or first dump, then a restore drill |

**Other groups**
| ID | State now | Highest milestone | Remaining |
|---|---|---|---|
| E-03 | **Implemented on the owner's request** (was REJECT): optional RPE scale, converted to RIR | 2 | Apply migration 6 (works without it; RPE is just not stored) |
| G-01 | "Coming soon" video placeholder removed | 2 | None |
| I-01 | Glossary built (20 terms) | 2 | None |
| J-03 | Data export (JSON + CSV) | 2 | Signed-in run |
| H-02 | 14-day intake trend, plus the weight-trend vs goal-rate check (2026-10-09, later) | 2 | Signed-in run |
| H-03 | Protein note: 1.6 g/kg, uncertainty up to about 2.2 g/kg | 2 | None |
| — | Delete a mistaken workout (history detail) | 2 | Signed-in run |
| K-01, G-03, L-03 | Built on request, then **deferred** per the sprint scope (`docs/deferred/`) | 0 | Owner decision |
