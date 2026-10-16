# RepProof — Launch Readiness (Phase 6)

Assessed 2026-10-09. The scoring is conservative: anything not observed counts as 0.

## 1. Official Google Play requirements (fetched 2026-10-09)

| Requirement | Official source | What it says | RepProof status |
|---|---|---|---|
| Target API | developer.android.com/google/play/requirements/target-sdk | From **Aug 31 2026**, new apps and updates must target **Android 16 (API 36)**; extension possible to Nov 1 2026 | Expo SDK 57 / RN defaults: targetSdk 36, compileSdk 36, minSdk 24 (from `libs.versions.toml`). **Not confirmed in a built AAB** |
| Testing for new personal accounts | support.google.com/googleplay/android-developer/answer/14151465 | Personal accounts created after Nov 13 2023 need a **closed test with ≥12 testers opted in for 14 consecutive days** before applying for production | Not started. **Unknown: personal or organization account** (owner to confirm) |
| Account deletion | support.google.com/googleplay/android-developer/answer/13327111 | An **in-app** deletion path **and** a **web link** where users can request deletion; associated data must be deleted; Data safety form asks about deletion | In-app: verified (`delete_account()` cascade). Web link: **missing** |
| Health apps declaration | support.google.com/googleplay/android-developer/answer/14738291 | **All** apps must complete it, including apps in closed testing | Not started |
| Privacy policy | Play User Data policy (not re-fetched this session) | Public privacy policy URL in Console and accessible in-app | **Missing** (in-app sheet only) |
| Data safety form | Play Console (not re-fetched) | Declare all collected and shared data | Not started; must include the analytics `events` table |

## 2. Google Play readiness: weighted score (re-scored 2026-10-09 after the sprint)

Same weights and method as the first assessment:
- VERIFIED PASS = 100%, PARTIAL = the stated fraction, FAIL or NOT TESTED = 0.
- Only evidence observed in this session counts. Drafts are not submissions, a debug-signed build is not a Play-signed build, and an emulator is not a real phone.

| # | Category | Weight | Before | After | Points | Evidence for the change |
|---|---|---|---|---|---|---|
| 1 | Core functionality | 10 | 50% | 50% | 5.0 | New features unit-tested; signed-out flows verified on the emulator and web. **Signed-in flows still unverified** (no test credentials), so no increase |
| 2 | Stability and crash handling | 7 | 40% | 50% | 3.5 | Crash pipeline built and DB-tested (inactive until migration 6); Home, Train and Volume show load failures instead of fake zeros; release APK ran with no JS or runtime errors in logcat |
| 3 | Security and auth | 8 | 75% | 75% | 6.0 | Unchanged: live probe 35/35, DB 93 PASS and 19/19 mutations caught; dashboard items still open |
| 4 | Privacy policy (public URL) | 8 | 0% | 25% | 2.0 | Accurate policy in the app (verified on the emulator, signed out) plus a page generator. **No public URL yet** |
| 5 | Data safety form | 6 | 0% | 25% | 1.5 | Answers drafted from the verified data inventory (§7). Not submitted |
| 6 | Account deletion (in-app + web) | 7 | 50% | 60% | 4.2 | In-app deletion is DB-tested (cascade incl. crash reports); web page generated and process documented. **Not hosted** |
| 7 | Health declaration and medical-claim safety | 6 | 50% | 60% | 3.6 | Answers drafted; safety note on exercise screens; no medical claims in the listing draft. Not filed |
| 8 | Permissions minimal and justified | 4 | 75% | 100% | 4.0 | **Built APK merged manifest inspected:** CAMERA, INTERNET, VIBRATE, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK, plus one internal receiver permission. Push, badge, biometric, overlay and storage permissions were removed |
| 9 | Target API / build config | 6 | 50% | 100% | 6.0 | Built APK: `com.repproof.app`, versionCode 1, versionName 1.0.0, minSdk 24, **targetSdk 36** (required since Aug 31 2026) |
| 10 | Signed release build (AAB) | 8 | 0% | 40% | 3.2 | Release APK (139 MB) and AAB (90.5 MB) built locally and verified (`apksigner`, `jarsigner`). **Debug-signed, so not uploadable to Play** |
| 11 | Store listing assets | 7 | 0% | 50% | 3.5 | 512 icon, 1024×500 feature graphic and listing text drafted. **No screenshots** (they need a signed-in session) |
| 12 | Content rating and target audience | 4 | 0% | 25% | 1.0 | Questionnaire answers drafted. Not submitted |
| 13 | Closed testing (12 testers × 14 days) | 10 | 0% | 0% | 0.0 | Not started (owner action) |
| 14 | Accessibility | 4 | 50% | 60% | 2.4 | Code audit: every pressable has a role or label, charts have text labels, new screens labelled. No TalkBack run |
| 15 | Real-device testing | 5 | 0% | 0% | 0.0 | Emulator run only (Android 15, API 35). **No physical phone** |
| | **Total** | **100** | **28.3** | | **45.9** | |

