# RepProof — Release Plan (Phases 7–9)

Plan date: 2026-10-09. Owner = the RepProof founder; Claude = coding agent. All dates are targets. Each needs the listed approval first.

Milestones are tracked separately and never merged:
1. **Code complete**
2. **Locally tested** (tsc, lint, `npm test`, `test:db`, web preview)
3. **Real device** (APK on a phone)
4. **Release build** (signed AAB)
5. **Submitted** (to the closed track)
6. **Approved** (Play review passed)
7. **Published** (production)

## P0: required for the closed test (target Oct 10–13)

| ID | Task | Owner | Needs approval | Done when |
|---|---|---|---|---|
| A-01 | Icon, adaptive icon, splash | Claude (art) + owner (approve) | Yes: artwork | Code complete + locally tested |
| A-02, A-03 | Privacy policy + deletion page, hosted | Claude drafts; owner approves publishing and hosting | Yes: publishing | URLs return 200 |
| A-04, A-05 | Data safety, health declaration, content rating, audience | Claude drafts answers; owner submits in Console | Yes | Console shows complete |
| A-06 | Listing copy + screenshots | Claude drafts; owner uploads | Yes | Console listing complete |
| C-01 | Custom SMTP + dashboard hardening | Owner (dashboard); Claude gives click-by-click steps | — | Tester receives a code; `test:live:auth` passes |
| G-01, B-04 | Remove placeholder; finish design screens | Claude | Yes | Locally tested |
| B-01 | Signed-in visual pass | Owner signs in; Claude checks | — | All tabs verified |
| A-07 | `eas build` preview APK + production AAB | Owner runs EAS login; Claude runs builds | Yes: builds | Release build milestone |
| B-02 | Device smoke test | Owner (phone) | — | Real device milestone |
| A-08 | Create closed track, upload AAB, invite 12+ testers | Owner | — | Submitted milestone |

## P1: before applying for production (during the 14-day test)

B-03 crash reporting · B-06 audit triage · C-02 backups · L-01 TalkBack pass · fixes from tester feedback.

## P2: first update after launch

I-01 glossary · J-03 data export · H-02 weight-trend check · B-05 rest notification.

## P3 / P4: later

E-02 RIR calibration · I-02 new explainers · J-02 trend dashboard · H-03, H-04 nutrition nudges.

## Dependency order

```
A-01 ─┐
G-01/B-04 ─┼─> B-01 visual pass ─> A-06 screenshots ─┐
A-02/A-03 ─> A-04 Data safety ───────────────────────┤
C-01 SMTP ───────────────────────────────────────────┤
A-07 EAS build ─> B-02 device test ──────────────────┴─> A-08 closed test (14 days) ─> production application ─> review ─> publish
```

## Testing rules (Phase 8)

- Every code change: `npx tsc --noEmit`, `npm run lint`, `npm test`. Run `npm run test:db` if SQL changes.
- No claim of pass without the observed output.
- Live tests are read-only, or use the throwaway account only; never production user data.
- Device checklist: install APK; sign up with email code; onboarding; start workout; log sets with comma decimals; background and resume (draft survives); finish and save; offline save retry; food search, barcode scan, edit log; progress charts; account deletion.

## Status tracking (Phase 9)

Each status report lists, per backlog ID, its highest *observed* milestone (1–7), plus open blockers and unknowns from `REP_PROOF_LAUNCH_READINESS.md` §5–6. Scores are recalculated with the same weights.

## Status 2026-10-09 (end of sprint)

**Milestones reached:**
- Code complete and locally tested for the P0 code items: icons, placeholder removal, privacy and deletion page generators, error states.
- Release-build milestone: debug-signed APK and AAB, verified.
- Signed-out emulator run.

**Not reached:**
- Real device.
- Play-signed build.
- Submission, approval, publication.

