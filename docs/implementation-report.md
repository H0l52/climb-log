# Urban Climb Collingwood Progress Tracker — Implementation Report

*Prepared 14 November 2026. Personal, single-user app.*

## 1. Summary

Build an installable, offline-first web app (PWA) for iPhone that logs every boulder problem you try at Urban Climb Collingwood by **colour grade** and **wall**, retires climbs automatically when a wall is reset, and charts progress over time. Data stays on the phone, with manual export for backup. Extras in scope: reset tracking, photos of climbs, goals and streaks, and a separate Kilter board log.

Decisions you confirmed:

| Decision | Choice |
|---|---|
| Platform | iPhone home-screen web app |
| Logging detail | Per climb (colour, wall, attempts, flash/send/project) |
| Data | On device only, with export/import |
| Extras | Reset tracking, photos, goals & streaks, Kilter board log |
| Hosting | GitHub Pages |
| Gyms | Collingwood (primary) and Blackburn (boulders only for now) |
| Wall names | Data, not code: added, renamed or retired in the app |

## 2. Research findings: the gym

### 2.1 Grading system

Urban Climb uses its own colour bands instead of V grades. The colour of the problem is the grade.

| Order | Colour | Approx. V grade (community estimate) | Notes |
|---|---|---|---|
| 1 | Yellow | VB | Beginner |
| 2 | Blue | V0 | |
| 3 | Purple | V1 | |
| 4 | Green | V2 | |
| 5 | Orange | ~V3 (interpolated) | Formerly a wildcard; now a fixed band between green and red (confirmed by you) |
| 6 | Red | V4 | |
| 7 | Black | V6 | |
| 8 | White | V8+ | Elite |

Caveats that shape the design:

- The V-grade column comes from community logbook listings (theCrag / Outdooractive), not Urban Climb. Treat it as a rough guide only.
- Each colour covers a wide difficulty range, and reviewers complain about the spread within a colour. The app therefore records an optional personal "felt difficulty" (easy / fair / hard for the colour) per climb.
- A 2018 interview said the gym is laid out so the same colour gets harder as you move clockwise from the entrance. Unverified for 2026; not modelled, but per-wall stats will reveal it if true.
- Colours and their order must be **editable in settings**, since the gym has changed the system before (orange has been a wildcard, level with green, and now sits above it).
- Older community listings still show orange at V2; ignore them.

### 2.2 Wall / area names

| Area | Evidence | Seed status |
|---|---|---|
| Ding Dong | Current reset schedule | Active |
| Nugget | Current reset schedule | Active |
| Slab City | Current reset schedule + site photos | Active |
| Bowie | Current reset schedule | Active |
| Roofio | Current reset schedule + site photos | Active |
| Atelier | Current reset schedule (setter test / creative wall) | Active |
| Star Factory | Site photo caption + community listings; not in the Nov schedule window | Active, confirm |
| Wolverine | Community listings; confirmed by you | Active |
| The 86 | Community listings; confirmed by you | Active |
| The Lab | Community listings; confirmed by you | Active |
| Kilter Board | Site facilities list | Separate log |
| Spray Wall | Site facilities list | Separate log |

Wolverine, The 86 and The Lab did not appear in the November reset schedule, so their reset rhythm is unknown; you mark their resets manually like any other wall.

### 2.3 Reset schedule

- Sets currently happen on **Thursdays and Fridays** (the site notes a change to set days from 1 November 2026).
- Published schedule at time of writing: Atelier 29 Oct · Ding Dong 5–6 Nov · Nugget 12–13 Nov · Slab City + Bowie 19–20 Nov · Roofio 26–27 Nov.
- That pattern suggests each wall turns over roughly every 4–6 weeks (my inference from one schedule window, not a published figure).
- The schedule is rendered by script on the Urban Climb website; a plain page fetch returned no schedule data, so no public feed is confirmed. v1 uses **manual reset entry**; automated import is a later spike (Phase 6).

