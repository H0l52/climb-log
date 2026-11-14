import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './index';
import type { GradeBand, Gym, ID, SettingKey, Wall, WallSet } from './types';

export function useGyms(): Gym[] | undefined {
  return useLiveQuery(async () => (await db.gyms.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

export function useGradeBands(): GradeBand[] | undefined {
  return useLiveQuery(() => db.gradeBands.orderBy('order').toArray(), []);
}

export function useWalls(gymId: ID | undefined): Wall[] | undefined {
  return useLiveQuery(() => (gymId ? db.walls.where('gymId').equals(gymId).toArray() : []), [gymId]);
}

export function useWallSets(wallIds: readonly ID[]): WallSet[] | undefined {
  const key = wallIds.join('|');
  return useLiveQuery(() => db.wallSets.where('wallId').anyOf([...wallIds]).toArray(), [key]);
}

export function useSetting<T>(key: SettingKey): T | undefined {
  return useLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined, [key]);
}
