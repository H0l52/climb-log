# Decision log

Newest entries at the bottom. The newest entry on a topic wins. Add a dated line for every new decision or dependency.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-14 | iPhone home-screen web app (PWA), not native | No App Store, works offline, one codebase |
| 2 | 2026-11-14 | Log per climb: colour, wall, tries, result | Needed for flash rate, projects and reset tracking |
| 3 | 2026-11-14 | Data on device only; manual export/import | No account or server to run |
| 4 | 2026-11-14 | Extras in scope: reset tracking, photos, goals & streaks, Kilter/spray board log | Owner's choice |
| 5 | 2026-11-14 | Eight colour bands in order: yellow, blue, purple, green, orange, red, black, white | Orange is now a fixed band between green and red, no longer a wildcard (confirmed by owner) |
| 6 | 2026-11-14 | Collingwood walls, all active: Ding Dong, Nugget, Slab City, Bowie, Roofio, Atelier, Star Factory, Wolverine, The 86, The Lab | Confirmed by owner; Star Factory from site photos |
| 7 | 2026-11-14 | Hosting: GitHub Pages at `h0l52.github.io/climb-log`, deployed by GitHub Actions | Owner's choice |
| 8 | 2026-11-14 | Second gym: Blackburn, boulders only | Owner climbs there occasionally; ropes/speed out of v1 |
| 9 | 2026-11-14 | Wall names are data-driven: seed on first launch, then add/rename/retire/merge in-app, including from the wall picker while logging | Blackburn wall list is incomplete and the owner cannot check soon |
| 10 | 2026-11-14 | Resets are entered manually (one tap) in v1 | No public reset feed confirmed; revisit in Phase 6 spike |
| 11 | 2026-11-14 | Stack: Vite, React, TypeScript, Dexie, vite-plugin-pwa, Vitest, Playwright; hash routing | Static output, standard local-first tooling, Pages has no SPA rewrites |
| 12 | 2026-11-14 | Boulder stats pool both gyms by default, with a per-gym filter | Same colour system assumed at both |
| 13 | 2026-11-14 | Build with Claude Code, one phase per session and PR, gated by `/phase-check` | Context persists in the repo; criteria are verified by running things |

## Assumptions still to confirm (non-blocking)

- Blackburn boulders use exactly the same eight colours.
- Blackburn has more boulder walls than Baw Baw and Station Street Woody.
- Collingwood set days are Thursday and Friday; Blackburn boulders Monday and Tuesday.
- The approximate V grades in the seed are community estimates and are display-only.