**Google Play readiness: ~28% → ~46%.** It stays well below 75% because the remaining weight sits in owner-only items:
- the closed test (10 points);
- a public privacy URL and Data safety submission (~11);
- a Play-signed AAB (~5);
- screenshots, plus a signed-in and real-device run (~10).

## 3. Technical readiness (code and infrastructure only)

| Category | Weight | Before | After | Points | Evidence |
|---|---|---|---|---|---|
| Automated tests | 15 | 100% | 100% | 15.0 | `npm test` 65/65; `test:db` 93 PASS, 19/19 mutations; `test:live` 35/35 |
| Types and lint | 5 | 100% | 100% | 5.0 | `tsc --noEmit` and `expo lint` clean |
| Security controls, live-verified | 20 | 75% | 75% | 15.0 | Migrations 6 and 7 applied live 2026-10-11 and 2026-10-13 (verified read-only 2026-10-14); migration 8 not applied |
| Core flows verified signed-in on current UI | 15 | 50% | 50% | 7.5 | No signed-in run possible this session |
| Real-device run | 15 | 0% | 0% | 0.0 | Emulator only |
| Release build | 10 | 0% | 60% | 6.0 | Release APK and AAB built; manifest and SDKs verified; APK installs and starts on the emulator. Not Play-signed |
| Observability | 10 | 20% | 40% | 4.0 | Crash reporting implemented and tested, inactive until migration 6 is applied |
| Dependency health | 5 | 50% | 80% | 4.0 | Audit triaged: 0 critical; all 19 high are build-time tooling with no safe upgrade |
| Backups / recovery | 5 | 0% | 20% | 1.0 | Runbook written. **No backup exists**; restore not drilled |
| **Total** | **100** | **47.0** | | **57.5** | |

**Technical readiness: ~47% → ~58%.**

## 4. Other metrics (kept separate)

- **Functional completeness:** 27 of 37 inventory features are VERIFIED WORKING (some "logic" only, without a signed-in visual check), up from 23 at the first audit. Partial: 8. Not implemented (deferred): 1. Unable to verify: 1 (barcode scanning needs a camera).
- **Research coverage:** 67/67 items dispositioned. Implementation coverage of actionable items is 28/43 = **65%** (was 58%). See the evidence register §7.

## 5. Verified blockers

1. **No public privacy-policy URL or deletion URL.** The pages are generated locally and need hosting plus a contact email (owner).
2. **No Play-signed AAB.** The local build is debug-signed. Fix with an EAS login (managed upload key) or the owner's own upload keystore.
3. **Data safety, health declaration, content rating and target audience** are drafted, not submitted.
4. **Closed test not started.** For a personal account, production access comes ≥14 days after 12 testers opt in.
5. **Migrations 6 and 7 are applied live** (2026-10-11, 2026-10-13). Migration 8 (privilege tidy-up) awaits owner approval.
6. **Email delivery (custom SMTP)** is unverified, so testers may not receive codes.
7. **No signed-in or real-device verification yet**, and no store screenshots.

