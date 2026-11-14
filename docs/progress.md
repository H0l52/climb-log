# Progress

Claude Code updates this at the end of every phase. Keep it short.

| Phase | Status | PR | Checked | Notes |
|---|---|---|---|---|
| 0 Gym check (human) | Collingwood confirmed; Blackburn deferred | – | – | Not blocking |
| 1 Skeleton & storage | Awaiting human checks | `phase-1` | 2026-11-14 | lint, 51 unit, 9 e2e, build pass locally; CI on PR; first deploy after merge |
| 2 Sessions & logging | Awaiting human checks | `phase-2` | 2026-11-14 | lint, 89 unit, 22 e2e, build pass locally; tap budgets asserted in `e2e/logging.spec.ts` |
| 3 Reset tracking | Awaiting human checks | `phase-3` | 2026-11-14 | lint, 130 unit, 28 e2e, build pass locally; all 6 criteria pass with automated evidence |
| 4 Progress, goals, streaks | Not started | | | |
| 5 Photos, board log, backup | Not started | | | |
| 6 Polish & spikes | Not started | | | |

Status values: Not started · In progress · Awaiting human checks · Done.

## Needs human check

Criteria only the owner can verify on the iPhone. Add items here; the owner ticks them.

**Phase 1**

- [x] **First deploy.** Repo → Settings → Pages → Source is "GitHub Actions". Merge the Phase 1 PR. Actions → "Deploy to GitHub Pages" on `main` is green (build then deploy), and `https://h0l52.github.io/climb-log/` shows the Today screen.
- [x] **Install.** On the iPhone, open `https://h0l52.github.io/climb-log/` in Safari → Share → Add to Home Screen → Add. The icon is three white bars on dark slate, labelled "Climb Log". Open it: no Safari address bar or toolbar; the tab bar sits above the home indicator.
- [x] **Offline.** After opening the installed app once online, close it fully (swipe up), turn on Airplane Mode, open it again. Today, Walls, Progress, Goals and More → Settings all load; Settings lists the walls and colours.
- [x] **Update banner.** With the installed app closed, merge any change to `main` and wait for the deploy. Open the app (you may need to close and reopen it once): a "New version ready · Reload to update" bar appears above the tab bar. Tap "Reload to update": the app reloads and More → Settings → About shows the new build date.
- [x] **Tab bar on launch.** Close the installed app fully (swipe up in the app switcher), open it from the Home Screen. On Today, before scrolling or opening Settings, the tab bar sits directly above the home indicator with no gap below it. Repeat on Walls, Progress and Goals.
- [x] **Storage.** More → Settings → Storage shows "Persistent storage: Granted" in the installed app (it may say "Not granted" in Safari tabs).

**Phase 2**

- [x] **Ten-second log.** At the wall, phone in one hand, open the app on Today. Start a stopwatch, then: tap "Log climb", tap a colour, tap "Flash". You should be back on Today with the climb at the top of the list and an Undo bar, in under 10 seconds, without changing grip or using the other hand. Repeat once choosing a different wall first.
- [x] **Force-quit mid-session.** Log three climbs, leaving the session open. Swipe the app away in the app switcher, then open it from the Home Screen. Today shows the same session still running (timer continuing from the original start), the same three entries and the same tally. Log a fourth climb: it joins the same session.
- [x] **Swipe to delete.** On Today with an open session, swipe an entry left past about a third of the screen and let go. It disappears and "Entry deleted · Undo" shows; tap Undo and it returns in the same place. (Swipe has no automated test; the Delete button path does.)
- [x] **New wall keyboard.** On Log climb tap "+ New wall": the keyboard opens on the name field without a second tap and the page does not zoom.

**Phase 3**

- [x] **Reset date wheel.** Walls → any wall → "Mark as reset". The date field shows the gym's last set day (or the day the current set went up, if later). Tap it: the iOS date wheel opens. Pick tomorrow: the sheet shows "A reset cannot be in the future" and "Mark as reset" is disabled. Pick the default again and tap "Mark as reset": the toast "<wall> reset · <date>" appears with Undo, and "Current set" is empty.
- [x] **Undo after reload.** Right after a reset, close the app fully and reopen it. Open the same wall: "Reset <date> · Undo reset" is still shown. Tap it: the wall's projects are back and "Past sets" is gone. Then reset again, end the session on Today, and reopen the wall: the Undo line is gone.
- [x] **Today strip.** On Today, the strip under the gym chips lists that gym's walls, freshest first, each with "N days" and "Fresh" for walls set in the last 7 days. It scrolls sideways with one thumb and each tile opens the wall.

## Follow-ups

Things noticed but out of scope for the current phase.

- One-time "Share → Add to Home Screen" explainer when not standalone (ui-spec States; pwa-ios skill). Not in the Phase 1 task list.
- e2e runs on Chromium with an iPhone viewport; consider a WebKit project in CI for Safari-specific bugs.
- Re-check `npm audit` once `vite-plugin-pwa` / `workbox-build` update their transitive deps (decision 16).
- Today: streak (Phase 4) is in ui-spec but not built yet.
- Repeats of a sent problem are supported by the domain and storage but have no UI entry point (Log climb lists projects only).
- Entries can only be edited while their session is open; there is no session history screen yet.
- Problem nickname, style tags, felt and note can be set when logging but not edited afterwards.
- Undoing the climb that auto-started a session leaves that (empty) session open.
- Wall detail links to Settings for rename, retire and merge rather than offering them inline (decision 37).
- Retired and merged walls have no entry point in the Walls list; their history is only reachable by direct link.
- `src/domain/metrics.ts` holds Phase 3 stubs; Phase 4 completes it and must keep `METRICS` complete so the reset test covers every metric.
