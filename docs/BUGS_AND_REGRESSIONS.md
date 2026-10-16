# Bugs and regressions (audit of 2026-10-09)

Each bug was reproduced first, by a failing test or a direct probe, then fixed and re-tested. Security and privacy defects are also listed in `docs/SECURITY_AUDIT.md`.

## Fixed

| ID | Sev. | Where | Reproduction | Expected | Actual (before) | Fix | Regression test |
|---|---|---|---|---|---|---|---|
| BUG-1 | P2 | `engine/progression.ts` `suggest()` | A loaded lift at the smallest step (2.5 kg / 5 lb) under the rep range two sessions running | A sensible next weight | Suggested "Down to **0 kg**" | Hold weight and say it is already the lightest step (suggest an easier variation) | `features.test.ts` BUG-1 (kg, lb, normal drop, bodyweight) |
| BUG-2 | P3 | `lib/insights.ts` `readiness()` | No check-in in recent workouts | "Unknown or not checked in" | Labelled "**Ready**" | Label "No check-in yet" | `features.test.ts` BUG-2 (source-level; insights.ts imports native icons) |
| BUG-3 | P3 | `app/insights.tsx`, `(tabs)/index.tsx` | Check-in request fails (offline) | An honest "could not load" | Errors swallowed, so it showed "no check-in" and no deload offer as if real | Insights shows "Unknown"; Home shows its could-not-refresh banner | Code inspection; tsc and lint |
| BUG-4 | P2 | `(tabs)/profile.tsx`, `lib/privacyPolicy.ts` | Compare the disclosure with the `track()` payloads | The disclosure matches the code | Claimed "never your answers or numbers" | Accurate list of what events contain | `features.test.ts` BUG-4 guard (scans all `track()` calls) |
| BUG-5 | P3 | `app/history/[id].tsx` (check moved to `lib/links.ts` `isUuid`) | Open `/history/abc` (malformed deep link) | "Workout not found" | "Could not load… check your connection" (Postgres refused the UUID cast) | Validate the UUID first | `auth.test.ts` "BUG-5" (valid id, empty, null, injection-style strings, number) |
| BUG-6 | P3 | `(tabs)/nutrition.tsx` | Food log fails to load | Totals marked unknown, plus a retry button | Showed the full target as "kcal left" as if nothing had been eaten; the banner said "switch tabs to retry" | Shows "—" and "not loaded", with a real Retry action | Code inspection; tsc and lint |
| BUG-7 | P3 | `lib/exportCollect.ts` | Export over 1000 rows | Every row exactly once | Pages had no `order by`, so rows could be skipped or repeated | `order('id')` through a pure `pageAll()` | `features.test.ts` "export paging" (0-3000 rows, page boundaries, error aborts) |
| BUG-8 | P2 | `lib/data.tsx` | Account deleted on the server while the device holds a token | Signed out | Trapped in an onboarding that cannot save, for up to about 1 h | Validate with the server and sign out on a definite rejection | `auth.test.ts` sessionRejected |
| BUG-9 | P3 | `scripts/build-site.mjs` | Build the public pages | Title "RepProof" | "RepProof · RepProof" | Title special-cased | Browser check of the built page |
| BUG-10 | Info | `lib/crash.ts` | Module reload | One handler | The handler could be wrapped twice | Idempotency guard | Inspection |
| BUG-11 | P3 | `features.test.ts` | Migration 6 made re-runnable (`create table if not exists`) | The coverage test still parses it | The test failed ("client_errors is listed but no migration creates it") | Parser accepts the guarded form | The test itself (it found this) |
| BUG-12 | P2 | `app/food.tsx` (Add food, saved meal), `(tabs)/progress.tsx` (Log cardio) | Double-tap "Add to Breakfast" before the screen closes | One entry | Two inserts, so a duplicate food or cardio entry | Single-flight with the tested `once()` helper, plus a loading state on Add | `workoutSave.test.ts` "double taps save once" covers `once()`; wiring by inspection |
| SEC-10 | P3 | `app.json` | `aapt dump xmltree` on the release APK | Sensitive app storage not sent to cloud backup | `android:allowBackup=true` | `android.allowBackup: false` | `features.test.ts` release config guard; rebuilt APK inspected |

