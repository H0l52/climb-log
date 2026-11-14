# Data model

Single source of truth for types, storage and domain rules. Change this file in the same PR as any schema change.

## Types

```ts
type ID = string;            // crypto.randomUUID(); seed rows use stable slugs
type ISODate = string;       // 'YYYY-MM-DD', Australia/Melbourne calendar date
type EpochMs = number;

interface Gym         { id: ID; name: string; active: boolean;
                        setDays: number[] }   // ISO weekdays, Monday = 1
interface GradeSystem { id: ID; name: string }
interface GradeBand   { id: ID; gradeSystemId: ID; name: string; hex: string;
                        order: number;            // 1 = easiest
                        approxV: number | null;   // display only
                        active: boolean }

type WallKind = 'boulder' | 'board';
interface Wall        { id: ID; gymId: ID; name: string; kind: WallKind;
                        gradeSystemId: ID; styleTags: string[];
                        active: boolean; mergedIntoId: ID | null;
                        createdAt: EpochMs }

interface WallSet     { id: ID; wallId: ID; setDate: ISODate;
                        retiredDate: ISODate | null }   // null = current set

type ProblemStatus = 'project' | 'sent' | 'expired';
interface Problem     { id: ID; wallSetId: ID; gradeBandId: ID;
                        nickname: string | null; photoId: ID | null;
                        styleTags: string[]; status: ProblemStatus;
                        createdAt: EpochMs }

interface Session     { id: ID; gymId: ID; date: ISODate;
                        startedAt: EpochMs; endedAt: EpochMs | null;
                        notes: string | null; energy: 1|2|3|4|5 | null }

type AttemptResult = 'flash' | 'send' | 'fail';
type Felt = 'easy' | 'fair' | 'hard';
interface Attempt     { id: ID; problemId: ID; sessionId: ID;
                        tries: number;            // >= 1, tries in this entry
                        result: AttemptResult; felt: Felt | null;
                        notes: string | null; createdAt: EpochMs }

interface BoardLog    { id: ID; sessionId: ID; wallId: ID;   // a 'board' wall
                        climbName: string | null; angle: number | null;
                        vGrade: number | null; tries: number;
                        result: 'send' | 'fail'; createdAt: EpochMs }

type GoalType = 'first-send-of-colour' | 'sessions-per-week'
              | 'sends-of-colour' | 'flash-rate';
interface Goal        { id: ID; type: GoalType; gradeBandId: ID | null;
                        target: number; deadline: ISODate | null;
                        createdAt: EpochMs; achievedAt: EpochMs | null }

interface Photo       { id: ID; blob: Blob; thumb: Blob; createdAt: EpochMs }
interface Setting     { key: string; value: unknown }
```

## Dexie schema (version 1)

```ts
db.version(1).stores({
  gyms:         'id',
  gradeSystems: 'id',
  gradeBands:   'id, gradeSystemId, order',
  walls:        'id, gymId',
  wallSets:     'id, wallId, setDate',
  problems:     'id, wallSetId, gradeBandId, status',
  sessions:     'id, gymId, date',
  attempts:     'id, problemId, sessionId, createdAt',
  boardLogs:    'id, sessionId, wallId',
  goals:        'id',
  photos:       'id',
  settings:     'key',
});
```

Booleans are not indexable in IndexedDB; filter `active` in memory (row counts are tiny).

Grade bands: reorder renumbers every band in the system to `1..n`; a new band is added as the hardest (`order = max + 1`, `approxV = null`); retire sets `active = false` and can be restored.

