# Google Play listing: draft for owner review

**Status:** draft, not submitted. Every claim below describes a feature that exists in the app today. There are no medical, injury or results promises.

## App name (max 30)
RepProof: Evidence Lifting

## Short description (max 80)
Strength training and nutrition that shows the evidence behind every suggestion.

## Full description (max 4000)
RepProof builds a strength-training plan around your schedule and equipment, then adjusts weights, reps and sets from what you actually log. Every suggestion tells you why, and labels where the reasoning comes from.

TRAIN WITH A PLAN YOU CAN CHECK
• A plan built from your experience, goal, equipment and training days (2-6 a week)
• Progression from your own logs: add reps, then weight; hold or reset when a session goes badly
• Log effort as reps in reserve (RIR) or RPE
• A quick readiness check-in that trims the day when you are run down
• Missed a session? Do it now or skip ahead. Deload weeks are offered, never forced
• Exercise swaps that keep the same movement and muscle, and a pain-stop option
• Rest timer with optional alerts
• 200+ exercises (201) with written steps, cues and common mistakes for each movement pattern

SEE YOUR PROGRESS
• Strength trends, personal records and workout history
• Weekly hard sets per muscle against a productive range
• Bodyweight trend and an 8-week consistency view
• Download your account data as JSON, and your logged sets as CSV

EAT FOR YOUR GOAL
• Calorie and protein targets for maintenance, fat loss, muscle gain or recomp
• Food search across common foods, USDA and Open Food Facts, with the source on every result
• Barcode scanning, servings, grams or ounces, meal logging, edits and a 14-day intake trend

EVIDENCE, LABELLED HONESTLY
Every recommendation carries one of three labels:
• Direct evidence: a study tested it
• Principle-based: built from several findings
• RepProof rule: our own product choice
The Learn tab explains each topic in plain language, says what the research does not show, and links to the studies. There is also a glossary of training terms.

PRIVACY
No ads, no data selling, no advertising trackers. Delete your account and every record from inside the app.

RepProof is for adults 18+. It provides training information, not medical advice.

## Category and tags
- Category: Health & Fitness
- Contact email: (owner to choose; also used on the deletion page)
- Website: (the hosted site, once published)

## Graphics
| Asset | File | Status |
|---|---|---|
| App icon 512×512 | `store/play-icon-512.png` | Ready (from the Design System brand mark) |
| Feature graphic 1024×500 | `store/play-feature-graphic-1024x500.png` | Ready |
| Phone screenshots (2-8, 16:9 or 9:16) | not yet | **Needs a signed-in device or emulator session**: Home, workout in progress, Progress, Fuel, Learn |

## Release notes: internal test 1.0.0 (max 500 characters)
First internal test of RepProof:
- Training plans that adapt from your logs, with RIR/RPE effort tracking, readiness check-ins, deloads and rest timer.
- Progress: strength trends, weekly sets and 4-week effort trends, personal bests, workout history.
- Nutrition: calorie and protein targets, food search and barcode scanning, 14-day intake trend.
- Learn: evidence-labelled explanations with linked studies.
Please report bugs from Account › Send feedback.

## App access (Play Console › App content › App access)
- Choose: "All or some functionality is restricted".
- Instructions: "Sign in with the review account below. If asked, complete the short onboarding (any answers). Then start today's workout from Home, log a set, and open Fuel and Progress."
- Credentials: the owner creates a dedicated review account and types its email and password **only into Play Console**. Never put them in this repo or in chat.

## Permission justifications (built manifest, verified 2026-10-10)
| Permission | Why |
|---|---|
| CAMERA | Scan food barcodes on the phone (requested only when the scanner opens; images are never saved or uploaded) |
| INTERNET | Sync the account and data with the server; look up foods |
| POST_NOTIFICATIONS | Optional local "Rest is over" alert; requested only when the user turns rest alerts on; no push or marketing |
| VIBRATE | Vibration on the rest-over alert |
| ACCESS_NETWORK_STATE | Added by a library (`expo-image`); not used by the app's own code |
| WAKE_LOCK | Added by `expo-notifications` (Firebase Messaging); the app uses no remote push |

No location, contacts, storage, microphone or advertising ID permissions. (`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is AndroidX's own signature-level permission.)

## Screenshots to capture (owner, signed in with the review account; real app, no mock-ups)
Phone portrait, 2–8 images, PNG or JPEG:
1. Home: today's workout and readiness
2. A workout in progress: logging a set with RIR
3. Workout summary: "What changes next time" with its evidence label
4. Progress: strength trend or weekly sets with the 4-week trend
5. Fuel: calorie and protein targets with the diary
6. Learn: a topic with its limitations and linked study