### 2.4 Blackburn (second gym)

You boulder only at Blackburn for now, so ropes, auto-belay and the speed wall are **out of scope for v1** (rope areas there are Thunderdome, The Shire and The Monolith, noted for later).

| Area | Type | Evidence | Seed status |
|---|---|---|---|
| Baw Baw | Boulder | Current reset schedule | Active |
| Station Street Woody | Boulder | Current reset schedule | Active |
| Spray Wall | Board | Site facilities | Separate log |

- **Set days:** boulders on Mondays and Tuesdays (November 2026 schedule).
- **Boulder grades:** assumed to be the same eight colours as Collingwood; editable if not.
- The boulder hall probably has more named walls than these two. That does not block anything: see §2.5.

### 2.5 Wall names are data-driven

No wall name is hard-coded. Walls are rows in the on-device database, and the names above are only a starting seed file (`seed.json`).

- **Add at the wall:** the wall picker on the Log climb screen ends with "+ New wall". Type the name and it is created for the current gym and selected, without leaving the logging flow.
- **Rename:** changes the label everywhere; history stays attached because climbs reference the wall's ID, not its name.
- **Retire:** hides a wall from pickers but keeps its history and stats.
- **Merge:** if you log under a placeholder (e.g. "Blackburn – back wall") and later learn the real name, rename it, or merge two walls into one.
- **Seed updates never overwrite your edits:** the seed only runs on first launch.

So your next Blackburn visit needs no preparation and no code change.

## 3. Research findings: how to build it

### 3.1 Why build rather than use an existing app

TopLogger, KAYA and Griptonite work best when the gym itself publishes its routes in them; I found no evidence Urban Climb does. Generic loggers (Redpoint, etc.) assume V grades and do not model colour bands, named walls or resets. A personal app can be built around exactly those three things.

### 3.2 Recommended architecture

Local-first PWA: a service worker caches the app shell, IndexedDB holds all data, and there is no backend.

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript | Fast, standard, static output |
| UI | React | Largest ecosystem; any equivalent is fine |
| Storage | IndexedDB via Dexie.js | De-facto standard wrapper; reactive queries; schema versioning |
| Offline | vite-plugin-pwa (Workbox) | Generates service worker + manifest |
| Charts | Lightweight SVG chart library (e.g. Recharts) | Small data volumes; touch-friendly |
| Photos | Compressed JPEG blobs in IndexedDB | No server; keep each under ~300 KB |
| Hosting | GitHub Pages, deployed by GitHub Actions | Free static HTTPS; service workers require HTTPS |
| Tests | Vitest (logic) + Playwright (mobile viewport flows) | |

### 3.3 iPhone-specific risks

| Risk | Mitigation |
|---|---|
| Safari can evict site storage after 7 days of non-use | Install to home screen (installed web apps are exempt), call `navigator.storage.persist()`, and nag for a backup export every 30 days |
| No reliable web push on iOS | No feature depends on notifications; reset reminders show in-app |
| Storage quota with photos | Downscale to max 1280 px, JPEG quality ~0.7; show storage used in settings; purge photos of retired climbs after N days (configurable) |
| Losing the phone = losing data | One-tap export to Files / iCloud Drive as a single JSON (+ photos zip) |

### 3.4 GitHub Pages setup

Assumes a project site at `https://h0l52.github.io/<repo>/` (repo name below: `climb-log`).

| Item | Setting |
|---|---|
| Repo | `H0l52/climb-log`; public (Pages on private repos needs a paid plan). No personal data is in the repo; logs live only on the phone |
| Pages source | Settings → Pages → Source: **GitHub Actions** |
| Vite | `base: '/climb-log/'` |
| Manifest | `start_url` and `scope` set to `/climb-log/`; icons referenced relative to base |
| Service worker | Registered with scope `/climb-log/`; update prompt on new deploy |
| Routing | Hash routes (`/#/progress`) so deep links survive Pages' lack of SPA rewrites |
| Workflow | `.github/workflows/deploy.yml`: on push to `main` → install → test → build → `actions/upload-pages-artifact` → `actions/deploy-pages` |

