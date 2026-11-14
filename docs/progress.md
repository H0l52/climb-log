# Progress

Claude Code updates this at the end of every phase. Keep it short.

| Phase | Status | PR | Checked | Notes |
|---|---|---|---|---|
| 0 Gym check (human) | Collingwood confirmed; Blackburn deferred | – | – | Not blocking |
| 1 Skeleton & storage | Awaiting human checks | `phase-1` | 2026-11-14 | lint, 51 unit, 9 e2e, build pass locally; CI on PR; first deploy after merge |
| 2 Sessions & logging | Awaiting human checks | `phase-2` | 2026-11-14 | lint, 89 unit, 22 e2e, build pass locally; tap budgets asserted in `e2e/logging.spec.ts` |
| 3 Reset tracking | Awaiting human checks | `phase-3` | 2026-11-14 | lint, 130 unit, 28 e2e, build pass locally; all 6 criteria pass with automated evidence |
| 4 Progress, goals, streaks | Awaiting human checks | `phase-4` | 2026-11-14 | lint, 183 unit, 34 e2e, build pass locally; Progress renders 2,963 entries in ~160 ms (e2e) |
| 5 Photos, board log, backup | Awaiting human checks | `phase-5` | 2026-11-14 | lint, 229 unit, 42 e2e, build pass locally; 10 camera-size photos store at 88 KB avg, thumbs 5 KB |
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

**Phase 4**

- [x] **Charts in the gym.** Open Progress in the installed app, in dim light. With a few weeks logged: every chart fits the screen without sideways scrolling, every label is readable without zooming, and white and black bars in "Sends per colour" and "Grade pyramid" have a visible outline. Repeat with the phone in light mode (Settings → Display & Brightness → Light).
- [x] **Tap readout.** On "Sends per colour", tap an older bar with your thumb: it highlights and the box below shows "Week of <date> · N sends" with colour chips. The value appears below the chart, not under your finger.
- [x] **Goal at the wall.** Goals → "New goal" → "First send" → pick a colour you have not sent → "Add goal". Log a send of that colour on Today. Open Goals: the goal is under "Achieved" with today's date and the colour is at the top of "Achievements". Undo the climb from Today's toast: the goal is back under "Active".
- [x] **Streak.** With no session open, Today shows "N week streak" under the gym chips, matching the "Week streak" tile on Progress (All gyms) and Goals.

**Phase 5**

- [ ] **Camera from the installed app.** Open the app from the Home Screen. Log climb → pick a colour → More detail → "Take photo". The rear camera opens (allow camera access if asked). Take a photo and tap "Use Photo": "Preparing photo…" shows briefly, then a small preview with "Remove photo". Tap "Not yet". Open Log climb again: the project row has the photo thumbnail on the left, the right way up. Tap the thumbnail: the photo fills the screen; "Close" returns. Repeat with "Choose photo" and a photo from the library (an older HEIC photo is a good test).
- [ ] **Backup to Files and back.** More → Settings → Backup. "Include photos" is on. Tap "Export backup", then "Save backup": the share sheet opens. Choose "Save to Files" → On My iPhone → Save. "Last backup" now shows today. Log one more climb. Back in Settings tap "Import backup" → Browse → pick the saved `climb-log-<date>.zip`. The box reads "Replace everything on this phone with the backup from <date>? It has N sessions, M climbs and P photos." Tap "Replace data": "Backup imported" shows, the extra climb is gone from Today, and photos still open from Walls → the wall.
- [ ] **Backup banner.** Not checkable without waiting 31 days; covered by `e2e/backup.spec.ts` with a fake clock. Optional: after 31 days without exporting, Today shows "Last backup 31 days ago" under the wall strip; "Dismiss" hides it for a week.

## Follow-ups

Things noticed but out of scope for the current phase.

- One-time "Share → Add to Home Screen" explainer when not standalone (ui-spec States; pwa-ios skill). Not in the Phase 1 task list.
- e2e runs on Chromium with an iPhone viewport; consider a WebKit project in CI for Safari-specific bugs.
- Re-check `npm audit` once `vite-plugin-pwa` / `workbox-build` update their transitive deps (decision 16).
- Repeats of a sent problem are supported by the domain and storage but have no UI entry point (Log climb lists projects only).
- Entries can only be edited while their session is open; More → Sessions (Phase 5) shows past sessions read-only.
- Problem nickname, style tags, felt and note can be set when logging but not edited afterwards.
- Undoing the climb that auto-started a session leaves that (empty) session open.
- Wall detail links to Settings for rename, retire and merge rather than offering them inline (decision 37).
- Retired and merged walls have no entry point in the Walls list; their history is only reachable by direct link.
- Chart bars are narrower than 44 pt once a range has more than about 8 buckets (13 weeks, 12+ months); a swipe-to-scrub readout could replace per-bar taps.
- Goals can be removed but not edited (target, deadline).
- Progress filters reset when leaving the screen; consider remembering them.
- Style breakdown only has data once walls or climbs carry style tags; wall tags can only be set in `seed.json` today.
- A photo cannot be removed from a problem once saved (only replaced by re-logging with a new one), and Undo of that re-log does not bring the old photo back.
- Board climbs cannot be edited, only deleted and re-logged.
- The share sheet path (`navigator.share` with files) has no automated test: Chromium in CI has no Web Share, so e2e covers the download fallback.
- Board walls show in Settings → Walls but have no Walls-tab entry (decision 37 unchanged).
