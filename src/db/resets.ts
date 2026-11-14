import type { ClimbDB } from './schema';
import type { Clock } from './repositories';
import type { ID, ISODate } from './types';
import { melbourneDate } from '../domain/dates';
import { canUndoReset, currentSet, defaultResetDate, planReset, planUndoReset, type ResetRecord } from '../domain/resets';

/** Latest reset per wall (wall ID → record), kept in the `lastReset` setting so Undo survives a reload. */
type ResetMap = Record<ID, ResetRecord>;

export function createResetRepositories(db: ClimbDB, clock: Clock) {
  const records = async (): Promise<ResetMap> => ((await db.settings.get('lastReset'))?.value ?? {}) as ResetMap;
  const tables = [db.walls, db.wallSets, db.problems, db.settings, db.sessions, db.gyms];

  async function undoable(wallId: ID): Promise<ResetRecord | null> {
    const record = (await records())[wallId];
    if (!record) return null;
    const [sets, sessions] = await Promise.all([db.wallSets.where('wallId').equals(wallId).toArray(), db.sessions.toArray()]);
    return canUndoReset(record, sets, sessions) ? record : null;
  }

  return {
    /** Default date for "Mark as reset": the gym's latest set day on or before today, never before the current set. */
    async defaultDate(wallId: ID): Promise<ISODate> {
      const wall = await db.walls.get(wallId);
      const gym = wall && (await db.gyms.get(wall.gymId));
      const sets = await db.wallSets.where('wallId').equals(wallId).toArray();
      return defaultResetDate(gym?.setDays ?? [], melbourneDate(clock.now()), currentSet(sets, wallId)?.setDate);
    },

    /** Mark a wall as reset on `date`. One transaction; nothing is deleted. */
    async mark(wallId: ID, date: ISODate): Promise<ResetRecord> {
      return db.transaction('rw', tables, async () => {
        const wall = await db.walls.get(wallId);
        if (!wall || !wall.active || wall.kind !== 'boulder') throw new Error('Only an active boulder wall can be reset');
        const sets = await db.wallSets.where('wallId').equals(wallId).toArray();
        const cur = currentSet(sets, wallId);
        const problems = cur ? await db.problems.where('wallSetId').equals(cur.id).toArray() : [];
        const plan = planReset(sets, problems, { wallId, date, today: melbourneDate(clock.now()) }, { newSetId: clock.newId(), now: clock.now() });
        await db.wallSets.put(plan.retiredSet);
        await db.wallSets.add(plan.newSet);
        await db.problems.bulkPut(plan.expired);
        await db.settings.put({ key: 'lastReset', value: { ...(await records()), [wallId]: plan.record } });
        return plan.record;
      });
    },

    /** The wall's latest reset while it can still be undone; null otherwise. */
    undoable,

    /** Undo the wall's latest reset: statuses come back exactly and the new set is removed. */
    async undo(wallId: ID): Promise<void> {
      await db.transaction('rw', tables, async () => {
        const record = await undoable(wallId);
        if (!record) throw new Error('This reset can no longer be undone');
        const sets = await db.wallSets.where('wallId').equals(wallId).toArray();
        const problems = await db.problems.where('wallSetId').anyOf([record.retiredSetId, record.newSetId]).toArray();
        const plan = planUndoReset(record, sets, problems);
        await db.wallSets.put(plan.restoredSet);
        await db.problems.bulkPut(plan.problems);
        await db.wallSets.delete(plan.removeSetId);
        const rest = await records();
        delete rest[wallId];
        await db.settings.put({ key: 'lastReset', value: rest });
      });
    },
  };
}