## Investigated, not a bug

- **Grey band behind the primary button on the Android emulator.** Pixel analysis showed a uniform ~7% darkening over the button's exact bounds. That is Android's default keyboard-focus highlight, because the emulator starts in non-touch mode with a hardware keyboard. It is absent after any touch, and it is an accessibility focus indicator.
- **The `sb_secret` string in the production bundle.** Hermes concatenates its string table, so "lifter**s**" runs into an Expo Router internal string `…b_secret__internal_expo_router…`. No key is present, and the secret scan is clean.
- **Release-build failures in the earlier sprint.**
  - A clang crash during native compilation was resource exhaustion: the emulator and parallel compiles ran together.
  - Then a transient packaging failure.
  - Builds with `--max-workers=2` and no emulator running succeeded twice in a row.

## Remaining known failures

None in the automated suites at the end of this audit (see `docs/TEST_EVIDENCE.md`). Untested areas are listed in `docs/HARDENING_HANDOFF.md`.

## Found in the final verification pass

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| VER-1 | P3 | `features.test.ts` BUG-4 guard | The static guard only read literal `{…}` payloads, so `track('x', props)` with a variable would have bypassed it | The guard now requires every call to be literal | The guard itself (it caught its own counting bug: the function definition) |
| VER-2 | P3 (defence in depth) | `lib/data.tsx` `track()` | No runtime protection: a future call site could send sensitive fields | `track()` passes payloads through `safeProps()` | `features.test.ts` "safeProps" (8 cases) |
| VER-3 | P3 | `lib/exportCollect.ts` | Paging logic was untested | Extracted to `pageAll()` | "export paging" |

The source-level regression checks for BUG-3, BUG-6 and BUG-12 screen wiring were inspection-verified only at that point. A screen-test framework now exists (`npm run test:screens`); BUG-6 (Fuel) and BUG-12 (Home/Insights) are now covered by behavioural screen tests, while BUG-3 (double-tap `once()`) remains covered by its unit test. The logic they rely on (`once()`, `dailyTotals`, `readiness`) is behaviourally tested.

## Found in the authenticated-testing sprint (2026-10-09)

Each one was found by writing a screen test first. Each fix was checked by putting the old code back: the test failed, then passed again with the fix.

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| BUG-13 | P2 | Fuel (`(tabs)/nutrition.tsx`) | While the diary was loading, "kcal left" showed the full daily target, as if nothing had been eaten. Retry had no loading state | A `loading/ok/failed` status. Totals show "—" until loaded. Retry shows "Loading today's foods…" | `src/__tests__/fuel.test.tsx` (4) |
| BUG-14 | P3 | Insights (`insights.tsx`) | While check-ins were loading, Recovery said "No check-in yet" (a claim, not a fact) | Shows "Loading" until loaded; "Unknown" on failure | `home.test.tsx` "Insights: pending…" |
| BUG-15 | P2 | Home (`(tabs)/index.tsx`) | When loading failed or was still pending, nutrition showed "0 of N kcal" and "0 g protein", weekly volume showed "0 / N sets", and readiness said "No check-in yet". The stale-data banner had no Retry | Unknown values show "—" and "Unknown"; the banner has a Retry that re-runs every load | `home.test.tsx` (2 Home tests) |

**Investigated, not a bug:** the Account screen's Cancel buttons have no handler, which is correct: Cancel only closes the alert. The test helper was written to allow for that.

## Found in the product-completion sprint (2026-10-09, later)

