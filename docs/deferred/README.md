# Deferred: community and camera tools

Built on 2026-10-09 at the owner's request, then taken out of the app the same day: the sprint brief that followed did not authorise a community forum, camera form checking or bar-speed tracking for this release.

Nothing here ships. It is kept so the work is not lost if the owner approves these features later.

- `community-and-camera-tools.patch`: the full source of these files, as `git apply`-able additions:
  - The camera tools (`src/camera/*`, `src/app/camera.tsx`): an on-device MediaPipe pose model in a WebView or iframe, which downloads about 18 MB from Google and jsDelivr.
  - The pose and bar-speed engine with its tests (`src/engine/pose*.ts`).
  - The community client and rules (`src/lib/community*.ts`).
  - The full migration 6, including the community tables, RLS, moderation RPCs, content screening and rate limits.
- `community-security-tests.sql`: the database tests that went with it. All 141 checks and 24/24 mutation checks passed on 2026-10-09 before removal.

Re-enabling them needs owner decisions first:
- Community: a moderator, user-generated-content duties on Google Play, and privacy-policy and Data safety updates.
- Camera: the external model download (a new third-party request) and a privacy-policy update.