One caution: on-device data is tied to the site address. If the repo is renamed or moved to a custom domain later, the app at the new address starts empty, so export first and import after.

## 4. Data model

```
Gym         id, name (Collingwood | Blackburn), active
GradeSystem id, name (UC colours | V grades)      // room for rope grades later
GradeBand   id, gradeSystemId, name, hex?, order, approxV?, active
Wall        id, gymId, name, kind (boulder | board),
            gradeSystemId, styleTags[], active, mergedIntoId?
WallSet     id, wallId, setDate, retiredDate?          // one per reset
Problem     id, wallSetId, gradeBandId, nickname?, photoId?,
            styleTags[] (slab, overhang, roof, dyno, crimp, sloper, comp...)
            status (untried | project | sent | expired)
Session     id, gymId, date, startedAt, endedAt?, notes?, energy (1-5)?
Attempt     id, problemId, sessionId, tries, result (flash | send | fail),
            felt (easy | fair | hard)?, notes?
BoardLog    id, sessionId, board (kilter | spray), climbName?, angle?,
            vGrade?, tries, result
Goal        id, type (first-send-of-colour | sessions-per-week |
            sends-per-colour | flash-rate), target, deadline?, achievedAt?
Photo       id, blob, createdAt
Settings    backupLastAt, photoRetentionDays, ...
```

Key rules:

- Gym problems have no public IDs, so a problem's identity is **wall + set + colour + your nickname/photo**.
- Marking a wall as reset closes its current `WallSet`; every unsent problem in it becomes `expired`, sent ones are archived. History is never deleted.
- A **flash** is a send with `tries = 1` on the problem's first-ever attempt.
- A session belongs to one gym; the Today screen remembers the last gym and offers a one-tap switch.
- Boulder stats pool both gyms by default (same colour system) with a per-gym filter.
- Everything references walls by ID, so renaming, retiring or merging a wall never breaks history (§2.5).

Core metrics:

- Flash rate per colour: $F_c = \dfrac{\text{flashes}_c}{\text{sends}_c}$
- Send rate per colour: $S_c = \dfrac{\text{problems sent}_c}{\text{problems attempted}_c}$
- Session score: $\text{score} = \sum_{\text{sends}} w_{c}$, with $w_c = 2^{\,\text{order}(c)-1}$ (yellow 1, blue 2, purple 4, green 8, orange 16, red 32, black 64, white 128); boulders only
- Working grade: the highest colour with $S_c \ge 0.5$ over the trailing 6 weeks

## 5. Screens

1. **Today** — start/end session, big "Log climb" button, current-session list, days since each wall was reset.
2. **Log climb** — tap wall → tap colour → tries stepper → result. Optional: photo, nickname, style tags, felt difficulty. Existing projects on that wall appear first for one-tap re-logging.
3. **Walls** — each wall with set date, your sent/project counts per colour, "Mark as reset" action.
4. **Progress** — sends per colour per week (stacked bars), grade pyramid, flash rate trend, style breakdown, session score trend.
5. **Goals** — active goals, weekly streak, achievements timeline (e.g. first red).
6. **Board** — Kilter / spray wall log with V grade and angle.
7. **Settings** — edit colours and walls, export/import, storage usage.

## 6. Implementation phases

Each phase lists actions and the criteria that mark it done.

### Phase 0 — Verify at the gym (1 visit, no code)

**Actions**
- Collingwood: colour order and wall names are already confirmed. Only note any wall missing from §2.2.
- Confirm Collingwood set days at the desk and whether the site schedule is the source of truth.
- Blackburn needs no advance visit: add or rename walls in the app whenever you are next there, and check the colours match.

**Success criteria**
- [ ] Collingwood seed data matches the floor.
- [ ] Nothing in Phases 1–5 is blocked on Blackburn information.

