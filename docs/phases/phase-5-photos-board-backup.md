# Phase 5 — Photos, board log and backup

Goal: remember climbs by photo, track board sessions, and make the data safe to lose a phone with.

Skills: `pwa-ios`, `data-model`, `ui-design`.
Read: `docs/data-model.md` (Export format, types), `docs/ui-spec.md` (Board, Settings).

## Tasks

1. Photo capture on Log climb: camera or library → downscale (max 1280 px long edge, JPEG ~0.7) + 160 px thumbnail → store blobs. Show thumbnails in project and problem lists; full view on tap.
2. Photo retention: delete photos of problems in sets retired more than `photoRetentionDays` ago (default 90), keeping the problem.
3. Board screen and `BoardLog` storage; show board entries in session history.
4. Export: zip of JSON + photos via the share sheet / download. "Include photos" toggle.
5. Import: validate, confirm, replace database, migrate older `schemaVersion`.
6. Backup reminder banner when the last export is more than 30 days old. Storage usage in Settings.

## Out of scope

Cloud sync, automatic backups to a server.

## Success criteria

- [ ] Stored photos average ≤ 300 KB and thumbnails ≤ 15 KB on a set of 10 test images (tested).
- [ ] Export → clear database → import yields a deep-equal database, photos included (automated test).
- [ ] Import refuses a file with a higher `schemaVersion` and a file from another app, with a clear message (tested).
- [ ] Retention removes only photos past the window and leaves the problems intact (tested).
- [ ] Board entries appear in session history and are excluded from every colour metric (tested).
- [ ] Backup banner appears at 31 days and clears after an export (tested with a fake clock).
- [ ] Needs human: taking a photo from the iPhone camera works from the installed app.
- [ ] Needs human: an exported file saves to Files and imports back on the phone.
