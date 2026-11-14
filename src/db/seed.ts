import type { ClimbDB } from './schema';
import type { EpochMs, SeedData, Wall, WallSet } from './types';
import { melbourneDate } from '../domain/dates';

export interface SeedOptions {
  now: EpochMs;
  newId?: () => string;
}

/**
 * Apply the seed once (docs/data-model.md, Seeding).
 * - Runs only when `seedVersionApplied` is unset or lower than the seed's version.
 * - Only adds rows whose IDs do not exist; never overwrites user edits.
 * Returns true when it wrote anything.
 */
export async function applySeed(db: ClimbDB, seed: SeedData, opts: SeedOptions): Promise<boolean> {
  const newId = opts.newId ?? (() => crypto.randomUUID());
  return db.transaction('rw', [db.settings, db.gyms, db.gradeSystems, db.gradeBands, db.walls, db.wallSets], async () => {
    const applied = (await db.settings.get('seedVersionApplied'))?.value;
    if (typeof applied === 'number' && applied >= seed.seedVersion) return false;

    const today = melbourneDate(opts.now);
    const missing = async <T extends { id: string }>(table: { bulkGet(keys: string[]): Promise<(unknown | undefined)[]> }, rows: T[]) => {
      const existing = await table.bulkGet(rows.map((r) => r.id));
      return rows.filter((_, i) => existing[i] === undefined);
    };

    await db.gyms.bulkAdd(await missing(db.gyms, seed.gyms));
    await db.gradeSystems.bulkAdd(await missing(db.gradeSystems, seed.gradeSystems));
    await db.gradeBands.bulkAdd(await missing(db.gradeBands, seed.gradeBands));

    const defaultSystem = seed.gradeSystems[0]?.id;
    if (!defaultSystem) throw new Error('Seed has no grade system');
    const walls: Wall[] = (await missing(db.walls, seed.walls)).map((w) => ({
      ...w,
      gradeSystemId: defaultSystem,
      active: true,
      mergedIntoId: null,
      createdAt: opts.now,
    }));
    await db.walls.bulkAdd(walls);
    const sets: WallSet[] = walls
      .filter((w) => w.kind === 'boulder')
      .map((w) => ({ id: newId(), wallId: w.id, setDate: today, retiredDate: null }));
    await db.wallSets.bulkAdd(sets);

    await db.settings.put({ key: 'seedVersionApplied', value: seed.seedVersion });
    return true;
  });
}
