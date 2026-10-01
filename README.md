# RepProof

Evidence-based gym training app. Expo (SDK 57, expo-router) + Supabase.

- `src/engine/`: training and nutrition rules, pure TypeScript. Tests: `npm test`.
- `src/app/`: screens. `src/lib/`: Supabase client and data access.
- `supabase/schema.sql`: database. `supabase/functions/food/`: USDA food search proxy.

## Setup (Windows)

1. Supabase project → SQL Editor → run `supabase/schema.sql`.
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
