# Phase 2 — Sessions and per-climb logging

Goal: log every climb of a session at the wall, fast.

Skills: `ui-design`, `data-model`.
Read: `docs/ui-spec.md` (Today, Log climb), `docs/data-model.md` (Problems and attempts, Sessions).

## Tasks

1. Domain functions (pure, tested): create problem + first attempt, add attempt to project, flash eligibility, status transition, tries-to-send, session auto-close.
2. Today screen: gym switcher, start/end session, running tally, entry list with edit and delete-with-undo.
3. Log climb screen exactly as specified, including the projects list and inline "+ New wall".
4. Remember last gym and most-recently-used wall order.
5. E2e tests for the four flows in the tap-budget table, asserting the tap counts.

## Out of scope

Reset action, charts, goals, photos (leave the optional photo slot hidden), board log.

## Success criteria

- [ ] Tap budgets in `docs/ui-spec.md` are met, asserted by e2e tests.
- [ ] Flash can only be recorded on a problem's first entry with `tries = 1` (unit tested, including rejection).
- [ ] A sent problem never returns to `project`; repeats do not add sends (tested).
- [ ] Logging with no open session starts one for the current gym; switching gym changes the wall list (tested).
- [ ] A new wall created from the picker is saved to the current gym and is selectable afterwards (tested).
- [ ] Deleting an entry and tapping Undo restores it exactly (tested).
- [ ] 50 climbs across 3 sessions survive a reload with identical counts (e2e).
- [ ] Needs human: a new climb can be logged one-handed in under 10 seconds.
- [ ] Needs human: force-quitting mid-session loses nothing.
