# UI spec

Phone-only, portrait, one-handed, used between attempts with chalky fingers. Speed of logging beats everything else.

## Navigation

Bottom tab bar, five tabs: **Today · Walls · Progress · Goals · More** (More = Board log, Settings). The "Log climb" action is a large button on Today, reachable by thumb.

Routes (hash): `#/`, `#/log`, `#/walls`, `#/walls/:id`, `#/progress`, `#/goals`, `#/more`, `#/board`, `#/settings`. Unknown routes show "Not found" with a link to Today.

## Screens

### Today
- Gym switcher chips at the top (remembers last gym). Switching gym does not end an open session; starting or logging at the other gym does.
- No open session: "Start session" + last session summary + streak (streak arrives in Phase 4).
- Open session: timer, running tally by colour, list of this session's entries (tap to edit colour, tries and result inline; swipe left or "Delete" in the edit panel to delete, with Undo), "Log climb", "End session".
- "Log climb" and the session button are pinned above the tab bar. "Log climb" is always available; with no open session it starts one.
- Strip of walls for this gym with "days since set"; walls set in the last 7 days get a "fresh" badge.

### Log climb (the critical flow)
One screen, top to bottom, no page changes:

1. **Wall** — horizontal chips for the current gym, most recently used first, ending with **"+ New wall"** (inline text field, creates and selects).
2. **Projects on this wall** — if any, one row each (colour chip, nickname/thumbnail, tries so far). Tapping one switches to "re-log" mode.
3. **Colour** — the grade bands as large chips in order, labelled.
4. **Tries** — stepper, default 1.
5. **Result** — "Sent" / "Not yet". With tries = 1 on a new problem, "Sent" is labelled "Flash". Tapping a result saves; there is no separate Save button. Both are disabled until a colour or project is chosen.
6. Optional, collapsed: photo, nickname, style tags, felt difficulty, note.

Saving returns to Today with a toast and Undo. The toast lasts 6 seconds and is dismissed on leaving Today.

Tap budgets (after the screen is open):

| Flow | Budget |
|---|---|
| New climb, flash, last-used wall | ≤ 3 taps (colour, Flash… wall preselected) |
| New climb, any wall | ≤ 4 taps |
| Re-log an existing project | ≤ 2 taps |
| New wall + first climb | ≤ 6 taps + typing the name |

### Walls
- List for the current gym: name, days since set, counts of sent/project per colour for the current set.
- Wall detail: current set's problems, past sets (collapsed), "Mark as reset" (date sheet, default per data-model), rename, retire, merge.

### Progress
Filters: gym (All / each), range (6 weeks / 3 months / year / all).
- Headline tiles: working grade, sends this week, flash rate (trailing 6 weeks), streak.
- Sends per colour per week (stacked bars).
- Grade pyramid (all-time or range).
- Flash rate trend per colour.
- Style breakdown.
- Session score trend.

### Goals
- Active goals with progress, streak, achievements timeline (first send of each colour is recorded automatically even without a goal).

### Board
- Pick board wall (Kilter, Spray Wall; data-driven like any wall), climb name, angle, V grade, tries, result.
- Appears in session history; excluded from colour stats.

### Settings
- Gyms and set days · Walls (per gym, opening on the last-used gym: add, rename, retire, restore, merge) · Grade bands (rename, recolour, reorder, add, retire, restore) · Backup (export, import, last backup date) · Storage (persistence status, bytes used, photo retention) · About (version, build date).

## States every screen must handle

- Empty (first launch, no sessions): say what to do next, one action.
- Offline: no difference. No spinners waiting on network.
- Update available: non-blocking banner, "Reload to update".
- Backup overdue (> 30 days): dismissible banner on Today.
- Storage not persistent or not installed: one-time explainer with "Share → Add to Home Screen".
