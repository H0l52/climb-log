import type { EpochMs, ID, ISODate, Wall, WallSet } from '../db/types';

export interface MergePlan {
  from: Pick<Wall, 'id' | 'active' | 'mergedIntoId'>;
  wallSets: WallSet[];
}

/**
 * Merge wall A into wall B (docs/data-model.md, Walls):
 * A's wall sets move to B; if both have a current set, A's current set is retired on `today`;
 * A becomes inactive with mergedIntoId = B. No set is deleted.
 */
export function planMerge(fromId: ID, intoId: ID, fromSets: readonly WallSet[], intoSets: readonly WallSet[], today: ISODate): MergePlan {
  if (fromId === intoId) throw new Error('Cannot merge a wall into itself');
  const intoHasCurrent = intoSets.some((s) => s.retiredDate === null);
  const wallSets = fromSets.map((s) => ({
    ...s,
    wallId: intoId,
    retiredDate: s.retiredDate === null && intoHasCurrent ? today : s.retiredDate,
  }));
  return { from: { id: fromId, active: false, mergedIntoId: intoId }, wallSets };
}

/** Pickers show active walls only, sorted by name. */
export function activeWalls<T extends Pick<Wall, 'active' | 'name'>>(walls: readonly T[]): T[] {
  return walls.filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name));
}

/** Wall picker order: active walls, most recently used first, then by name. */
export function byRecency<T extends Pick<Wall, 'id' | 'active' | 'name'>>(walls: readonly T[], lastUsed: Readonly<Record<ID, EpochMs>>): T[] {
  return activeWalls(walls).sort((a, b) => (lastUsed[b.id] ?? 0) - (lastUsed[a.id] ?? 0));
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
