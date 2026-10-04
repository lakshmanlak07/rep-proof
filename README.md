# RepProof

Evidence-based gym training app. Expo (SDK 57, expo-router) + Supabase.

- `src/engine/`: training and nutrition rules, pure TypeScript. Tests: `npm test`.
- `src/app/`: screens. `src/lib/`: Supabase client and data access.
- `supabase/migrations/`: database, versioned (run in name order). `supabase/functions/food/`: USDA food search proxy.

## Setup (Windows)

1. Supabase project → SQL Editor → run each file in `supabase/migrations/` in name order.
   The beta project already has `20261001000000_initial.sql`; it still needs
   `20261002000000_hardening.sql` (security) and `20261004000000_bodyweight_and_metrics.sql` (bodyweight log, beta metric).
   The app keeps working before they are applied: plan rebuilds fall back to two steps and the bodyweight card shows a notice.
2. Authentication → Sign In / Providers → Email → turn off "Confirm email" (beta).
3. Copy `.env.example` to `.env`; fill in Project URL and publishable key (Project Settings → API).
4. Food search: get a free key at https://fdc.nal.usda.gov/api-key-signup, then:
   ```
   npx supabase login
   npx supabase link --project-ref <your project ref>
   npx supabase secrets set FDC_API_KEY=<key>
   npx supabase functions deploy food
   ```
5. Run: `npx expo start`, scan the QR code with Expo Go.

## Builds

- Android tester APK: `npx eas-cli@latest build --profile preview --platform android`
- Store builds: `npx eas-cli@latest build --profile production --platform all`

## Before release

- Confirm DOIs for references without one in `src/engine/references.ts` (links appear once a DOI is set).
- Review disclaimer (`src/lib/pending.ts`), exercise cues (`src/engine/exercises.ts`), nutrition cards (`src/engine/nutrition.ts`).
- Set `FEEDBACK_EMAIL` in `src/app/settings.tsx`.

## Backend (Supabase)

| Piece | Where | Notes |
| --- | --- | --- |
| Auth | Supabase Auth, email + password | Age gate (18+) and disclaimer happen on-device before sign-up |
| Data | `supabase/migrations` | Row-level security on every table; users only see their own rows |
| Account deletion | `delete_account()` RPC | Cascades to all user data (App Store requirement) |
| Plan replace | `replace_program()` RPC | Atomic; app falls back if migration 2 is not applied |
| Food search | `supabase/functions/food` | Proxies USDA FoodData Central, key stays server-side, 30-day cache |
| Beta metric | `select * from beta_week4_metric();` | Admin only (SQL Editor); week-4 retention from the PRD |
| Analytics | `events` table | Insert-only from the app |
| Feedback + weekly survey | `feedback` table (migration 3) | Insert-only; read in Table Editor |
| Founding-member waitlist | `events` where `name = 'pro_waitlist_joined'` | PRD second success signal |
| Bodyweight | `bodyweight_logs` (migration 3) | One entry per day; updates `profiles.bodyweight` |

## Checks

`npm run typecheck`, `npm run lint`, `npm test`. GitHub Actions runs all three plus `deno check` on the food function for every push.