## 6. Unknowns

- Account type: personal or organization.
- Whether 12+ testers are ready.
- Barcode scanning and rest-alert notifications on a physical phone.
- A faint grey band behind the primary button on Android (seen on the welcome screen in the emulator). Needs a real-phone check; it may be an emulator rendering artefact.

## 7. Play Console answers: drafts for the owner to review and submit

These are **drafts**, built from the code's actual data flows (inventory below). Nothing has been submitted. Every answer must be entered by the owner in Play Console.

### 7.1 Data inventory (verified in code, 2026-10-09)

**Account and identity**
| Data | Where | Sent off device? | Shared with a third party? |
|---|---|---|---|
| Email, password (hashed by Supabase Auth) | `auth.users` | Yes (Supabase) | No (Supabase is our processor) |
| Phone number | Not collected: phone sign-in is switched off and hidden in the app (`EXPO_PUBLIC_PHONE_SIGNIN`) | No | No |
| Birth year, height, bodyweight, optional sex, experience, goals, days, equipment | `profiles` | Yes | No |

**Training and nutrition records**
| Data | Where | Sent off device? | Shared with a third party? |
|---|---|---|---|
| Workouts, sets (weight, reps, RIR, RPE), readiness check-ins (sleep/soreness/energy 1-5), cardio, bodyweight log | `workouts`, `logged_sets`, `cardio_logs`, `bodyweight_logs` | Yes | No |
| Food logs, saved meals | `food_logs`, `saved_meals` | Yes | No |
| Food search text and barcodes | `food` edge function: USDA FDC and Open Food Facts are called from our server (server IP, no identity); the device calls Open Food Facts directly only for barcode lookups and when the server fails (device IP, no account id). Searches are cached on the server for about 30 days without a user id | Yes | **Yes**: USDA and Open Food Facts |

**Diagnostics and feedback**
| Data | Where | Sent off device? | Shared with a third party? |
|---|---|---|---|
| Usage events (feature names, small properties, no check-in answers or food) | `events` | Yes | No |
| Crash reports (scrubbed message and stack, route, platform, version) | `client_errors` (migration 6) | Yes, once migration 6 is applied | No |
| Feedback and survey answers | `feedback` | Yes | No |
| CAPTCHA signals | Cloudflare Turnstile, only if a site key is configured; it is not configured now | Conditional | Conditional |

**Never leaves the device**
- Camera frames: barcode scanning only.
- Draft workout, preferences, coach notes, RIR rep-outs (`rir_calibration`), missed-session choice, survey and founding-offer flags, and the pre-sign-up birth year and disclaimer time (until the profile is saved): local storage.
- Session tokens: secure store.

**Not collected:** location, contacts, photos or videos, advertising ID, payment information.

### 7.2 Data safety form (draft answers)

**General questions**
- Does the app collect or share user data? **Yes.**
- Is all data encrypted in transit? **Yes** (HTTPS to Supabase, USDA, Open Food Facts).
- Can users request deletion? **Yes**: in the app, plus the web URL once it is hosted.

