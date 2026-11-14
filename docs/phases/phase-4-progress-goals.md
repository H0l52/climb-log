# Phase 4 — Progress, goals and streaks

Goal: opening Progress answers three questions at a glance: what is my working grade, is my flash rate improving, and where am I weakest.

Skills: `charts`, `ui-design`, `data-model`.
Read: `docs/data-model.md` (Metrics), `docs/ui-spec.md` (Progress, Goals).

## Tasks

1. Implement every metric in `src/domain/metrics.ts` as pure functions.
2. Build a fixture dataset with hand-calculated expected values (`src/domain/__fixtures__/`), including edge cases: zero sends, a reset mid-range, a week with no sessions, two gyms.
3. Build a synthetic-data generator for performance tests (2 years, about 3,000 attempts).
4. Progress screen with filters, headline tiles and the five charts.
5. Goals: create, progress, auto-complete; weekly streak; automatic "first send of colour" achievements.

## Out of scope

Board-log statistics, sharing or exporting charts.

## Success criteria

- [ ] Every metric matches the hand-calculated fixture values (100% of cases).
- [ ] Undefined rates display "–", never `NaN`, `Infinity` or 0% (tested).
- [ ] Weeks start Monday in Melbourne time; streak logic is tested across a daylight-saving change and a year boundary.
- [ ] Progress renders in under 1 second with the synthetic dataset (measured in e2e on the iPhone viewport profile).
- [ ] A "first send of colour" goal completes at the moment the matching send is logged (tested).
- [ ] Every chart follows the `charts` skill checklist: readable at 390 px, colour never the only signal, white and black bands visible on the background.
- [ ] Gym and range filters change every tile and chart consistently (e2e).
