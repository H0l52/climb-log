# Progress

Claude Code updates this at the end of every phase. Keep it short.

| Phase | Status | PR | Checked | Notes |
|---|---|---|---|---|
| 0 Gym check (human) | Collingwood confirmed; Blackburn deferred | – | – | Not blocking |
| 1 Skeleton & storage | Awaiting human checks | `phase-1` | 2026-11-14 | lint, 51 unit, 9 e2e, build pass locally; CI on PR; first deploy after merge |
| 2 Sessions & logging | Not started | | | |
| 3 Reset tracking | Not started | | | |
| 4 Progress, goals, streaks | Not started | | | |
| 5 Photos, board log, backup | Not started | | | |
| 6 Polish & spikes | Not started | | | |

Status values: Not started · In progress · Awaiting human checks · Done.

## Needs human check

Criteria only the owner can verify on the iPhone. Add items here; the owner ticks them.

**Phase 1**

- [ ] **First deploy.** Repo → Settings → Pages → Source is "GitHub Actions". Merge the Phase 1 PR. Actions → "Deploy to GitHub Pages" on `main` is green (build then deploy), and `https://h0l52.github.io/climb-log/` shows the Today screen.
- [ ] **Install.** On the iPhone, open `https://h0l52.github.io/climb-log/` in Safari → Share → Add to Home Screen → Add. The icon is three white bars on dark slate, labelled "Climb Log". Open it: no Safari address bar or toolbar; the tab bar sits above the home indicator.
- [ ] **Offline.** After opening the installed app once online, close it fully (swipe up), turn on Airplane Mode, open it again. Today, Walls, Progress, Goals and More → Settings all load; Settings lists the walls and colours.
- [ ] **Update banner.** With the installed app closed, merge any change to `main` and wait for the deploy. Open the app (you may need to close and reopen it once): a "New version ready · Reload to update" bar appears above the tab bar. Tap "Reload to update": the app reloads and More → Settings → About shows the new build date.
- [ ] **Storage.** More → Settings → Storage shows "Persistent storage: Granted" in the installed app (it may say "Not granted" in Safari tabs).

## Follow-ups

Things noticed but out of scope for the current phase.

- One-time "Share → Add to Home Screen" explainer when not standalone (ui-spec States; pwa-ios skill). Not in the Phase 1 task list.
- Gyms have no order field; lists sort by name, so the first-launch default gym is Blackburn until another is picked (`lastGymId`). Decide when Today's gym switcher lands in Phase 2.
- e2e runs on Chromium with an iPhone viewport; consider a WebKit project in CI for Safari-specific bugs.
- Re-check `npm audit` once `vite-plugin-pwa` / `workbox-build` update their transitive deps (decision 16).