Settings keys: `seedVersionApplied`, `lastGymId` (set by the gym switcher and by logging a climb), `wallLastUsed` (map of wall ID → epoch ms of the last climb logged there; orders the wall picker), `backupLastAt`, `photoRetentionDays` (default 90), `persistGranted` (`true`/`false` from `navigator.storage.persist()` on first launch, re-read from `persisted()` on later launches; `null` when unsupported). `lastReset` (map of wall ID → the wall's latest reset record `{ wallId, retiredSetId, newSetId, date, changed: [{ problemId, before }], madeAt }`, kept so Undo survives a reload; removed on undo), `backupReminderDismissedAt` (epoch ms of the last "Dismiss" on the backup banner), `exportIncludePhotos` (boolean, default `true`).

## Seeding

- `src/data/seed.json` is applied **once**, when `seedVersionApplied` is unset.
- It never runs again and never overwrites user edits. A later seed version may only **add** rows whose IDs do not exist.
- Every active boulder wall gets an initial `WallSet` with `setDate` = first-launch date.

## Domain rules

**Problems and attempts**

- A problem's identity is wall set + colour + nickname/photo. The gym gives no IDs.
- Creating a problem always happens together with its first attempt (no `untried` rows in storage; "untried" is not tracked).
- `flash`: the problem's first-ever attempt entry, with `tries = 1`, that succeeds. The UI offers it only then; the domain function rejects it otherwise.
- `send`: any later or multi-try success.
- Status: `project` → `sent` on first success. `sent` never goes back. Repeats of a sent problem are logged as attempts but do not count as new sends.
- Total tries to send = sum of `tries` up to and including the first successful attempt.
- Entries of one problem have strictly increasing `createdAt`, so "first entry" is never ambiguous.
- An `expired` problem takes no new entries; it is logged as a new climb on the new set.
- Corrections (the user edits or deletes an entry) are not transitions: the entry's result is re-labelled (`flash` only if it is still the first entry with `tries = 1`) and the problem's status is re-derived from its remaining entries (any success → `sent`, else `project`, or `expired` on a retired set). Deleting a problem's only entry removes the problem. Undo of a delete restores the entry and problem exactly.
- New climbs go on the wall's current set. Only active boulder walls can be logged on.

**Resets**

- "Mark as reset" on a wall with date $d$:
  1. current `WallSet.retiredDate = d`
  2. every `project` problem in it → `expired`
  3. new `WallSet` with `setDate = d`
- Allowed $d$: not in the future and not before the current set's `setDate` (Melbourne dates).
- Default $d$: the most recent set day for that gym on or before today (configurable set days per gym; fall back to today), raised to the current set's `setDate` if it would be earlier.
- Only an active boulder wall with a current set can be reset. Problems stay on the set they were climbed on.
- Undo is available until the session that was open at the reset ends (with none open, until the next session ends) or another reset is made on that wall. Undo makes the retired set current again, restores every status the reset changed exactly (a problem corrected since, so no longer `expired`, is left as is), moves any climbs logged on the new set back to the restored set, then removes the new set.
- A reset never changes any historical metric: metrics derive sends from attempts, never from `Problem.status`.
- Days since set = calendar days from the current set's `setDate` to today (0 on the day). "Fresh" = 0–6 days.

**Walls**

- Add: from Settings or inline from the wall picker ("+ New wall"), scoped to the current gym. A new boulder wall gets a current `WallSet` with `setDate` = creation date; a board wall gets none.
- Rename: changes `name` only.
- Retire: `active = false`; hidden from pickers, kept in history and stats. A retired (not merged) wall can be restored.
- Merge A into B: move A's `WallSet`s to B (`wallId = B`), set `A.mergedIntoId = B`, `A.active = false`. If both have a current set, A's current set is retired with today's date. Same gym only; B must be active; a merged wall cannot be restored.

**Sessions**

- One gym per session. One open session at a time. Logging with no open session starts one for the wall's gym.
- Starting a session or logging a climb at another gym ends the open session at that moment and starts one there.
- A session with no entry for 6 hours is closed automatically at its last attempt's time (its start time if nothing was logged). Checked on launch, on return to the foreground and before each log.
- Ending a session sets `endedAt`; an empty session is kept.

**Photos**

- Taken on Log climb (camera or library), downscaled before any transaction: at most 1280 px on the long edge as JPEG at 0.7, stepping down by 0.1 to 0.4 until it is ≤ 300 KB; a 160 px thumbnail the same way, ≤ 15 KB. EXIF orientation is applied. Stored in `photos` (its own table, never indexed), referenced by `Problem.photoId`.
- A new problem gets the photo in the same transaction as the problem and first entry. Re-logging a project with a photo replaces its `photoId`; the old photo is left for the orphan sweep.
- Retention (on launch and when the setting changes): a photo is deleted when its problem's set was retired more than `photoRetentionDays` days before today (Melbourne dates; default 90; offered 30/90/180/365). The problem stays, with `photoId = null`. Photos on current sets are never removed.
- Orphan sweep (same pass): a photo no problem points at (its problem's only entry was deleted) is removed once it is more than 24 hours old, well past Undo.

**Board**

- A `BoardLog` is logged on an active `board` wall: optional climb name, V grade (V0–V16), angle (0–70° in 5° steps), tries ≥ 1, `send` or `fail`. Logging starts or switches the session exactly like a boulder climb.
- Board logs appear in the session's entries (Today, session history) and count as sessions for the week streak and sessions-a-week goals. They never enter colour metrics or the colour tally: `loadMetricInput` does not read `boardLogs`.
- Delete is explicit, with Undo.

## Metrics

All computed in `src/domain/metrics.ts` (and the Progress view model in `src/domain/progress.ts`) as pure functions over arrays. Boulder problems only; board logs are never loaded. Every metric is registered in `METRICS` so the reset test covers it, and each has hand-calculated fixture values (`src/domain/__fixtures__/metricsFixture.ts`).

Windows are inclusive Melbourne calendar-date ranges. Weeks run Monday to Sunday.

- A problem's **first success** is its earliest `flash` or `send` entry; later successes are repeats.
- Sends of colour $c$ in a window: problems whose first success falls in the window.
- Flash rate: $F_c = \dfrac{\text{flashes}_c}{\text{sends}_c}$ (undefined when $\text{sends}_c = 0$; display "–", a gap in lines, never 0%).
- Send rate: $S_c = \dfrac{\text{problems sent}_c}{\text{problems attempted}_c}$ over problems first attempted in the window (sent at any time).
- Session score: $\displaystyle \text{score} = \sum_{\text{new sends}} w_c,\quad w_c = 2^{\,\text{order}(c) - 1}$. Per bucket, the sum over new sends in the bucket.
- Working grade: highest-order colour with $S_c \ge 0.5$ and at least 4 problems attempted over the trailing 42 days (today and the 41 days before).
- Weekly streak: consecutive Monday-to-Sunday weeks with at least one session, counting back from the current week (the current week does not break the streak while it is in progress). Uses `Session.date`, so daylight-saving changes cannot move a session between weeks.
- Style breakdown: $S_c$ grouped by tag, over the union of the wall's `styleTags` and the problem's `styleTags` (each tag once per problem); weakest first; untagged problems are left out.
- First send of each colour: the problem with the earliest first success per colour (automatic achievements).
- Gym filter: keep sessions at the gym and the entries logged in them.

## Goals

Stored in `goals` (schema v1, no change). `achievedAt` is derived from the log by `src/domain/goals.ts` and re-synced inside every logging write (log, re-log, edit, delete, restore) and session start, so a goal completes in the same transaction as the entry that met it, at that entry's `createdAt`, and goes back to `null` if that entry is corrected away. Only events at or after `createdAt` and on or before `deadline` count.

| Type | `gradeBandId` | `target` | Achieved at |
|---|---|---|---|
| `first-send-of-colour` | required | 1 | the colour's first send (or `createdAt` if it was already sent) |
| `sends-of-colour` | required | sends | the target-th send of the colour after `createdAt` |
| `flash-rate` | required | percent 1–100 | the first send after `createdAt` at which the colour's flash rate over the trailing 42 days is ≥ target with at least 4 sends |
| `sessions-per-week` | null | sessions | the target-th session started within one Monday-to-Sunday week |

A goal past its deadline and not achieved is shown as missed. Goals can be removed (with Undo).

## Export format

```json
{ "app": "climb-log", "schemaVersion": 1, "exportedAt": 0,
  "tables": { "gyms": [], "gradeSystems": [], "gradeBands": [], "walls": [],
              "wallSets": [], "problems": [], "sessions": [], "attempts": [],
              "boardLogs": [], "goals": [], "settings": [] },
  "photos": [ { "id": "", "createdAt": 0,
                "file": "photos/<id>.jpg", "thumb": "photos/<id>.thumb.jpg" } ] }
```

- Delivered as `climb-log-YYYY-MM-DD.zip` (`climb-log.json` + `photos/`, JPEGs stored uncompressed), or `climb-log-YYYY-MM-DD.json` alone when "Include photos" is off. Code: `src/domain/exportFormat.ts` (format, validation, migrations) and `src/db/backup.ts` (build, parse, import).
- Rows are written exactly as stored. The `backupLastAt` setting in the file is the file's `exportedAt`, so a restored copy remembers this backup. The app sets `backupLastAt` only once the share sheet or download succeeds.
- Import accepts `.zip` or `.json`, refuses a file whose `app` is not `climb-log` ("This file is not a Climb Log backup.") or whose `schemaVersion` is higher than the app's (says to update the app), and migrates a lower one through `MIGRATIONS[n]` (n → n + 1, applied in order; none exist while the format is version 1). Damaged files (missing table, row without key, missing photo files) are refused.
- After a confirmation showing the backup's date and counts, import replaces every table, photos and settings included, in one transaction. Photo blobs are built before the transaction. A problem whose photo is not in the file (JSON-only backup) gets `photoId = null`.
- Export → clear → import yields a deep-equal database (`src/db/backup.test.ts`).
- Backup reminder: shown on Today when more than 30 Melbourne calendar days have passed since `backupLastAt` (or, never exported, since the first session); "Dismiss" hides it for 7 days.
