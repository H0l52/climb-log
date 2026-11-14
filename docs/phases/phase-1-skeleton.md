# Phase 1 — Skeleton and storage

Goal: an installable, offline app shell on GitHub Pages with the database, seed data and a Settings editor for gyms, walls and grade bands.

Skills: `pwa-ios`, `data-model`, `ui-design`.
Read: `docs/data-model.md`, `docs/ui-spec.md` (Navigation, Settings, States).

## Tasks

1. Scaffold Vite + React + TypeScript (strict) at the repo root. Add ESLint, Vitest, Playwright (iPhone viewport project). Create the npm scripts named in `CLAUDE.md`.
2. Set `base: '/climb-log/'`. Add hash routing and the five-tab shell with placeholder screens.
3. Implement the Dexie schema v1 and typed repositories in `src/db/`.
4. Implement first-launch seeding from `src/data/seed.json` per the Seeding rules.
5. Build Settings: gyms (with set days), walls (add, rename, retire, merge), grade bands (rename, recolour, reorder, add, retire).
6. Add vite-plugin-pwa: manifest, icons (generate a simple original icon), precache, update banner. Request persistent storage and show the result in Settings.
7. Move `docs/templates/deploy.yml` to `.github/workflows/deploy.yml`. Check the action versions are current. Confirm the first deploy succeeds.
8. Add the "no hard-coded names" test: fails if any wall or gym name from the seed appears in `src/` outside `src/data/` and test fixtures.

## Out of scope

Sessions, logging, resets UI, charts, photos, export.

## Success criteria

- [ ] `npm run lint`, `npm test` and `npm run build` pass locally and in CI.
- [ ] A push to `main` publishes to `https://h0l52.github.io/climb-log/` with no manual step; a failing test blocks the deploy.
- [ ] Fresh database shows 2 gyms, 8 grade bands in order (orange between green and red), 12 Collingwood walls (10 boulder + 2 board) and 3 Blackburn walls (2 boulder + 1 board), all read from `seed.json`.
- [ ] Seeding runs once: reloading does not duplicate rows or undo edits (tested).
- [ ] A wall can be added, renamed, retired and merged; a renamed or merged wall keeps its wall sets (tested).
- [ ] Grade bands can be reordered and the new order persists (tested).
- [ ] The "no hard-coded names" test exists and passes.
- [ ] All asset and route URLs work under `/climb-log/` (e2e against `vite preview`).
- [ ] Needs human: installs to the iPhone home screen and opens full-screen.
- [ ] Needs human: opens in airplane mode after one online visit.
- [ ] Needs human: after a new deploy, the update banner appears and reloading shows the new version.