### Phase 1 — Skeleton and storage

**Actions**
- Scaffold Vite + React + TypeScript; add Dexie schema v1 from §4.
- Seed both gyms, grade systems, grade bands and walls; build Settings editor for them.
- Add PWA manifest, icons, service worker.
- Create the `climb-log` repo, add the deploy workflow and enable Pages per §3.4.

**Success criteria**
- [ ] A push to `main` publishes to `https://h0l52.github.io/climb-log/` with no manual steps, and a failing test blocks the deploy.
- [ ] App installs to the iPhone home screen from that address and launches full-screen.
- [ ] Loads fully in airplane mode after first visit; a new deploy shows an update prompt.
- [ ] Seed shows 8 colours in order (orange between green and red), 10 Collingwood and 2 Blackburn boulder walls (plus board walls), all loaded from `seed.json`; edits persist across app restarts.
- [ ] No wall name appears anywhere in application code (checked by a test that greps the source).
- [ ] A wall can be added, renamed, retired and merged in Settings; a renamed wall keeps all its history (tested).
- [ ] `navigator.storage.persist()` requested and its result shown in Settings.

### Phase 2 — Sessions and per-climb logging

**Actions**
- Build Today and Log climb screens; session start/stop.
- Implement problem creation, re-logging of projects, flash detection.
- Unit-test status transitions (untried → project → sent).

**Success criteria**
- [ ] A new climb logs in **≤ 4 taps and under 10 seconds** one-handed.
- [ ] Re-logging an existing project takes ≤ 2 taps.
- [ ] Flash is recorded only when the first-ever attempt has `tries = 1` and succeeds (covered by tests).
- [ ] Switching gym changes the wall list.
- [ ] A brand-new wall can be created from the wall picker and a climb logged on it in ≤ 6 taps plus typing the name.
- [ ] 50 climbs logged across 3 test sessions with zero data loss after force-quit.

### Phase 3 — Reset tracking

**Actions**
- Build Walls screen with "Mark as reset" (date defaults to the most recent Thursday/Friday).
- Implement WallSet rollover and `expired` status.
- Show "days since set" and a "fresh set" badge for 7 days.

**Success criteria**
- [ ] Marking a reset expires all unsent problems on that wall and leaves other walls untouched (tested).
- [ ] Historical stats are unchanged before vs. after a reset (tested).
- [ ] A reset can be undone within the same session.

### Phase 4 — Progress, goals and streaks

**Actions**
- Implement metrics in §4 as pure, tested functions.
- Build Progress charts and Goals screen; weekly streak logic (week starts Monday, Melbourne time).

**Success criteria**
- [ ] Metric functions match hand-calculated values on a fixture dataset (100% of fixture cases).
- [ ] Progress screen renders in under 1 s with 2 years of synthetic data (~3,000 attempts).
- [ ] A "first send of colour" goal auto-completes when the matching send is logged.
- [ ] Charts are readable at 390 px width with colour plus label (not colour alone).

### Phase 5 — Photos, Kilter log, backup

**Actions**
- Camera capture → downscale → store blob; thumbnail in problem lists.
- Board screen and BoardLog storage.
- Export (JSON + photos zip) and import with schema-version check; backup reminder.

**Success criteria**
- [ ] Stored photo ≤ 300 KB on average; 200 photos use < 60 MB.
- [ ] Export → wipe → import restores an identical database (automated deep-equal test).
- [ ] Backup reminder appears when the last export is > 30 days old.
- [ ] Kilter sessions appear in session history but are excluded from colour-grade stats.

### Phase 6 — Polish and optional spikes

**Actions**
- Two weeks of real use; fix friction points.
- Spike (time-boxed, 2 hours): inspect the Urban Climb site's network calls for a reset data source; only build import if one exists and its use is permitted.
- Accessibility pass: touch targets ≥ 44 pt, contrast, dark mode for dim gym lighting.

