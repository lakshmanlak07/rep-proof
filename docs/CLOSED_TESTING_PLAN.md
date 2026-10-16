# Closed testing plan (personal Google Play account)

**Status:** prepared, NOT started. No testers have been invited, no track exists, nothing has been submitted. Every step below needs the owner and real people.

## The requirement (official page, checked 2026-10-09)

[Play Console Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465)

- **Who it applies to:** personal developer accounts created after **13 November 2023**.
  - The owner says the account is personal.
  - Its creation date is shown in Play Console (Account details). Confirm it there; the repository cannot tell.
- **Requirement:** at least **12 testers opted in continuously for at least 14 days** in a **closed** test.
  - Internal testing does not count.
  - A tester who opts out and back in restarts their 14 days.
- **Then:** apply for production access. The form has three parts:
  1. **About your closed test:** how recruiting went, whether testers used all features, whether usage matched expectations, how feedback was gathered.
  2. **About your app:** audience, value, expected first-year installs.
  3. **Production readiness:** what changed after testing, and how readiness was judged.

## Before inviting anyone (owner)

- [ ] A Play-signed AAB uploaded to the closed track. The local build is debug-signed and will be rejected; see `REP_PROOF_RELEASE_PLAN.md`.
- [ ] Privacy-policy URL and account-deletion URL live (`site/README.md`).
- [ ] Data safety, Health apps declaration, content rating and target audience completed (`REP_PROOF_LAUNCH_READINESS.md` §7).
- [ ] Migration 6 applied, so crash reports from testers actually arrive.
- [ ] Custom SMTP working, so testers receive sign-up codes. Test it with your own second address first.
- [ ] Recruit **15-20** testers so that dropouts still leave 12 opted in for 14 days.

## Tester eligibility and recruitment

- Adults (18+), matching the app's age gate and target audience.
- A Google account on an Android phone running Android 7.0 or later (minSdk 24).
- People who actually lift: friends, gym partners, a uni lifting club. Do not buy testers, swap installs with strangers, or use fake accounts. Google can see that, and it defeats the purpose.
- For each recruit, collect only the email of their Google account, which you need to add them to the tester list. Store the list in Play Console, not in this repository.

## Opt-in instructions (send to each tester)

> Thanks for testing RepProof!
> 1. Open this link on your Android phone, signed in with the Google account I added: <closed-test opt-in link from Play Console>
> 2. Tap "Become a tester", then install RepProof from the Play Store link on that page.
> 3. **Stay opted in for at least 14 days.** Please do not leave the test early, even if you stop using the app.
> 4. Use it for real: log 2-3 workouts and a few days of food.
> 5. Report problems in the app (Account › Send feedback) or by replying to this message.

## What testers should try (feature checklist)

| Area | Ask testers to | Watch for |
|---|---|---|
| Sign-up | Create an account with email and code; the age gate | Codes not arriving (SMTP) |
| Onboarding | Finish setup; see the plan | Confusing questions |
| Workout | Check-in, log sets (RIR or RPE), rest timer, swap, finish | Save failures, lost drafts |
| History | Open a past workout from Progress | Wrong numbers |
| Progress | Strength, sets and body tabs; consistency card | Empty or wrong charts |
| Fuel | Search, scan a barcode, edit and delete an entry, 14-day trend | Wrong totals, failed search |
| Learn | Open topics and the glossary | Unclear wording |
| Account | Effort scale, rest alerts, download data, sign out and back in | Export fails, alerts missing |
| Deletion (optional, a spare account only) | Delete account | Anything left behind |

## Bug report template (for feedback messages)

```
What I did:
What I expected:
What happened instead:
Screen:
Phone model / Android version:
How often: always / sometimes / once
```

## Feedback and review routine (owner)

- **Channels:**
  - In-app feedback (`feedback` table; read it in the Supabase Table Editor).
  - Crash reports (`client_errors`, migration 6; SQL in `docs/OPERATIONS_RUNBOOK.md`).
  - Play Console's pre-launch report and Android vitals.
- **Twice a week:** read new feedback and crash reports, and log them in the table below.
- Fix release blockers first, then upload a new build to the same closed track. Testers stay opted in; their 14 days do not reset.

## Tracking sheet (fill in with real data only)

| Tester (initials) | Invited | Opted in (date) | Day 14 reached (date) | Still opted in? | Feedback sent? |
|---|---|---|---|---|---|
| | | | | | |

**Day-14 count:** the number of testers with 14 consecutive opted-in days = ____ (needs ≥ 12).

## Evidence to keep for the production application

- Dates the test started and when 12 testers reached 14 days (from Play Console).
- A summary of the feedback received, and what changed because of it (releases and fixes).
- Features testers used, from the usage events: `select name, count(distinct user_id) from public.events group by 1 order by 2 desc;`
- Crash-free experience: the count of `client_errors` per build version.
