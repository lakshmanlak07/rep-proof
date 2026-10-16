# Technical debt (2026-10-09)

## Necessary before or soon after launch

| Item | Why it matters | Suggested fix |
|---|---|---|
| Screen tests do not cover Forgot password, Age, Disclaimer, Feedback, Workout day or Privacy (Plan, Training, Onboarding, Sign-in and Science were added 2026-10-09) | Fuel, Home, Insights, Account, Workout, Workout detail, Volume, Add food, Progress and Library are covered (`src/__tests__`, 8 suites); these remaining screens are verified only by inspection and the emulator | Extend `src/__tests__` (jest-expo is set up; Reanimated has a minimal manual mock in `setup.ts` because its own mock needs the native worklets runtime) |
| No authenticated integration test in CI | Cross-account isolation is proven on a disposable Postgres, not against the live project; the signed-in flows were never automated this sprint | Keep a throwaway account in `.env.local` and run `test:live:auth` / `test:live:app` before each release (owner) |
| Screens query Supabase directly | The data layer is split between `lib/*` helpers and inline queries (Progress, Home, Plan, Volume), so error handling is duplicated and inconsistent | Move the remaining inline queries into `lib/` functions that return `{data, error}`, then test them |
| Client-side stats over the last 2000 sets (`progress.tsx`) | Fine for months of use; a heavy user would eventually hit the cap, and charts would silently cover less history | SQL views or RPCs for weekly aggregates (noted in the code as `ponytail:`) |
| `decode-uri-component` advisory (shipped) | Mitigated by `safeLink`, not removed | Re-check when expo-router moves off `query-string@7` |
| Dev-time advisories (braces, node-forge, uuid) | No patched releases | Re-check every Expo SDK update (`docs/OPERATIONS_RUNBOOK.md` §8) |
| Release signing | Local builds are debug-signed | EAS-managed upload key (owner) |

## Optional improvements

| Item | Notes |
|---|---|
| ~~`readiness()` untestable~~ | Done: moved to `lib/stats.ts` and behaviourally tested |
| Two account-deletion code paths existed (`settings.tsx` was deleted; only `profile.tsx` remains) | Done; keep one path |
| `localStorage` keys are spread across files | `prefs.ts` has `LOCAL_KEYS`; `supabase.ts` clears a separate subset on involuntary sign-out. Unify once onboarding's pending-data flow is covered by a test |
| ml-to-gram serving approximation | Accurate for water-like drinks only; a density table would help oils and syrups |
| Library renders up to 60 cards without virtualization | Acceptable now; switch to `FlatList` if the library grows |
| Dark mode | Tokens exist (`darkColor`), not wired |
| Deferred features (community, camera tools) | Preserved in `docs/deferred/`; owner decision needed before any work |
| Unused dependencies `expo-image`, `expo-device` | Template leftovers, never imported; removing them drops a little native code. (`@expo/ui`, `expo-glass-effect`, `expo-symbols` are also unimported but are hard dependencies of expo-router, so they stay installed either way.) Remove with `npm uninstall`, then a full native rebuild and an emulator smoke test |
| `eslint-config-expo` is listed in both `dependencies` and `devDependencies` | Keep only the dev entry |
| App size: R8 minification off (53.5 MB uncompressed dex) and x86/x86_64 ABIs built | Users download only their own ABI from an AAB (about 35 MB estimated for arm64), so this is not urgent. Enabling R8/resource shrinking and dropping x86 needs the `expo-build-properties` plugin, a full rebuild and an authenticated device test (R8 can break reflection-based libraries) |
