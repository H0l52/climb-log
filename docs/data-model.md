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

Settings keys: `seedVersionApplied`, `lastGymId` (set by the gym switcher and by logging a climb), `wallLastUsed` (map of wall ID → epoch ms of the last climb logged there; orders the wall picker), `backupLastAt`, `photoRetentionDays` (default 90), `persistGranted` (`true`/`false` from `navigator.storage.persist()` on first launch, re-read from `persisted()` on later launches; `null` when unsupported).

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
- Default $d$: the most recent set day for that gym on or before today (configurable set days per gym; fall back to today).
- Undo is available until the session ends or another reset is made on that wall. Undo restores statuses exactly.
- A reset never changes any historical metric.

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

## Metrics

All computed in `src/domain/metrics.ts` as pure functions over arrays. Boulder problems only; board logs are excluded.

- Sends of colour $c$ in a window: problems whose first success falls in the window.
- Flash rate: $F_c = \dfrac{\text{flashes}_c}{\text{sends}_c}$ (undefined when $\text{sends}_c = 0$; display "–").
- Send rate: $S_c = \dfrac{\text{problems sent}_c}{\text{problems attempted}_c}$ over problems first attempted in the window.
- Session score: $\displaystyle \text{score} = \sum_{\text{new sends}} w_c,\quad w_c = 2^{\,\text{order}(c) - 1}$
- Working grade: highest-order colour with $S_c \ge 0.5$ and at least 4 problems attempted over the trailing 42 days.
- Weekly streak: consecutive Monday-to-Sunday weeks with at least one session, counting back from the current week (the current week does not break the streak while it is in progress).
- Style breakdown: $S_c$ grouped by wall `styleTags` and problem `styleTags`.

## Export format

```json
{ "app": "climb-log", "schemaVersion": 1, "exportedAt": 0,
  "tables": { "gyms": [], "gradeSystems": [], "gradeBands": [], "walls": [],
              "wallSets": [], "problems": [], "sessions": [], "attempts": [],
              "boardLogs": [], "goals": [], "settings": [] },
  "photos": [ { "id": "", "createdAt": 0, "file": "photos/<id>.jpg" } ] }
```

- Delivered as a single `.zip` (JSON + `photos/`), or JSON only when "include photos" is off.
- Import replaces the whole database after a confirmation, refuses a higher `schemaVersion`, and migrates a lower one.
