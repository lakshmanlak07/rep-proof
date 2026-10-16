# Load-test plan (staging only)

Written 2026-10-14. Nothing here may run against the production project (`hxxmh…`): the k6 script refuses it.
The 100,000-user claim stays **NOT DEMONSTRATED** until every pass criterion below is met on staging.

## 1. What was measured locally (2026-10-14)

`npm run test:capacity` (`supabase/tests/capacity_local.mjs`): real migrations on an in-process PGlite database, the
app's real queries run as a signed-in user with RLS on. Single process, no network, no concurrency: it shows per-request
cost and index use, not throughput.

| Data set | Home: sets (90 d) p50 / p95 | Progress: 1000 sets p50 / p95 | Fuel: one day p50 / p95 | save_workout (24 sets, triggers on) p50 / p95 | delete_account (heavy user) |
|---|---|---|---|---|---|
| 1,000 users, 1.2M sets, 0.6M food logs | 16.1 / 21.5 ms | 16.0 / 19.3 ms | 0.8 / 1.2 ms | 6.7 / 9.3 ms | 24 ms |
| 3,000 users, 3.6M sets, 1.8M food logs | 16.2 / 66.8 ms* | 22.2 / 27.6 ms | 1.7 / 3.8 ms | 10.6 / 16.3 ms | 21 ms |

Every read used a `(user_id, …)` index at both sizes, and medians stayed flat as the data tripled. *One p95 went over
the 50 ms budget at 3,000 users with only 20 runs, consistent with a garbage-collection pause in the single WASM
process; it is recorded as measured, and the check reported FAILED for that run. PGlite is Postgres 18 in WASM;
production is Postgres 17 on Supabase, so absolute numbers do not transfer.

## 2. Capacity model (estimates, not measurements)

Assumptions; change them and recompute:

| Parameter | Value |
|---|---|
| MAU | 100,000 |
| DAU / MAU | 0.30, so 30,000 DAU |
| Sessions per DAU | 1.6, so 48,000 sessions a day |
| Peak | 12 % of a day's sessions in the busiest hour; busiest second 3 × that hour's average (single-timezone launch: 20 %, 4 ×) |
| Requests per session | about 33 PostgREST requests (25 reads, 6 writes, 2 from the food flow), 0.8 food-function calls, 0.8 token refreshes |
| Food searches | 1.2 per DAU per day, 70 % cache hits |

Derived: about 770 concurrent sessions in the peak hour, 53 requests/s hour-average and 160 requests/s in the peak
second (89 and 354 for a single-timezone launch). Database busy time is about 95 ms per session, so connections and
CPU are not the first limit.

First limits, in order:

1. **Disk.** About 1.75 MB per active lifter-year (`logged_sets` about 325 B per set with indexes). Pro's 8 GB holds about
   4,700 lifter-years; 30 % of 100k MAU with a year of history is about 51 GB. `events` has no retention.
2. **Food providers.** USDA allows 1,000 requests per hour per IP, and every text search leaves from Supabase's
   servers. At 70 % cache hits the peak hour needs about 1,300 USDA calls, over the limit. Throttled answers are not cached.
3. **Auth email.** Supabase's built-in SMTP sends 2 emails an hour, to team addresses only. A launch day of about 11k
   sign-ups needs about 2,000 emails an hour through a real provider.
4. **Egress and read amplification.** Home and Progress each fetch up to 1,000 sets (about 150 KB of JSON) on every
   focus: about 650 GB a month uncompressed in this model, against 250 GB included in Pro.
5. **Crash storm.** A bug hitting every user at the 50-reports-a-day cap writes about 5M rows a day, and each insert's
   purge deletes expired rows with no limit.

## 3. Staging environment (owner)

1. Create a separate Supabase project on the plan, compute size and region production will use.
2. Link it and apply migrations 1-8 in order: `supabase link --project-ref <staging-ref>`, then `supabase db push`.
3. Deploy the food function to staging with provider stubs or a separate USDA key, so no production quota is spent.
4. Create test accounts in staging only (Auth → Users, or the Admin API with the staging service key, which never
   leaves the operator's machine), each with a profile and an active program.
5. Seed history at the target scale: 30,000 users with a year of history (about 50 GB) and 5M events. The seeding SQL
   in `supabase/tests/capacity_local.mjs` shows the shape.
6. Write `users.json` (`[{"email": "…", "password": "…"}]`) for the staging accounts and keep it out of git.

## 4. Run

```bash
k6 run -e STAGING_REF=<staging-ref> -e STAGING_URL=https://<staging-ref>.supabase.co -e STAGING_KEY=<staging publishable key> -e USERS_FILE=./users.json -e PEAK_VUS=400 -e SOAK=60m loadtest/k6-staging.js
```

The script ramps to `PEAK_VUS`, holds for `SOAK`, then ramps down. Each virtual user runs the app-start and Home reads,
a Fuel day and a food search, and saves a 20-set workout about one time in ten. Tokens are not refreshed, so keep a run
under the JWT expiry or raise it in staging. Watch Supabase's Reports (CPU, memory, connections, disk) during the run.

## 5. Pass criteria (all must hold before any 100k claim)

| Area | Criterion |
|---|---|
| Latency | Read p95 ≤ 400 ms; `save_workout` p95 ≤ 800 ms; food function p95 ≤ 1.5 s with provider stubs at 300 ms; p99 ≤ 3 s |
| Errors | 5xx and timeouts < 0.1 %; 429 only from the intended per-user limits |
| Sustained load | 400 requests/s for 60 minutes at the peak profile |
| Soak | 24 h at 50 % of peak: p95 drift ≤ 10 %, `private.rate_limits` size stable, disk growth within 20 % of the model, CPU < 60 %, pool < 70 % |
| Food | A 10-minute provider outage (stubbed 429s) gives ≥ 99 % 200s and no 5xx; a realistic query log reaches ≥ 77 % cache hits, or USDA confirms a higher limit in writing |
| Auth | 2,000 sign-ups an hour through the real SMTP provider, delivered p95 < 60 s; token refresh at 10/s without 429 |
| Crash storm | Inserts into `client_errors` keep succeeding with 5M expired rows present |
| Operations | Alerts fire in a drill (CPU, disk, error rate); a backup restores within the agreed time; heavy-user account deletion p95 < 2 s |