**Success criteria**
- [ ] 6 consecutive real sessions logged with no missed climbs and no data bugs.
- [ ] Spike ends with a written go / no-go.
- [ ] Lighthouse: PWA installable, performance ≥ 90 on mobile.

## 7. Overall definition of done

- Every climb of a session can be logged at the wall, offline, faster than writing a note.
- Opening Progress answers three questions at a glance: *What is my working grade? Is my flash rate improving? Which wall styles am I weakest on?*
- A wall reset takes one tap and never corrupts history.
- A full backup can be made and restored without a computer.

## 8. Skills and tools needed

**Technical skills**
- TypeScript + React fundamentals
- IndexedDB with Dexie (schema versioning, live queries, blobs)
- PWA plumbing: manifest, service worker caching, iOS install behaviour
- Canvas-based image downscaling
- Date handling in a fixed timezone (Australia/Melbourne) for weeks and streaks
- Chart design for small screens

**Project skills for the Claude Code build** (in `.claude/skills/`)
- `ui-design` — one-handed phone layout, tap budgets, grade chips, theme
- `charts` — chart forms, grade colours as data colours, metric edge cases
- `data-model` — invariants, migrations, storage checks
- `pwa-ios` — base path, manifest, service worker, iPhone storage and camera quirks
- `phase-check` — manual phase sign-off against success criteria (`/phase-check N`)

The build is run with Claude Code, one phase per session; see `README.md`, `CLAUDE.md` and `docs/phases/`. Where a phase brief and this report differ, the phase brief wins.

## 9. Open questions

Resolved: orange sits between green and red; Wolverine, The 86 and The Lab are active; hosting is GitHub Pages; Blackburn is in scope.

Still open:

Also resolved: Blackburn is boulders only for now; wall names are data-driven; repo is `H0l52/climb-log`.

Still open (none blocking):

1. Remaining Blackburn boulder wall names, added in-app on your next visit.
2. Whether Blackburn boulders use exactly the same eight colours.
3. Rope logging, if you start roping at Blackburn (the grade-system table already leaves room for it).

## 10. Sources

- [Urban Climb — Collingwood location page](https://urbanclimb.com.au/locations/collingwood/) (reset schedule, facilities, set-day change)
- [Urban Climb — Blackburn location page](https://urbanclimb.com.au/locations/blackburn/) (reset schedule, facilities)
- [theCrag — Urban Climb Blackburn](https://www.thecrag.com/en/climbing/australia/inner-melbourne/area/6608997369) (rope area names)
- [The Urban List — Meet The Crew Behind Melbourne's Biggest Bouldering Gym](https://www.theurbanlist.com/melbourne/a-list/urban-climb-melbourne) (colour order, orange wildcard, layout)
- [Outdooractive — Urban Climb Collingwood](https://www.outdooractive.com/en/climbingspot/gym-area/urban-climb-collingwood/227336850/) (area list, approximate V grades)
- [theCrag — Urban Climb Collingwood](https://www.thecrag.com/en/climbing/australia/inner-melbourne/area/1590845562) (area list)
- [Man of Many — Best Bouldering Gyms in Melbourne](https://manofmany.com/entertainment/sport/best-rock-climbing-bouldering-melbourne) (Kilter board, spray wall, atelier)
- [Dexie.js](https://dexie.org/) (storage layer)
- [PWA & Offline-First Sync Engines 2026](https://www.youngju.dev/blog/culture/2026-05-16-pwa-offline-first-sync-2026-workbox-replicache-rxdb-yjs-automerge-livestore-electric-zero-ground-deep-dive.en) (iOS 7-day eviction)
- [Building an Offline-First Web App with IndexedDB](https://stevenpg.com/posts/offline-first-web-app-indexeddb/) (home-screen exemption)
- [BMC — Indoor climbing grades explained](https://thebmc.co.uk/en/indoor-climbing-grades-explained) (circuit grading)