Each one was found while writing a screen test for the screen. Fixes marked "mutation-checked" were verified by putting the old code back: the test failed, then passed again with the fix.

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| BUG-16 | P2 | Weekly volume (`volume.tsx`), "Logged this week" | While loading or after a failure, every muscle showed "0 sets" and "Potentially increase" | Logged counts are `null` until loaded. The screen shows "—" and "Loading…" or "Unknown". The failure banner has a Retry | `history.test.tsx` "weekly volume…" (mutation-checked) |
| BUG-17 | P2 | Progress (`(tabs)/progress.tsx`) | Four false readings: (1) the Load and Sets views showed "0" while loading or failed; (2) the 2 top-lift cards showed "0 → 0 kg" for a range with no sessions; (3) a bodyweight network failure said "needs migration 3"; (4) workouts were rendered before their sets arrived | Charts render only from loaded data. An empty range says "No … in the last N days". Bodyweight has separate loading and failed states with Try again. All three queries are committed together | `progress.test.tsx` (3, mutation-checked) |
| BUG-18 | P3 | Custom food (`food.tsx`) | Negative or non-numeric protein, fat or carbs were accepted; the database then refused them with a generic error | Each macro must be blank or a non-negative number before Add is enabled | `food.test.tsx` "negative macro" |
| UX-1 | P3 | Saved meals (`food.tsx`) | "Delete" removed a saved meal immediately, with no confirmation | Confirmation alert | `food.test.tsx` "deleting a saved meal asks first" |

**New feature (gap found in the workout lifecycle):** a workout logged by mistake could not be removed. The workout detail screen now has "Delete this workout":
- it asks for confirmation first;
- it waits for the server to confirm, through `deleteWorkout()`, which needs one row back;
- it drops that workout's lifts from the cached coach notes;
- it then returns to Progress, which reloads on focus.

Its sets are deleted by the existing foreign-key cascade, and the existing RLS policy (`own`, `for all`) limits deletion to the owner. No migration was needed.

## Found in the final feature-completion sprint (2026-10-09, latest)

Every row was found by a new test. A row marked "mutation-checked" was verified by putting the old code back: the test failed, then passed again with the fix.

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| BUG-19 | **P1 (privacy)** | `lib/data.tsx` DataProvider | On an account switch, account A's profile and plan stayed in state until B's load finished. If B's load failed, A's data stayed and the app rendered **A's plan under B's session**. | State is tagged with the account it belongs to and cleared as soon as the session's user changes. | `session.test.tsx` "switching accounts…" (mutation-checked: without the fix, B's session showed A's profile) |
| BUG-20 | P2 | `app/onboarding.tsx` | After a successful save, the age data was cleared before the "plan ready" screen rendered. The age-check guard came first, so the user was asked their birth year again instead of seeing their plan. | Plan-ready screen renders before the guard. | `onboarding.test.tsx` (failed before the fix) |
| BUG-21 | P2 | `lib/errors.ts`, `app/sign-in.tsx` | Signing in offline said "Could not sign you in with those details" (it suggested a wrong password). A thrown network error could leave the button spinning. | A network failure is reported as a connection problem, and a thrown error is caught. | `signin.test.tsx`, `auth.test.ts` |
| BUG-22 | P2 | `lib/notify.ts` | Three problems: (1) permission revoked in phone settings left "Rest alerts on" while nothing fired; (2) a permission or channel error threw into the toggle; (3) rapid ±15 s adjustments could leave two rest notifications scheduled. | (1) Permission is re-checked before scheduling and the preference switches off; (2) errors are treated as a refusal; (3) a generation counter cancels superseded schedules. | `notify.test.tsx` (7) |
| BUG-23 | P2 | Barcode scanner (`app/food.tsx`) | With camera permission refused for good, "Allow camera" did nothing: a dead end. | "Open settings" (`Linking.openSettings`) plus a search hint. | `food.test.tsx` scanner tests |
| BUG-24 | P3 | `why.tsx` RefLinks | An unknown reference id would crash the topic card (latent: none today). | Unknown ids render nothing. | `science.test.tsx` |
| BUG-25 | P3 | Plan, Training profile, Onboarding | Two problems: (1) a double tap could rebuild the plan, or create the profile and plan, twice; (2) Plan's failed-load banner had no Retry. Bodyweight in onboarding had no upper bound, so the server refused it at the end. | Single-flight guards; Retry; bodyweight is now capped at 700, the same limit the database uses. | `plan.test.tsx`, `onboarding.test.tsx` |
| SEC-1 | P2 (integrity) | Migration 6 | The server accepted an RPE that contradicted the stored RIR, or an RPE without an RIR. The engine reads RIR, so the history could disagree with itself. | New guarded check `logged_sets_rpe_matches_rir` (migration 6 is not applied anywhere yet, so this is safe). | `security_tests.sql` (3 new checks), mutation 22, upgrade-path test |

