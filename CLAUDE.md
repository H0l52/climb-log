# climb-log

Personal, single-user bouldering progress tracker for Urban Climb Collingwood and Blackburn. Offline-first PWA installed on an iPhone home screen. No backend, no accounts. Deployed to `https://h0l52.github.io/climb-log/`.

## Stack

- Vite + React + TypeScript (strict)
- Dexie.js over IndexedDB (all user data)
- vite-plugin-pwa (service worker + manifest)
- Hash routing
- Vitest (unit) + Playwright (mobile viewport e2e)
- npm

## Commands

Phase 1 creates these scripts; keep the names stable.

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint + `tsc --noEmit` |
| `npm test` | Vitest, single run |
| `npm run e2e` | Playwright, iPhone viewport |
| `npm run build` | Production build to `dist/` |

## Layout

```
src/data/seed.json     gyms, grade bands, walls (first-launch seed only)
src/db/                Dexie schema, migrations, repositories
src/domain/            pure logic: status transitions, resets, metrics, streaks
src/features/<name>/   screens and components per feature
src/ui/                shared components, tokens
docs/                  plan, decisions, data model, UI spec, phase briefs
```

## Hard rules

1. **Wall names are data.** No wall or gym name may appear in application code or tests outside `src/data/seed.json` and fixtures. Walls are referenced by ID everywhere.
2. **Grade colours and order are data.** Read from the database, never hard-code the list of eight.
3. **History is never deleted.** Resets, retirements and merges archive; they do not remove attempts.
4. **Domain logic is pure and tested.** Anything in `src/domain/` has no React, no Dexie, and has unit tests.
5. **Schema changes are additive** and bump the Dexie version with a migration. See the `data-model` skill.
6. **No backend, analytics, trackers or remote fonts.** The app must work fully offline after first load.
7. **Everything respects the base path** `/climb-log/`. No absolute `/` URLs.
8. **Dates:** calendar dates are `YYYY-MM-DD` in Australia/Melbourne; weeks start Monday.
9. **New dependencies** need a one-line justification in `docs/decisions.md`.
10. **Rope, auto-belay and speed logging are out of scope** for v1.

## Skill routing

Load the skill **before** starting the matching work.

| Before you… | Load |
|---|---|
| Build or restyle any screen or component | `ui-design` |
| Build any chart, stat tile or metric display | `charts` |
| Touch the schema, types, seed, export or import | `data-model` |
| Touch the manifest, service worker, install flow, camera or storage persistence | `pwa-ios` |
| Finish a phase | run `/phase-check <n>` |

## Workflow

- One phase per branch (`phase-N`) and one pull request per phase.
- Read the phase brief in `docs/phases/` first. Build only what it lists; note anything else as a follow-up in `docs/progress.md`.
- Commit in small, working steps. Tests and lint pass on every commit.
- At the end: run `/phase-check <n>`, update `docs/progress.md`, open the PR with the check table in the description.
- If documents disagree: `docs/decisions.md` (newest entry) > phase brief > `docs/data-model.md` > `docs/ui-spec.md` > `docs/implementation-report.md`. Fix the stale one in the same PR.
- If something is ambiguous and cheap to change later, choose, record it in `docs/decisions.md`, and continue. Ask only for choices that are hard to undo.
