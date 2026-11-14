# Phase 6 — Polish and optional spikes

Goal: remove friction found in real use; decide on reset import.

Skills: `ui-design`, `pwa-ios`, others as the fixes require.
Input: the owner's notes from at least two weeks of use (ask for them at the start of the session).

## Tasks

1. Fix the friction points the owner lists, smallest first.
2. Accessibility pass: touch targets ≥ 44 pt, text contrast, reduced motion, VoiceOver labels on colour chips and charts.
3. Lighthouse run on the deployed site; fix regressions.
4. Spike, time-boxed to 2 hours: inspect how the Urban Climb location pages load their "upcoming resets" list. Record what the source is, whether it is reachable from a static site (CORS), and whether using it is permitted by the site's terms. Write the outcome in `docs/decisions.md`. Build nothing unless the answer to all three is yes and the owner agrees.

## Out of scope

Rope logging, cloud sync, multi-user.

## Success criteria

- [ ] Every friction point from the owner's notes is fixed or logged as a follow-up with a reason.
- [ ] Lighthouse on the deployed site: installable PWA, performance ≥ 90 (mobile).
- [ ] No touch target under 44 pt on any screen (automated check in e2e).
- [ ] Spike ends with a written go / no-go in `docs/decisions.md`.
- [ ] Needs human: 6 consecutive real sessions logged with no missed climbs and no data bugs.