**Data types**
| Category: type | Collected | Shared | Ephemeral | Required? | Purposes |
|---|---|---|---|---|---|
| Personal info: Email address | Yes | No | No | Required | Account management |
| Personal info: User IDs | Yes | No | No | Required | Account management, App functionality |
| Personal info: Other info (birth year, sex, height) | Yes | No | No | Required (sex optional) | App functionality |
| Health and fitness: Health info (bodyweight, sleep/soreness/energy ratings) | Yes | No | No | Optional (check-ins skippable; bodyweight needed for targets) | App functionality |
| Health and fitness: Fitness info (workouts, sets, cardio, nutrition goal, food logs) | Yes | No | No | Required | App functionality |
| App activity: App interactions (usage events) | Yes | No | No | Required | Analytics |
| App activity: In-app search history (food searches) | Yes | **Yes** (USDA, Open Food Facts) | **No** (the search text is cached on our server for about 30 days, without any user id) | Optional | App functionality |
| App activity: Other user-generated content (feedback) | Yes | No | No | Optional | Developer communications |
| App info and performance: Crash logs | Yes | No | No | Required | Analytics (stability) |
| App info and performance: Diagnostics | Yes (Google ML Kit, used by the barcode scanner: device and app details, performance, error codes; Google states it is not passed to third parties) | No | No | Optional (only when the scanner is used) | Analytics |

If phone sign-in or CAPTCHA are turned on later, update this form first.

### 7.3 Health apps declaration (draft)

- **Health and fitness features to declare:**
  - Activity and fitness: workout planning and logging.
  - Nutrition and weight management: calorie and macro targets, food log, bodyweight trend.
- **Medical features:** none. Not a medical device.
- The app shows a disclaimer that it is not medical advice, and it never diagnoses or treats.

### 7.4 Content rating questionnaire (IARC, draft)

- **Category:** Reference, News, or Educational, or Utility/Other. The questionnaire asks the owner to choose.
- **Questionnaire answers:**
  - Violence, sexuality, gambling, profanity: no.
  - Controlled substances: no. The science library mentions creatine and caffeine, and reports amounts studied in published research; it does not prescribe doses or promote products.
  - Users can interact or exchange content: **no** (the community is deferred).
  - Shares the user's location: no.
  - Digital purchases: no.
- **Expected result:** low age rating. The **target audience is still 18+** (set in "Target audience and content"; the app enforces it with an age gate).

### 7.5 Other App content items

| Item | Answer |
|---|---|
| Ads | No ads. |
| App access | Sign-in required. Create a dedicated review account, and enter its email and password **only in Play Console** (never in chat or in the repo), with steps such as "sign in, complete onboarding, start a workout". |
| Government, financial features, news | No. |
| Account deletion | Yes. In-app path: Account › Your data › Delete account and all data. Web URL: the hosted `delete-account.html`. |
| Privacy policy URL | The hosted `privacy.html` (see `site/README.md`). |

## 8. Re-assessment after the deep audit (2026-10-09, later the same day)

Same weights and method. Only categories with new evidence are listed.

| Category | Before | After | Evidence |
|---|---|---|---|
| Stability and crash handling (7) | 50% | 55% | Fixed and verified: 0 kg drop suggestion (BUG-1), double-submit duplicates in food and cardio (BUG-12), failed loads shown as real zeros (BUG-3, BUG-6), deleted-account soft-lock (BUG-8). See `docs/BUGS_AND_REGRESSIONS.md` |
| Permissions minimal (4) | 100% | 100% | Re-checked on the new APK; `allowBackup=false` now set (SEC-10) |

No change, and why:
- **Privacy policy (still 25%):** more accurate (SEC-2, SEC-7), but not hosted.
- **Security and auth (75%):** 106 DB checks and 21/21 mutations caught, but the dashboard settings are still unverified.
- **Closed testing (0%):** `docs/CLOSED_TESTING_PLAN.md` is preparation, not progress on the 12-tester / 14-day requirement.
- **Real device (0%).**

**Google Play readiness: ~46% (45.9 → 46.3). Technical readiness: ~58% (unchanged at 57.5).**

The code-side work this audit could do is largely complete; what remains is owner and external. Reaching 75% needs, in order of weight:
1. The closed test: 10 points.
2. Hosted privacy and deletion URLs: up to about 9.
3. A Play-signed AAB: about 5.
4. Submitted Play forms: about 10.
5. A signed-in and real-device run: about 10.
