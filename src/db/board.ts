import type { ClimbDB } from './schema';
import type { Clock } from './repositories';
import type { BoardLog, EpochMs, ID, Session, Wall } from './types';
import { newBoardLog, type BoardInput } from '../domain/board';
import { goalTables } from './goals';

export interface BoardRow {
  log: BoardLog;
  wall: Wall | undefined;
}

/** Board climbs. Stored in boardLogs; never read by colour metrics. */
export function createBoardRepositories(db: ClimbDB, clock: Clock, start: (gymId: ID) => Promise<Session>) {
  async function rows(logs: BoardLog[]): Promise<BoardRow[]> {
    const walls = new Map((await db.walls.bulkGet([...new Set(logs.map((l) => l.wallId))])).flatMap((w) => (w ? [[w.id, w] as const] : [])));
    return [...logs].sort((a, b) => b.createdAt - a.createdAt).map((log) => ({ log, wall: walls.get(log.wallId) }));
  }

  return {
    /** Log a board climb on a board wall. Starts (or switches) the session like a boulder climb. */
    async log(input: BoardInput & { wallId: ID }): Promise<BoardLog> {
      return db.transaction('rw', [db.boardLogs, db.settings, db.gyms, ...goalTables(db)], async () => {
        const wall = await db.walls.get(input.wallId);
        if (!wall || !wall.active || wall.kind !== 'board') throw new Error('Pick a board');
        const session = await start(wall.gymId);
        const log = newBoardLog(input, { id: clock.newId(), sessionId: session.id, wallId: wall.id, now: clock.now() });
        await db.boardLogs.add(log);
        const used = ((await db.settings.get('wallLastUsed'))?.value ?? {}) as Record<ID, EpochMs>;
        await db.settings.bulkPut([
          { key: 'wallLastUsed', value: { ...used, [wall.id]: clock.now() } },
          { key: 'lastGymId', value: wall.gymId },
        ]);
        return log;
      });
    },

    /** Explicit user delete. Returns the row for Undo. */
    async remove(id: ID): Promise<BoardLog> {
      const log = await db.boardLogs.get(id);
      if (!log) throw new Error('Unknown board entry');
      await db.boardLogs.delete(id);
      return log;
    },

    async restore(log: BoardLog): Promise<void> {
      await db.boardLogs.put(log);
    },

    /** Board entries of a session, newest first. */
    async forSession(sessionId: ID): Promise<BoardRow[]> {
      return rows(await db.boardLogs.where('sessionId').equals(sessionId).toArray());
    },

    /** Latest entry on a wall, to prefill the angle. */
    async lastOn(wallId: ID): Promise<BoardLog | null> {
      const logs = await db.boardLogs.where('wallId').equals(wallId).toArray();
      return logs.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    },
  };
}
