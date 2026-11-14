# UI spec

Phone-only, portrait, one-handed, used between attempts with chalky fingers. Speed of logging beats everything else.

## Navigation

Bottom tab bar, five tabs: **Today · Walls · Progress · Goals · More** (More = Sessions, Board log, Settings). The "Log climb" action is a large button on Today, reachable by thumb.

Routes (hash): `#/`, `#/log`, `#/walls`, `#/walls/:id`, `#/progress`, `#/goals`, `#/more`, `#/sessions`, `#/board`, `#/settings`. Unknown routes show "Not found" with a link to Today.

## Screens

### Today
- Gym switcher chips at the top (remembers last gym). Switching gym does not end an open session; starting or logging at the other gym does.
- No open session: "Start session" + last session summary + week streak (all gyms).
- Open session: timer, running tally by colour, list of this session's entries (tap to edit colour, tries and result inline; swipe left or "Delete" in the edit panel to delete, with Undo), "Log climb", "End session".
- "Log climb" and the session button are pinned above the tab bar. "Log climb" is always available; with no open session it starts one.
- Strip of walls for this gym (below the gym switcher, scrolls sideways, freshest first) with "days since set"; walls set in the last 7 days (0–6 days) get a "Fresh" badge. Each tile opens the wall.

### Log climb (the critical flow)
One screen, top to bottom, no page changes:

1. **Wall** — horizontal chips for the current gym, most recently used first, ending with **"+ New wall"** (inline text field, creates and selects).
2. **Projects on this wall** — if any, one row each (colour chip, nickname/thumbnail, tries so far). Tapping one switches to "re-log" mode.
3. **Colour** — the grade bands as large chips in order, labelled.
4. **Tries** — stepper, default 1.
5. **Result** — "Sent" / "Not yet". With tries = 1 on a new problem, "Sent" is labelled "Flash". Tapping a result saves; there is no separate Save button. Both are disabled until a colour or project is chosen.
6. Optional, collapsed: photo ("Take photo" opens the camera, "Choose photo" the library; a preview with "Remove photo" once picked; on a project it replaces the current photo), nickname, style tags, felt difficulty, note.

Project rows show the problem's thumbnail on the left; tapping the thumbnail opens the photo full screen (tap anywhere, "Close" or Escape to return), tapping the row selects the project.

Saving returns to Today with a toast and Undo. The toast lasts 6 seconds and is dismissed on leaving Today.

Tap budgets (after the screen is open):

| Flow | Budget |
|---|---|
| New climb, flash, last-used wall | ≤ 3 taps (colour, Flash… wall preselected) |
| New climb, any wall | ≤ 4 taps |
| Re-log an existing project | ≤ 2 taps |
| New wall + first climb | ≤ 6 taps + typing the name |

### Walls
- Gym switcher chips (shared with Today). List of the gym's active boulder walls by name: name, "Set N days ago" with a "Fresh" badge (0–6 days), and two lines of colour chips for the current set: "Sent" and "Projects", each with counts. Tapping a row opens the wall.
- Wall detail: gym and set age, current set's problems (projects first), past sets (collapsed, each set collapsed again, read-only: date range, sent/expired counts, climbs), and "Mark as reset" pinned above the tab bar. Rename, retire and merge stay in Settings (linked from the detail screen).
- "Mark as reset" opens an inline sheet: a date field (default per data-model, limited to the current set's date through today), "N projects will expire. Sent climbs stay sent.", Cancel and "Mark as reset". Saving shows a toast with Undo; while undo is still allowed (data-model, Resets) the detail screen also shows "Reset <date> · Undo reset".

### Progress
Filters: gym (All / each), range (6 weeks / 3 months / year / all). Both apply to every tile and chart (decision 40).
- Headline tiles: working grade, sends in the range, flash rate in the range (each with a delta versus the previous period of the same length), week streak.
- Sends per colour per week or month (stacked bars, easiest at the bottom; tap a bar for the readout).
- Grade pyramid over the range (hardest at the top, values in text).
- Flash rate trend: working grade and neighbours, "All colours" toggle; "–" and gaps where a colour had no sends.
- Style breakdown: send rate by tag, weakest first.
- Session score: points from new sends per bucket.
- Every chart has a one-line summary underneath; trend charts show "Keep logging" with sessions in fewer than 3 periods. Empty log: "No climbs logged yet" with "Log a climb".

### Goals
- Week streak and sessions this week tiles.
- Active goals: colour chip, title, progress bar and value, deadline ("Missed" once passed), Remove (with Undo).
- "New goal" (pinned above the tab bar) opens an inline form: type (First send, Sends, Flash rate, Sessions a week), colour, target stepper, optional deadline, Cancel / "Add goal".
- Achieved goals, newest first, with the date.
- Achievements: first send of each colour, newest first, recorded automatically even without a goal.

### Board
- Board chips for the current gym (board walls, data-driven like any wall; most recently used first), optional climb name, V grade chips (V0–V16, tap again to clear), angle chips (0–70°, prefilled with the last angle on that board), tries stepper, "Not yet" / "Sent" (saves, toast with Undo; the form clears except board and angle).
- "This session" lists the open session's board climbs with Delete (Undo).
- No board at the gym: "No boards at this gym." with "Add a board in Settings".
- Appears in session history and in Today's open-session list (read-only there); excluded from colour stats and the colour tally.

### Sessions
- Every session, newest first: date, gym, start time, "open" while running, "N climbs · M board". Tapping one expands its entries (read-only): boulder entries with thumbnail, colour, wall and result, then board entries. Empty: "No sessions yet." with "Log a climb".

### Settings
- Gyms and set days · Walls (per gym, opening on the last-used gym: add, rename, retire, restore, merge) · Grade bands (rename, recolour, reorder, add, retire, restore) · Backup · Storage (persistence status, bytes used, photo count and size, photo retention 30/90/180/365 days) · About (version, build date).
- Backup: last backup date ("Never", or the date and days ago); "Include photos · N · size" toggle; "Export backup" prepares the file, then "Save backup" opens the share sheet (Save to Files) or downloads it, with Cancel. "Import backup" picks a `.zip` or `.json`; a bad file shows an inline error; a good one shows "Replace everything on this phone with the backup from <date>? It has N sessions, M climbs and P photos." with Cancel and "Replace data".

## States every screen must handle

- Empty (first launch, no sessions): say what to do next, one action.
- Offline: no difference. No spinners waiting on network.
- Update available: non-blocking banner, "Reload to update".
- Backup overdue (> 30 days since the last export, or since the first session if never): inline banner on Today under the wall strip, "Last backup N days ago" / "No backup yet", with "Back up" (opens Settings) and "Dismiss" (hides it for 7 days).
- Storage not persistent or not installed: one-time explainer with "Share → Add to Home Screen".
