# Phase 3 — Reset tracking

Goal: one tap retires a wall's old climbs without touching history.

Skills: `ui-design`, `data-model`.
Read: `docs/data-model.md` (Resets, Walls), `docs/ui-spec.md` (Walls, Today strip).

## Tasks

1. Domain functions (pure, tested): default reset date from a gym's set days, apply reset, undo reset.
2. Walls list and wall detail screens.
3. "Mark as reset" sheet with the default date and a date picker (no future dates, not before the current set's date).
4. "Days since set" strip and 7-day "fresh" badge on Today.
5. Past sets view on wall detail (collapsed, read-only).

## Out of scope

Automatic import of the gym's reset schedule (Phase 6 spike).

## Success criteria

- [ ] Reset expires every `project` problem on that wall's current set, leaves `sent` problems as sent, and creates a new current set (tested).
- [ ] Other walls and the other gym are untouched (tested).
- [ ] All metric functions return identical results before and after a reset on a fixture dataset (tested; stub metrics now if Phase 4 is not built, and keep the test).
- [ ] Undo restores every status and removes the new set (tested).
- [ ] Default date is the most recent configured set day on or before today, in Melbourne time (tested across a week boundary).
- [ ] Projects from an expired set no longer appear in the Log climb projects list (e2e).
