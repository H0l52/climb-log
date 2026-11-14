import { useLiveQuery } from 'dexie-react-hooks';
import { db, repos } from './index';
import type { EpochMs, GradeBand, Gym, ID, Session, SettingKey, Wall, WallSet } from './types';
import type { Entry, ProjectRow } from './logging';

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

/** Gyms by name and the current gym: the last one used, else the first. Undefined while loading. */
export function useCurrentGym(): { gyms: Gym[]; gymId: ID | undefined } | undefined {
  return useLiveQuery(async () => {
    const gyms = (await db.gyms.toArray()).filter((g) => g.active).sort((a, b) => a.name.localeCompare(b.name));
    const last = (await db.settings.get('lastGymId'))?.value;
    return { gyms, gymId: gyms.find((g) => g.id === last)?.id ?? gyms[0]?.id };
  }, []);
}

/** When each wall was last logged on. Undefined while loading, {} when nothing was logged yet. */
export function useWallRecency(): Record<ID, EpochMs> | undefined {
  return useLiveQuery(async () => ((await db.settings.get('wallLastUsed'))?.value ?? {}) as Record<ID, EpochMs>, []);
}

/** The open session; null when there is none, undefined while loading. */
export function useOpenSession(): Session | null | undefined {
  return useLiveQuery(() => repos.sessions.open(), []);
}

export function useSessionEntries(sessionId: ID | undefined): Entry[] | undefined {
  return useLiveQuery(() => (sessionId ? repos.sessions.entries(sessionId) : []), [sessionId]);
}

/** The last finished session at a gym with its entries; null when there is none. */
export function useLastSession(gymId: ID | undefined): { session: Session; entries: Entry[] } | null | undefined {
  return useLiveQuery(async () => {
    const session = gymId ? await repos.sessions.lastEnded(gymId) : null;
    return session ? { session, entries: await repos.sessions.entries(session.id) } : null;
  }, [gymId]);
}

export function useProjects(wallId: ID | undefined): ProjectRow[] | undefined {
  return useLiveQuery(() => (wallId ? repos.logging.projects(wallId) : []), [wallId]);
}
