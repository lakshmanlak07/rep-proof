# RepProof

Evidence-based gym training app. Expo (SDK 57, expo-router) + Supabase.

- `src/engine/`: training and nutrition rules, pure TypeScript. Tests: `npm test`.
- `src/app/`: screens. `src/lib/`: Supabase client and data access.
- `supabase/migrations/`: database, versioned (run in name order). `supabase/functions/food/`: food search (USDA + Open Food Facts).

## Setup (Windows)

1. Supabase project → SQL Editor → run each file in `supabase/migrations/` in name order.
   The beta project already has `20261001000000_initial.sql`; it still needs
   `20261002000000_hardening.sql` (security) and `20261004000000_bodyweight_and_metrics.sql` (bodyweight log, beta metric).
   The app keeps working before they are applied: plan rebuilds fall back to two steps and the bodyweight card shows a notice.
2. Authentication → Sign In / Providers → Email → turn off "Confirm email" (beta).
3. Copy `.env.example` to `.env`; fill in Project URL and publishable key (Project Settings → API).
4. Food search works out of the box via Open Food Facts (worldwide packaged foods, barcodes; no key).
   To add USDA generic foods and server-side caching, get a free key at https://fdc.nal.usda.gov/api-key-signup, then:
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

- References in `src/engine/references.ts` were checked against PubMed on 2026-10-01; re-check any you add.
- Review disclaimer (`src/lib/pending.ts`), exercise cues (`src/engine/exercises.ts`), nutrition cards (`src/engine/nutrition.ts`).
- Read feedback and survey answers in the `feedback` table (migration 3).

## Backend (Supabase)

| Piece | Where | Notes |
| --- | --- | --- |
| Auth | Supabase Auth: email + password, or mobile number + texted code | Age gate (18+) and disclaimer happen on-device before sign-up. Phone needs an SMS provider (below) |
| Data | `supabase/migrations` | Row-level security on every table; users only see their own rows |
| Account deletion | `delete_account()` RPC | Cascades to all user data (App Store requirement) |
| Plan replace | `replace_program()` RPC | Atomic; app falls back if migration 2 is not applied |
| Food search | `supabase/functions/food` | USDA FoodData Central + Open Food Facts merged, key stays server-side, 30-day cache. App falls back to Open Food Facts directly if not deployed |
| Beta metric | `select * from beta_week4_metric();` | Admin only (SQL Editor); week-4 retention from the PRD |
| Analytics | `events` table | Insert-only from the app |
| Feedback + weekly survey | `feedback` table (migration 3) | Insert-only; read in Table Editor |
| Founding-member waitlist | `events` where `name = 'pro_waitlist_joined'` | PRD second success signal |
| Bodyweight | `bodyweight_logs` (migration 3) | One entry per day; updates `profiles.bodyweight` |

## Checks

`npm run typecheck`, `npm run lint`, `npm test`. GitHub Actions runs all three plus `deno check` on the food function for every push.

## Phone sign-in (optional)

The app offers "Mobile number" sign-in. Until it is switched on, it tells users to use email.
Supabase dashboard -> Authentication -> Sign In / Providers -> Phone: enable it and connect an SMS
provider (Twilio, MessageBird, Vonage or Textlocal; needs an account with that provider, texts are paid).

## Philosophy

Evidence-based training without the guesswork. Evidence first. Individual response second.
Algorithmic recommendations third. Hype never. Every recommendation carries a tier:
Tier 1 direct evidence, Tier 2 principle-based, Tier 3 RepProof rule (never presented as science).
The science screen lists the principles, tiers, topics with verified studies, cautions and open debates
(`src/engine/science.ts`).

## Training model and decision engine

- Every exercise: one warm-up set (~80% x 5), then 1-3 working sets: 2 by default, 3 for weak points, 1 for strong points.
- Effort styles: last set to failure with earlier sets ~2 in reserve (default; beginners 1 short), all sets 1-3 in reserve, or every set to failure.
- Train -> Record -> Interpret -> Adjust (`src/engine/decisions.ts`): after each workout every lift gets a decision with its
  reason and tier: progressing, add a set (stalled 2 sessions, recovery fine, up to 3), one set fewer (falling performance +
  rough check-ins), recover first, swap suggestion (stuck 4 sessions at 3 sets), or train closer to target effort.
  Set changes go into the plan automatically (not during deloads, never on pinned lifts); swaps need the user's OK.
