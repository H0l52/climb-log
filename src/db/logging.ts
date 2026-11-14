import type { ClimbDB } from './schema';
import type { Attempt, EpochMs, Felt, ID, Problem, Session, Wall } from './types';
import type { Clock } from './repositories';
import {
  addAttempt, assertValidEntry, createProblemWithFirstAttempt, firstSuccess, inOrder, resultFor, statusFromAttempts, totalTries,
} from '../domain/logging';
import { autoCloseAt, newSession } from '../domain/sessions';

/** One logged entry with what a list needs to show it. */
export interface Entry {
  attempt: Attempt;
  problem: Problem;
  wall: Wall | undefined;
  /** True when this entry is the problem's first success (a new send, not a repeat). */
  newSend: boolean;
}

export interface ProjectRow {
  problem: Problem;
  tries: number;
  lastTriedAt: EpochMs;
}

/** What a delete removed, so Undo can put it back. */
export interface DeletedEntry {
  attempt: Attempt;
  problem: Problem;
}

export interface LogResult {
  attempt: Attempt;
  problem: Problem;
  session: Session;
}

interface Details {
  tries: number;
  success: boolean;
  felt?: Felt | null;
  notes?: string | null;
}

export function createLoggingRepositories(db: ClimbDB, clock: Clock) {
  const openSession = async (): Promise<Session | null> =>
    (await db.sessions.filter((s) => s.endedAt === null).first()) ?? null;

  /** Close sessions left open with no activity for 6 hours. */
  async function closeStale(): Promise<void> {
    await db.transaction('rw', [db.sessions, db.attempts], async () => {
      const open = await db.sessions.filter((s) => s.endedAt === null).toArray();
      for (const s of open) {
        const times = (await db.attempts.where('sessionId').equals(s.id).toArray()).map((a) => a.createdAt);
        const at = autoCloseAt(s, times, clock.now());
        if (at !== null) await db.sessions.update(s.id, { endedAt: at });
      }
    });
  }

  /** The open session for this gym, starting one if needed. An open session at another gym is ended. */
  async function ensureSession(gymId: ID): Promise<Session> {
    return db.transaction('rw', [db.sessions, db.attempts, db.gyms], async () => {
      await closeStale();
      const open = await openSession();
      if (open?.gymId === gymId) return open;
      if (!(await db.gyms.get(gymId))) throw new Error('Unknown gym');
      if (open) await db.sessions.update(open.id, { endedAt: clock.now() });
      const session = newSession(gymId, clock.now(), clock.newId());
      await db.sessions.add(session);
      return session;
    });
  }

  const sessions = {
    open: openSession,
    closeStale,
    start: ensureSession,
    async end(sessionId: ID): Promise<void> {
      const s = await db.sessions.get(sessionId);
      if (s && s.endedAt === null) await db.sessions.update(sessionId, { endedAt: clock.now() });
    },
    /** Most recently started closed session at a gym. */
    async lastEnded(gymId: ID): Promise<Session | null> {
      const all = await db.sessions.where('gymId').equals(gymId).toArray();
      return all.filter((s) => s.endedAt !== null).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
    },
    /** Entries of a session, newest first. */
    async entries(sessionId: ID): Promise<Entry[]> {
      const attempts = await db.attempts.where('sessionId').equals(sessionId).toArray();
      const problemIds = [...new Set(attempts.map((a) => a.problemId))];
      const problems = new Map((await db.problems.bulkGet(problemIds)).flatMap((p) => (p ? [[p.id, p] as const] : [])));
      const all = await db.attempts.where('problemId').anyOf(problemIds).toArray();
      const sets = new Map(
        (await db.wallSets.bulkGet([...new Set([...problems.values()].map((p) => p.wallSetId))])).flatMap((s) => (s ? [[s.id, s] as const] : [])),
      );
      const walls = new Map(
        (await db.walls.bulkGet([...new Set([...sets.values()].map((s) => s.wallId))])).flatMap((w) => (w ? [[w.id, w] as const] : [])),
      );
      return inOrder(attempts).reverse().flatMap((attempt) => {
        const problem = problems.get(attempt.problemId);
        if (!problem) return [];
        const own = all.filter((a) => a.problemId === problem.id);
        const wall = walls.get(sets.get(problem.wallSetId)?.wallId ?? '');
        return [{ attempt, problem, wall, newSend: firstSuccess(own)?.id === attempt.id }];
      });
    },
  };

  async function touch(wall: Wall): Promise<void> {
    const used = ((await db.settings.get('wallLastUsed'))?.value ?? {}) as Record<ID, EpochMs>;
    await db.settings.bulkPut([
      { key: 'wallLastUsed', value: { ...used, [wall.id]: clock.now() } },
      { key: 'lastGymId', value: wall.gymId },
    ]);
  }

  async function wallOfSet(wallSetId: ID) {
    const set = await db.wallSets.get(wallSetId);
    const wall = set && (await db.walls.get(set.wallId));
    if (!set || !wall) throw new Error('Unknown wall');
    return { set, wall };
  }

  const tables = [db.settings, db.gyms, db.walls, db.wallSets, db.gradeBands, db.problems, db.attempts, db.sessions];

  const logging = {
    /** Projects on a wall's current set, most recently tried first. */
    async projects(wallId: ID): Promise<ProjectRow[]> {
      const current = (await db.wallSets.where('wallId').equals(wallId).toArray()).find((s) => s.retiredDate === null);
      if (!current) return [];
      const problems = (await db.problems.where('wallSetId').equals(current.id).toArray()).filter((p) => p.status === 'project');
      const attempts = await db.attempts.where('problemId').anyOf(problems.map((p) => p.id)).toArray();
      return problems
        .map((problem) => {
          const own = attempts.filter((a) => a.problemId === problem.id);
          return { problem, tries: totalTries(own), lastTriedAt: own.reduce((m, a) => Math.max(m, a.createdAt), problem.createdAt) };
        })
        .sort((a, b) => b.lastTriedAt - a.lastTriedAt);
    },

    /** New problem with its first entry, on the wall's current set. Starts a session if none is open. */
    async logNew(input: Details & { wallId: ID; gradeBandId: ID; nickname?: string | null; styleTags?: string[] }): Promise<LogResult> {
      return db.transaction('rw', tables, async () => {
        const wall = await db.walls.get(input.wallId);
        if (!wall || !wall.active || wall.kind !== 'boulder') throw new Error('Pick a boulder wall');
        const set = (await db.wallSets.where('wallId').equals(wall.id).toArray()).find((s) => s.retiredDate === null);
        if (!set) throw new Error('This wall has no current set');
        if (!(await db.gradeBands.get(input.gradeBandId))) throw new Error('Pick a colour');
        const session = await ensureSession(wall.gymId);
        const { problem, attempt } = createProblemWithFirstAttempt(
          {
            wallSetId: set.id, gradeBandId: input.gradeBandId, nickname: input.nickname, styleTags: input.styleTags,
            sessionId: session.id, tries: input.tries, felt: input.felt, notes: input.notes,
            result: resultFor({ priorEntries: 0, tries: input.tries, success: input.success }),
          },
          { problemId: clock.newId(), attemptId: clock.newId(), now: clock.now() },
        );
        await db.problems.add(problem);
        await db.attempts.add(attempt);
        await touch(wall);
        return { attempt, problem, session };
      });
    },

    /** Another entry on an existing problem (re-log a project, or repeat a sent problem). */
    async logAgain(input: Details & { problemId: ID }): Promise<LogResult> {
      return db.transaction('rw', tables, async () => {
        const before = await db.problems.get(input.problemId);
        if (!before) throw new Error('Unknown problem');
        const { wall } = await wallOfSet(before.wallSetId);
        const prior = await db.attempts.where('problemId').equals(before.id).toArray();
        const session = await ensureSession(wall.gymId);
        const { problem, attempt } = addAttempt(
          before,
          prior,
          {
            sessionId: session.id, tries: input.tries, felt: input.felt, notes: input.notes,
            result: resultFor({ priorEntries: prior.length, tries: input.tries, success: input.success }),
          },
          { attemptId: clock.newId(), now: clock.now() },
        );
        await db.problems.update(problem.id, { status: problem.status });
        await db.attempts.add(attempt);
        await touch(wall);
        return { attempt, problem, session };
      });
    },

    /** Correct an entry. The problem's status is re-derived from its entries. */
    async updateEntry(attemptId: ID, change: { tries: number; success: boolean; gradeBandId?: ID }): Promise<void> {
      await db.transaction('rw', tables, async () => {
        const attempt = await db.attempts.get(attemptId);
        const problem = attempt && (await db.problems.get(attempt.problemId));
        if (!attempt || !problem) throw new Error('Unknown entry');
        const all = await db.attempts.where('problemId').equals(problem.id).toArray();
        const priorEntries = all.filter((a) => a.createdAt < attempt.createdAt).length;
        const result = resultFor({ priorEntries, tries: change.tries, success: change.success });
        assertValidEntry({ priorEntries, tries: change.tries, result });
        if (change.gradeBandId && !(await db.gradeBands.get(change.gradeBandId))) throw new Error('Pick a colour');
        await db.attempts.update(attemptId, { tries: change.tries, result });
        const { set } = await wallOfSet(problem.wallSetId);
        const next = all.map((a) => (a.id === attemptId ? { ...a, result } : a));
        await db.problems.update(problem.id, {
          status: statusFromAttempts(next, set.retiredDate !== null),
          gradeBandId: change.gradeBandId ?? problem.gradeBandId,
        });
      });
    },

    /** Explicit user delete. A problem left with no entries is removed with it. Returns what Undo needs. */
    async deleteEntry(attemptId: ID): Promise<DeletedEntry> {
      return db.transaction('rw', tables, async () => {
        const attempt = await db.attempts.get(attemptId);
        const problem = attempt && (await db.problems.get(attempt.problemId));
        if (!attempt || !problem) throw new Error('Unknown entry');
        await db.attempts.delete(attemptId);
        const rest = await db.attempts.where('problemId').equals(problem.id).toArray();
        if (rest.length === 0) {
          await db.problems.delete(problem.id);
        } else {
          const { set } = await wallOfSet(problem.wallSetId);
          await db.problems.update(problem.id, { status: statusFromAttempts(rest, set.retiredDate !== null) });
        }
        return { attempt, problem };
      });
    },

    /** Undo a delete: the entry (and its problem, if it was removed) come back exactly as they were. */
    async restoreEntry(deleted: DeletedEntry): Promise<void> {
      await db.transaction('rw', tables, async () => {
        if (!(await db.problems.get(deleted.problem.id))) await db.problems.add(deleted.problem);
        await db.attempts.put(deleted.attempt);
        const all = await db.attempts.where('problemId').equals(deleted.problem.id).toArray();
        const { set } = await wallOfSet(deleted.problem.wallSetId);
        await db.problems.update(deleted.problem.id, { status: statusFromAttempts(all, set.retiredDate !== null) });
      });
    },
  };

  return { sessions, logging };
}