## ECC review sprint (2026-10-10)

Five ECC agents reviewed the code (read-only), and a sixth re-reviewed the fixes:
- `ecc:silent-failure-hunter`
- `ecc:react-reviewer`
- `ecc:database-reviewer`
- `ecc:security-reviewer`
- `ecc:a11y-architect`
- `ecc:typescript-reviewer` (the re-review)

Every finding was checked against the code before it was fixed. Each fix has a test unless the row says otherwise.

| ID | Sev. | Where | Finding (verified) | Fix | Test |
|---|---|---|---|---|---|
| ECC-1 | P1 | `workout.tsx` summary | Two problems: (1) "Swap in plan" rebuilt from a stale plan copy, undoing the set changes just saved or an earlier swap; (2) `next_day` stayed stale until "Done", so Android Back could repeat the same day | `refresh()` after the save and after every plan write | `workout.test.tsx` |
| ECC-2 | P1 | `workout.tsx` finish | A one-session swap applied that lift's decision (for example +1 set) to the original planned lift | The decision is judged on the lift actually trained, and set changes to the original are skipped | — (engine path; reasoning in code) |
| ECC-3 | P2 | `workout.tsx` | Three problems: (1) a failed plan update after a saved workout was swallowed while the summary still showed the plan changes; (2) `swap()` had no error handling; (3) the check-in screen flashed between the save and the summary | A "plan could not be updated" banner; a swap failure shows an alert; a "Workout saved" screen during that wait | `workout.test.tsx` (2) |
| ECC-4 | P3 | `workout.tsx` | Pain stop › "Avoid this movement" on the last exercise crashed (empty workout) | Ends the workout | inspection |
| ECC-5 | P2 | `authFlow.ts` | Password-reset and resend errors revealed whether an email has an account: the 60 s email cooldown applies only to existing accounts | Email-send limits read as "sent" | `auth.test.ts` |
| ECC-6 | P2 | `forgot-password.tsx` | Two problems: (1) "Signed out on your other devices" was shown even when the global sign-out failed; (2) a thrown network error left the button spinning | Both fixed: honest message, button released | `entry.test.tsx` (6) |
| ECC-7 | P2 | `prefs.ts`, `profile.tsx`, `exportData.ts` | Coaching notes, beta prompts and export files stayed on the phone after sign-out or account deletion | `clearLocal(userId)`; export files swept on export, sign-out and delete | `account.test.tsx` |
| ECC-8 | P2 | `food.ts` | `byBarcode` turned network failures into "not in the databases", inviting made-up macros | "Not found" only when both sources answered | — (lib; covered by the screen test of the error path) |
| ECC-9 | P2 | `data.tsx`, `_layout.tsx` | An unreadable stored session meant an endless spinner; the Offline retry could spin forever | Treated as signed out; retry wrapped in try/finally | `session.test.tsx` |
| ECC-10 | P2 | `onboarding.tsx` | Two problems: (1) under-18 account deletion ignored failure (the minor's account remained while the screen said it was removed); (2) the first weigh-in was dated in UTC | The result is checked and retry offered; `logged_on` is the local date | `onboarding.test.tsx` (2) |
| ECC-11 | P2 | `ui.tsx` Field, Stepper | A comma decimal ("72,5") was rejected or read as 0 (the stepper's + went to 2.5) | Normalised once in `Field` and `Stepper` | `food.test.tsx` |
| ECC-12 | P2 | `plan.tsx`, `training.tsx`, `workout.tsx` | Profile saved, plan rebuild failed: the profile and plan disagreed | The profile change is undone when the rebuild fails | `plan.test.tsx` |
| ECC-13 | P2 | `food.tsx` | An older search finishing late replaced newer results; an invalid `meal` link showed "Add to undefined"; a failed custom-food add lost the form | Search id guard; meal fallback; custom food in a Sheet that stays open until it saves | `food.test.tsx` (3) |
| ECC-14 | P2 | `progress.tsx`, `stats.ts` | Four problems: (1) a frozen clock while the tab stays mounted; (2) a 2000-row request the server caps at 1000, so the truncation guard never fired; (3) partial current weeks compared as full weeks; (4) unhandled reload errors after saving | Clock refreshed on reload; limit 1000; completed weeks plus "this week so far"; errors caught | `progress.test.tsx` (6), unit |
| ECC-15 | P2 | Food edge function | Partial results during a USDA or Open Food Facts outage were cached for everyone for 30 days | Only complete answers are cached | — (deploy is an owner step) |
| ECC-16 | P2 | Migration 6 | Several gaps: (1) missing indexes made workout and account deletion scan every user's rows; (2) the checks were validated under an exclusive lock; (3) a client could delete programs, cascading into workout history; (4) sets in one save had no order; (5) no lower bound on birth year; (6) the consent time could be rewritten | Indexes; `NOT VALID` + `VALIDATE` with `lock_timeout`; delete revoked; ordinality timestamps; `birth_year >= 1900`; server-stamped, immutable consent | `security_tests.sql` (7 checks), 4 new mutations (26/26) |
| ECC-17 | P2 | `workoutSave.ts` | A stale RPE (scale switched mid-workout) would make the whole save fail against the new RPE/RIR check | RPE is sent only when it matches the RIR | unit |
| ECC-18 | P1/P2 | Accessibility (`ui.tsx`, workout, food, nutrition) | Several gaps: (1) sheets could not scroll at large font; (2) steppers were unnamed and silent; (3) radios reported `selected` instead of `checked`; (4) touch targets were under 48 dp; (5) logging, rest end and search results were never announced; (6) there were no headings; (7) charts had no summary; (8) repeated buttons had identical names | Design-system fixes plus call-site labels | Screen tests still pass; TalkBack itself needs a phone (D4) |
| ECC-19 | P3 | Various | Five small issues: (1) Home showed float noise ("2.3999 kg"); (2) "t" volume was shown for lb; (3) the weight-trend "today" used UTC; (4) the calibration summary never refreshed after a save; (5) Account kept showing "Rest alerts on" after the phone revoked permission | Fixed | partly unit |
| ECC-20 | P3 | `scrub.ts`, `exercises.ts` | Two problems: (1) crash-report scrubbing missed `refresh_token=`, quoted JSON keys and "Bearer"; (2) `/exercise/constructor` crashed (prototype lookup) | Regex widened; null-prototype map | unit |

**Investigated, not changed:**
- The global Jest `testTimeout` (20 s) was reverted: two full suites run at the same time both passed (107/107 each) without it. The earlier failures came from a baseline run that overlapped with test files being written.
- Wrapping `auth.uid()` in a subselect in policies (performance, P3): not done, because the indexes above address the cost at current scale.
- Reading the food edge function body before auth (P3): not done; it is noted in the hardening handoff.

**Re-review of the fixes above (`ecc:typescript-reviewer`): 7 findings, all verified and fixed.**

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| RR-1 | P2 | `workout.tsx` "Add an exercise" | Its inner list sat inside the newly scrolling Sheet and could not scroll on Android | `nestedScrollEnabled` | device (D4) |
| RR-2 | P2 | `ui.tsx` Sheet | The keyboard could cover the custom-food fields on iOS | `automaticallyAdjustKeyboardInsets` | device |
| RR-3 | P2 | `progress.tsx` | The Load and Sets charts counted a week cut off at the 1000-row cap | Same cut-off as the Trends card | inspection |
| RR-4 | P2 | `data.tsx`, `_layout.tsx` | An expired token with no network was treated as signed out, so the person was stuck on sign-in | The Offline screen with Try again; any `load` rejection is caught | `session.test.tsx` |
| RR-5 | P2 | Food edge function | When every source failed, the function answered 200 with no foods, so the app said "No foods found" | 503 in that case; the app shows its error and falls back | — (deploy: owner) |
| RR-6 | P3 | `workout.tsx` pain stop | The check-in screen flashed after the last exercise was removed | `leave()` before `refresh()` | inspection |
| RR-7 | P3 | `workout.tsx` summary | "Swap in plan" for a lift swapped for one day only claimed success but changed nothing | Says it is not in the plan | inspection |

## Release-night fixes (2026-10-10, evening)

**Reviews:**
- `ecc:security-reviewer` checked the Play declarations against the code and found 8 mismatches.
- `ecc:code-reviewer` did a final review of this diff: no P1/P2, 2 P3 wording points, all fixed.

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| REL-1 | P2 | `sign-in.tsx` | Phone sign-in was offered to everyone. It is switched off on the server, so it errored and still sent the typed number | Hidden unless `EXPO_PUBLIC_PHONE_SIGNIN=on` | `signin.test.tsx` |
| REL-2 | P2 | `privacyPolicy.ts`, Data safety draft | The policy and Data safety draft missed three things: (1) Google ML Kit diagnostics from the barcode scanner; (2) the food-search cache (it was declared "ephemeral", but it is kept about 30 days without a user id); (3) some on-device items | Policy and Data safety corrected | `features.test.ts` (policy loads), review |
| REL-3 | P3 | Listing, Account sheet, export file text | "No third-party trackers", "all your data as JSON and CSV" and "kept at most 90 days" were overstated | Wording matches the code | review |

## Design-quality and security-hardening sprint (2026-10-10, night)

**How found:** the signed-in app was driven in a browser against a fully mocked backend (QA-only fetch interceptor, no production traffic); plus `ecc:security-reviewer`, `ecc:database-reviewer` and `ecc:a11y-architect` audits, each finding checked against the code.

| ID | Sev. | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| DS-1 | P2 | `_layout.tsx` | A blocked route fell back to the first listed screen, the privacy page: signed-out deep links (and possibly the moment after sign-in) landed on the privacy policy | `privacy` listed last | `routes.test.tsx` (fails 2/3 on the old order) |
| DS-2 | P2 | `stats.ts` `adherence` | Consistency counted the 8 weeks before the account existed: a perfect two-week user read 25% | Weeks before `profiles.created_at` excluded; partial first week counts once met | `engine.test.ts` |
| DS-3 | P2 | `sign-in.tsx` | Sign-up showed "letters and numbers" but enforced only length | `newPasswordProblem` before `signUp` | `signin.test.tsx` |
| DS-4 | P2 | `supabase.ts`, `food.ts` | No network deadline: a dead connection spun forever | `net.ts` `timedFetch` (20 s) for every Supabase and Open Food Facts call | `security.test.ts` |
| DS-5 | P2 | `scripts/check-all.sh` | Always exited 0 (fail-open) | Fails closed; audit gated at critical like CI | proven with a failing stub step |
| DS-6 | P2 | migration 6 §5 | Profiles deletable (resets consent and plan tier); saved meals and cardio editable past write limits; events and feedback backdatable; 25 MB/day of plans possible; future functions executable by default | Revokes, column grants, 64 KB plan cap, 30 plans and 500 events a day, default privileges | `security_tests.sql` 10b, 7 new mutations (33/33 caught) |
| DS-7 | P2 | screens | Errors not announced on iOS; Science links nested inside a button (unreachable by screen readers); unlabelled onboarding fields; titles without heading role; back button read "(tabs), back"; input borders and radio rings 1.3:1 and 2.8:1 | `ErrorText`, card toggle split out with `expanded`, labels, `header`, `headerBackTitle`, `control` token (3.6 to 4.2:1) | `signin.test.tsx`, `science.test.tsx` |
| DS-8 | P3 | Plan, Food, Home, Progress | "Hard sets done vs planned" card showed only planned sets; "1 items"; kcal without thousands separators; key values cut off ("Building bas…", "per 10…"); three date formats on one screen, with logged days off by one west of UTC | Honest copy, plurals, `toLocaleString`, 2-line values, one `shortDate` helper | `plan.test.tsx`, `food.test.tsx`, `engine.test.ts` |
| DS-9 | P3 | Fuel, onboarding | Sparkles ("AI") icons on rule-based features | Info and barbell icons | review |
| DS-10 | P3 | `food/index.ts` | USDA key header would follow a redirect | `redirect: 'error'` on keyed requests | `security.test.ts` |
| DS-11 | test | `fuel.test.tsx` | Built dates in UTC, so it failed in US evenings (the app writes local dates) | Local calendar days, assertion unchanged | itself |