**Owner actions, in order:**
1. Apply `supabase/migrations/20261009000000_rpe_and_crash_reports.sql` in the Supabase SQL Editor, then verify with `supabase/tests/security_tests.sql` (see `OPERATIONS_RUNBOOK.md` §2: preferably on a Supabase branch).
2. Choose a contact email, run `SUPPORT_EMAIL=… npm run build:site`, and host `site/dist` (see `site/README.md`). Put the two URLs in `.env` (`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_DELETE_ACCOUNT_URL`) and in Play Console.
3. Play-signed AAB: `npx eas-cli@latest login`, then `npx eas-cli@latest build --profile production --platform android`.
4. Fill in Play Console from `REP_PROOF_LAUNCH_READINESS.md` §7 and `store/listing.md`:
   - Data safety, Health apps declaration, Content rating, Target audience 18+, Ads = none.
   - App access: a review account entered only in Console.
5. Sign in on the emulator or your phone, test the signed-in flows, and capture 2-8 screenshots.
6. Closed track: invite 12+ testers, who stay opted in for 14 consecutive days.

## Play submission runbook (2026-10-10)

### What can go out tonight
Google Play rules (support.google.com/googleplay/android-developer/answer/14151465 and 9845334, fetched 2026-10-10):
- **Internal testing:**
  - available at once, with no prerequisites;
  - up to 100 testers;
  - "might not be subject to standard Play policy or security reviews";
  - "you can create an internal testing release if your app is not fully configured".
- **Closed testing:** needs "Complete app setup" first: privacy policy, Data safety, content rating, target audience, health declaration, app access, ads and account deletion.
- **Production:** for a personal account created after 13 Nov 2023, it stays disabled until a closed test has had **at least 12 testers opted in for 14 consecutive days**.

**Tonight's realistic target:** an internal-testing release. It is blocked only on a release-signed AAB.

### Blocker: release signing (owner)
The local build is signed with `android/app/debug.keystore` (CN=Android Debug), so Play rejects it. No release keystore exists, the Expo account is not logged in, and `app.json` has no EAS project id. Nothing was created on the owner's behalf.

**Path A (recommended): EAS-managed upload key.** Run from `repproof/`:
```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile production
```
- **`init`:** links the project. It adds `extra.eas.projectId` and `owner` to `app.json`; review that diff.
- **`build`:** uploads the source to Expo's build servers and makes an AAB. The `production` profile builds an app bundle with `autoIncrement` and a remote version code. When asked, choose "Generate a new Android Keystore"; EAS keeps the key.
- **Config:** `.env` is tracked and holds only the public Supabase URL and publishable key, so the cloud build gets them. Set `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_DELETE_ACCOUNT_URL` before the build once the pages are hosted (required for closed testing, not for internal).

**Path B: your own upload key.** Generate it with `keytool` on your machine, keep it out of the repo, and wire signing through a config plugin. Not recommended tonight: `android/` is regenerated by prebuild (CNG), so hand edits there are lost.

### Verify the signed AAB before uploading
Download the AAB, then run:
```bash
keytool -printcert -jarfile app-release.aab
```
- It must **not** show `CN=Android Debug`.
- Check the package (`com.repproof.app`), version (1.0.0) and target SDK (36): `bundletool dump manifest --bundle app-release.aab`, or upload to an internal test and read Play Console's bundle explorer.

### Play Console steps
Only after your explicit go-ahead; nothing has been uploaded.
1. Create the app:
   - name "RepProof: Evidence Lifting";
   - App; Free;
   - accept the developer policies and US export laws declarations.
2. Testing › Internal testing › Testers: create an email list, then copy the opt-in link.
3. Internal testing › Create new release:
   - accept **Play App Signing** (default);
   - upload the AAB;
   - paste the release notes from `store/listing.md`;
   - Save, then Review release, then **Start rollout to Internal testing**.
4. Testers open the opt-in link and install from Play.
5. Before closed testing, complete App content:
   - Privacy policy URL;
   - App access (review account);
   - Ads: none;
   - Content rating (draft §7.4);
   - Target audience 18+;
   - Data safety (draft §7.2, updated 2026-10-10 with ML Kit diagnostics and the food-search cache);
   - Health apps (draft §7.3);
   - Account deletion URL.
   Then the store listing: `store/listing.md`, the icon, the feature graphic and 2–8 real screenshots.
6. Closed test: 12+ testers opted in for 14 consecutive days (`docs/CLOSED_TESTING_PLAN.md`), then apply for production.
