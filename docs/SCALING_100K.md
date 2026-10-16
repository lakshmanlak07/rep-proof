# Scaling to 100,000 users (2026-10-13)

## What the code already does (verified)
- Every app query is scoped to one user by RLS and served by a `(user_id, ...)` index. Migration 7 adds `food_logs (user_id, created_at desc)` and makes all 11 policies evaluate `auth.uid()` once per query instead of once per row (Supabase advisor 0003). Applied to production.
- No unbounded reads: history, sets, foods and cardio are capped (`limit`) or date-bounded.
- Writes are rate-limited per user in the database (`private.enforce_write_limit`): e.g. programs 30/day, events 500/day, crash reports 50/day.
- Food search: 20/min and 500/day per user; results cached server-side for 30 days; if USDA throttles, the function returns partial results (Open Food Facts plus 44 built-in foods), never an error page. Correction (2026-10-14 review): text search goes through the food function, which calls USDA and Open Food Facts from Supabase's servers, so both providers' per-IP limits are shared by all users; only barcode lookups and the fallback after a function failure call Open Food Facts from the phone. Throttled answers are not cached. See docs/RELEASE_HARDENING_REPORT.md (capacity) for the corrected model.
- Crash reports purge themselves after 90 days; the food cache after 30.

## Limits that bind before 100,000 users (owner decisions, verified 2026-10-13)
| Limit | Free plan | Needed | Action |
|---|---|---|---|
| Supabase plan | 50,000 MAU, 500 MB DB, 5 GB egress, 500k function calls; **paused after 1 week of inactivity** | 100k MAU, multi-GB DB | **Pro ($25/mo)**: 100k MAU, 8 GB disk, 250 GB egress, 2M function calls, never paused (supabase.com/pricing) |
| Auth email | Default SMTP: **2 emails/hour, team addresses only** | Every sign-up and password reset | Custom SMTP (e.g. Resend, Postmark, SES) in Auth → SMTP (supabase.com/docs/guides/auth/auth-smtp) |
| USDA FoodData Central key | 1,000 requests/hour per IP | Shared by all users through the function | Ask FDC for a higher limit; cache and fallback already absorb bursts |
| Database growth | — | Rough estimate: ~2-3 MB per active user per year (sets, food logs, events, indexes) | Watch Database → Usage; `events` has no retention yet: decide one (e.g. 12 months) and add it to the privacy policy before purging |

## Not tested
- No load test against production (not authorized, and it would hit real rate limits). The queries are index-backed per user, so per-request cost does not grow with the user count; total cost grows with storage and traffic, which the plan limits above cover.
