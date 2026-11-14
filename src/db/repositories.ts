import type { ClimbDB } from './schema';
import type { GradeBand, ID, SettingKey, Wall, WallKind } from './types';
import { melbourneDate } from '../domain/dates';
import { moveItem, nextOrder } from '../domain/ordering';
import { cleanName, planMerge } from '../domain/walls';
import { isValidHex } from '../domain/colour';
import { createLoggingRepositories } from './logging';
import { createResetRepositories } from './resets';

export interface Clock {
  now: () => number;
  newId: () => string;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
};

function requireName(name: string): string {
  const n = cleanName(name);
  if (!n) throw new Error('Name is required');
  return n;
}

export function createRepositories(db: ClimbDB, clock: Clock = systemClock) {
  const settings = {
    async get<T = unknown>(key: SettingKey): Promise<T | undefined> {
      return (await db.settings.get(key))?.value as T | undefined;
    },
    async set(key: SettingKey, value: unknown): Promise<void> {
      await db.settings.put({ key, value });
    },
  };

  const gyms = {
    list: () => db.gyms.toArray(),
    async setSetDays(gymId: ID, days: number[]): Promise<void> {
      const clean = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
      await db.gyms.update(gymId, { setDays: clean });
    },
  };

  const walls = {
    listForGym: (gymId: ID) => db.walls.where('gymId').equals(gymId).toArray(),
    setsFor: (wallId: ID) => db.wallSets.where('wallId').equals(wallId).toArray(),

    /** New wall for a gym. Boulder walls start with a current set dated today. */
    async add(input: { gymId: ID; name: string; kind: WallKind }): Promise<Wall> {
      const name = requireName(input.name);
      return db.transaction('rw', [db.walls, db.wallSets, db.gradeSystems, db.gyms], async () => {
        if (!(await db.gyms.get(input.gymId))) throw new Error('Unknown gym');
        const system = (await db.gradeSystems.toCollection().first())?.id;
        if (!system) throw new Error('No grade system');
        const wall: Wall = {
          id: clock.newId(), gymId: input.gymId, name, kind: input.kind, gradeSystemId: system,
          styleTags: [], active: true, mergedIntoId: null, createdAt: clock.now(),
        };
        await db.walls.add(wall);
        if (wall.kind === 'boulder') {
          await db.wallSets.add({ id: clock.newId(), wallId: wall.id, setDate: melbourneDate(clock.now()), retiredDate: null });
        }
        return wall;
      });
    },

    async rename(wallId: ID, name: string): Promise<void> {
      await db.walls.update(wallId, { name: requireName(name) });
    },

    async setActive(wallId: ID, active: boolean): Promise<void> {
      const wall = await db.walls.get(wallId);
      if (!wall) throw new Error('Unknown wall');
      if (active && wall.mergedIntoId) throw new Error('A merged wall cannot be restored');
      await db.walls.update(wallId, { active });
    },

    /** Merge A into B. Moves every wall set; nothing is deleted. */
    async merge(fromId: ID, intoId: ID): Promise<void> {
      await db.transaction('rw', [db.walls, db.wallSets], async () => {
        const [from, into] = await db.walls.bulkGet([fromId, intoId]);
        if (!from || !into) throw new Error('Unknown wall');
        if (from.gymId !== into.gymId) throw new Error('Walls must be in the same gym');
        if (!into.active) throw new Error('Cannot merge into a retired wall');
        const [fromSets, intoSets] = await Promise.all([
          db.wallSets.where('wallId').equals(fromId).toArray(),
          db.wallSets.where('wallId').equals(intoId).toArray(),
        ]);
        const plan = planMerge(fromId, intoId, fromSets, intoSets, melbourneDate(clock.now()));
        await db.wallSets.bulkPut(plan.wallSets);
        await db.walls.update(fromId, { active: plan.from.active, mergedIntoId: plan.from.mergedIntoId });
      });
    },
  };

  const gradeBands = {
    async listOrdered(): Promise<GradeBand[]> {
      return db.gradeBands.orderBy('order').toArray();
    },

    async rename(id: ID, name: string): Promise<void> {
      await db.gradeBands.update(id, { name: requireName(name) });
    },

    async recolour(id: ID, hex: string): Promise<void> {
      if (!isValidHex(hex)) throw new Error('Colour must be #rrggbb');
      await db.gradeBands.update(id, { hex: hex.toUpperCase() });
    },

    async move(id: ID, delta: -1 | 1): Promise<void> {
      await db.transaction('rw', db.gradeBands, async () => {
        const band = await db.gradeBands.get(id);
        if (!band) throw new Error('Unknown grade band');
        const same = await db.gradeBands.where('gradeSystemId').equals(band.gradeSystemId).toArray();
        const reordered = moveItem(same, id, delta);
        await db.gradeBands.bulkPut(reordered);
      });
    },

    async add(input: { name: string; hex: string }): Promise<GradeBand> {
      const name = requireName(input.name);
      if (!isValidHex(input.hex)) throw new Error('Colour must be #rrggbb');
      return db.transaction('rw', [db.gradeBands, db.gradeSystems], async () => {
        const system = (await db.gradeSystems.toCollection().first())?.id;
        if (!system) throw new Error('No grade system');
        const same = await db.gradeBands.where('gradeSystemId').equals(system).toArray();
        const band: GradeBand = {
          id: clock.newId(), gradeSystemId: system, name, hex: input.hex.toUpperCase(),
          order: nextOrder(same), approxV: null, active: true,
        };
        await db.gradeBands.add(band);
        return band;
      });
    },

    async setActive(id: ID, active: boolean): Promise<void> {
      await db.gradeBands.update(id, { active });
    },
  };

  return { settings, gyms, walls, gradeBands, ...createLoggingRepositories(db, clock), resets: createResetRepositories(db, clock) };
}

export type Repositories = ReturnType<typeof createRepositories>;
