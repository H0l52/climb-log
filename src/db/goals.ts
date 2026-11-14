import type { ClimbDB } from './schema';
import type { Goal, ID } from './types';
import type { Clock } from './repositories';
import type { MetricInput } from '../domain/metrics';
import { goalUpdates, validateGoal, type NewGoal } from '../domain/goals';
import { melbourneDate } from '../domain/dates';

/** Everything the metrics read. Board logs are never loaded: they never enter colour metrics. */
export async function loadMetricInput(db: ClimbDB): Promise<MetricInput> {
  const [problems, attempts, bands, sessions, wallSets, walls] = await Promise.all([
    db.problems.toArray(), db.attempts.toArray(), db.gradeBands.toArray(),
    db.sessions.toArray(), db.wallSets.toArray(), db.walls.toArray(),
  ]);
  return { problems, attempts, bands, sessions, wallSets, walls };
}

/** Tables syncGoals reads and writes; a transaction that calls it must include them. */
export const goalTables = (db: ClimbDB) => [db.goals, db.problems, db.attempts, db.gradeBands, db.sessions, db.wallSets, db.walls];

/**
 * Bring every goal's achievedAt in line with the log. Called inside each write that can change it
 * (logging, corrections, starting a session), so a goal completes in the same transaction as the
 * entry that met it, at that entry's time.
 */
export async function syncGoals(db: ClimbDB): Promise<void> {
  const goals = await db.goals.toArray();
  if (!goals.length) return;
  const updates = goalUpdates(goals, await loadMetricInput(db));
  for (const u of updates) await db.goals.update(u.id, { achievedAt: u.achievedAt });
}

export function createGoalRepositories(db: ClimbDB, clock: Clock) {
  return {
    list: () => db.goals.toArray(),

    async add(input: NewGoal): Promise<Goal> {
      const valid = validateGoal(input, melbourneDate(clock.now()));
      return db.transaction('rw', goalTables(db), async () => {
        if (valid.gradeBandId && !(await db.gradeBands.get(valid.gradeBandId))) throw new Error('Pick a colour');
        const goal: Goal = { id: clock.newId(), ...valid, createdAt: clock.now(), achievedAt: null };
        await db.goals.add(goal);
        await syncGoals(db);
        return (await db.goals.get(goal.id))!;
      });
    },

    /** Remove a goal (goals are plans, not history). Returns it for Undo. */
    async remove(id: ID): Promise<Goal> {
      const goal = await db.goals.get(id);
      if (!goal) throw new Error('Unknown goal');
      await db.goals.delete(id);
      return goal;
    },

    async restore(goal: Goal): Promise<void> {
      await db.transaction('rw', goalTables(db), async () => {
        await db.goals.put(goal);
        await syncGoals(db);
      });
    },
  };
}
