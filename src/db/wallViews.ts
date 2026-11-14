import type { ClimbDB } from './schema';
import type { Gym, ID, Problem, Wall, WallSet } from './types';
import { currentSet, pastSets, type ResetRecord } from '../domain/resets';
import { totalTries } from '../domain/logging';
import type { Repositories } from './repositories';

/** One row of the Walls list / Today strip. */
export interface WallSummary {
  wall: Wall;
  current: WallSet | undefined;
  problems: Problem[]; // on the current set
}

export interface ProblemRow {
  problem: Problem;
  tries: number;
}

export interface SetView {
  set: WallSet;
  problems: ProblemRow[];
}

export interface WallDetail {
  wall: Wall;
  gym: Gym | undefined;
  current: SetView | undefined;
  past: SetView[];
  undoable: ResetRecord | null;
}

const statusRank: Record<Problem['status'], number> = { project: 0, sent: 1, expired: 2 };

/** Read models for the Walls screens. Components reach them through hooks. */
export function createWallViews(db: ClimbDB, repos: Pick<Repositories, 'resets'>) {
  async function rows(problems: Problem[]): Promise<ProblemRow[]> {
    const attempts = await db.attempts.where('problemId').anyOf(problems.map((p) => p.id)).toArray();
    return problems
      .map((problem) => ({ problem, tries: totalTries(attempts.filter((a) => a.problemId === problem.id)) }))
      .sort((a, b) => statusRank[a.problem.status] - statusRank[b.problem.status] || b.problem.createdAt - a.problem.createdAt);
  }

  return {
    /** Active boulder walls of a gym with their current set, by name. */
    async summaries(gymId: ID): Promise<WallSummary[]> {
      const walls = (await db.walls.where('gymId').equals(gymId).toArray())
        .filter((w) => w.active && w.kind === 'boulder')
        .sort((a, b) => a.name.localeCompare(b.name));
      const sets = await db.wallSets.where('wallId').anyOf(walls.map((w) => w.id)).toArray();
      const currents = walls.map((w) => currentSet(sets, w.id));
      const problems = await db.problems.where('wallSetId').anyOf(currents.flatMap((s) => (s ? [s.id] : []))).toArray();
      return walls.map((wall, i) => ({
        wall,
        current: currents[i],
        problems: problems.filter((p) => p.wallSetId === currents[i]?.id),
      }));
    },

    async detail(wallId: ID): Promise<WallDetail | null> {
      const wall = await db.walls.get(wallId);
      if (!wall) return null;
      const gym = await db.gyms.get(wall.gymId);
      const sets = await db.wallSets.where('wallId').equals(wallId).toArray();
      const problems = await db.problems.where('wallSetId').anyOf(sets.map((s) => s.id)).toArray();
      const view = async (set: WallSet): Promise<SetView> => ({ set, problems: await rows(problems.filter((p) => p.wallSetId === set.id)) });
      const cur = currentSet(sets, wallId);
      return {
        wall,
        gym,
        current: cur && (await view(cur)),
        past: await Promise.all(pastSets(sets, wallId).map(view)),
        undoable: await repos.resets.undoable(wallId),
      };
    },
  };
}
