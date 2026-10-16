# Signed-in test checklist (manual)

The automated suites cover the database, export, deletion and screen states without a real account (`docs/TEST_EVIDENCE.md`). They cannot sign in to the live project, because no test account or `.env.local` exists in this repo. Run this checklist on the emulator or a phone before the closed test.

**Rules**
- Use only throwaway accounts with made-up data: **A** (`rp-test-a+<date>@<your domain>`) and **B**. Never use a real account.
- Never paste a password or key into chat or a file in the repo. Keep them in `.env.local`, which is gitignored.
- Do step 9 (deletion) on account B or a third spare account only.
- Record the result of every step (pass, fail, or not run) with the date, device and build.

| # | Area | Steps | Expected |
|---|---|---|---|
| 1 | Sign up and onboarding | Create A, confirm the email code, finish onboarding | Lands on Home with a plan; no error banner |
| 2 | Session restore | Force-stop the app, reopen | Still signed in as A, same plan |
| 3 | Offline start | Airplane mode, reopen the app | Cached screens or a clear error; Home shows "—" for nutrition and "Unknown" readiness, not zeros; Retry works after reconnecting |
| 4 | Workout lifecycle | Start today's workout, log 3 sets (one with RPE if the effort scale is RPE), kill the app mid-workout, reopen, resume, finish | The draft survives the kill; finish saves once (double-tap does not create two workouts); History shows the workout with the right sets |
| 4b | Delete a workout | Progress › a workout › Delete this workout › Cancel, then Delete › Delete | Cancel keeps it; Delete returns to Progress and the workout, its sets, PRs and weekly volume no longer count it |
| 5 | Nutrition | Add 2 foods (search plus a saved meal), edit grams on one, delete the other, tap Add twice quickly | Totals and "kcal left" update after each change; no duplicate entry; empty meals say "Nothing yet" |
| 6 | Nutrition failure | Airplane mode on Fuel, pull to the tab again | "—" and "Could not load today's foods" with Retry; Retry shows "Loading today's foods…" and then real totals once back online |
| 7 | Progress and readiness | Log bodyweight; answer a check-in after a workout | Chart shows the new point; Insights readiness matches the check-in |
| 8 | Export | Account › Your data › Download | JSON and CSV open; they contain only A's rows; `not_included` lists the write-only tables |
| 9 | Account switching | Sign out of A (confirm sheet), sign in as B | No A data visible anywhere (Home, Fuel, History, Progress); the effort-scale preference was reset |
| 10 | Deletion | As B: Your data › Delete › Cancel, then Delete › Delete | Cancel keeps everything; Delete signs out; signing in as B again fails or starts a fresh onboarding; A is unaffected |
| 11 | Deleted elsewhere | Sign in as a spare account on two devices, delete on one, reopen the other | The second device signs out instead of getting stuck in onboarding |
| 12 | Expired session | Leave signed in over the JWT expiry (dashboard setting), reopen | Silent refresh, or a clean sign-in screen; never a blank screen |

## On a physical phone (cannot be checked in this environment)

| # | Area | Steps | Expected |
|---|---|---|---|
| D1 | Rest notifications | Account › Notifications › on, then allow. Log a set, lock the screen and wait for the rest time | "Rest is over" arrives. Repeat with permission denied, and again after revoking it in the phone's settings: Account then shows "Off" and no alert fires |
| D2 | Barcode | Add food › Scan a barcode on a packaged food; deny the camera twice, then retry | The food opens with 1 serving. After a permanent denial, "Open settings" opens the app's settings page |
| D3 | RIR rep-out | Finish an isolation exercise (e.g. cable fly) › Try a rep-out › save | The result text matches your numbers. The workout's saved sets do not include the rep-out |
| D4 | Accessibility | TalkBack on: walk through sign-in, logging a set, adding food and Account. Then repeat at the largest font size | Every control is announced with a name, and no text is cut off |

After the run: `npm run test:live:auth` and `npm run test:live:app` (they read the throwaway credentials from `.env.local`) give an automated cross-check against the live project.
