import { afterEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed } from './__fixtures__/testDb';

let db: ClimbDB;
afterEach(async () => {
  db.close();
  await db.delete();
});

const gymIdOf = (n: number) => seed.gyms[n]!.id;

describe('first-launch seed', () => {
  it('creates 2 gyms, 8 ordered grade bands and the seeded walls', async () => {
    db = freshDb();
    expect(await applySeed(db, seed, { now: FIXED_NOW })).toBe(true);

    expect(await db.gyms.count()).toBe(2);

    const bands = await db.gradeBands.orderBy('order').toArray();
    expect(bands).toHaveLength(8);
    expect(bands.map((b) => b.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(bands.map((b) => b.id)).toEqual(
      [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.id),
    );
    const ids = bands.map((b) => b.id);
    expect(ids.indexOf('orange')).toBe(ids.indexOf('green') + 1);
    expect(ids.indexOf('red')).toBe(ids.indexOf('orange') + 1);

    const first = await db.walls.where('gymId').equals(gymIdOf(0)).toArray();
    expect(first).toHaveLength(12);
    expect(first.filter((w) => w.kind === 'boulder')).toHaveLength(10);
    expect(first.filter((w) => w.kind === 'board')).toHaveLength(2);

    const second = await db.walls.where('gymId').equals(gymIdOf(1)).toArray();
    expect(second).toHaveLength(3);
    expect(second.filter((w) => w.kind === 'boulder')).toHaveLength(2);
    expect(second.filter((w) => w.kind === 'board')).toHaveLength(1);

    for (const w of [...first, ...second]) {
      const s = seed.walls.find((x) => x.id === w.id)!;
      expect(w.name).toBe(s.name);
      expect(w).toMatchObject({ gradeSystemId: 'uc-colours', active: true, mergedIntoId: null });
    }
  });

  it('gives every boulder wall one current set dated the Melbourne launch date', async () => {
    db = freshDb();
    await applySeed(db, seed, { now: FIXED_NOW });
    const sets = await db.wallSets.toArray();
    const boulderIds = seed.walls.filter((w) => w.kind === 'boulder').map((w) => w.id).sort();
    expect(sets.map((s) => s.wallId).sort()).toEqual(boulderIds);
    for (const s of sets) expect(s).toMatchObject({ setDate: '2026-11-14', retiredDate: null });
  });

  it('runs once: re-applying does not duplicate rows or undo edits', async () => {
    db = freshDb();
    const repos = reposFor(db);
    await applySeed(db, seed, { now: FIXED_NOW });
    const wallId = seed.walls[0]!.id;
    await repos.walls.rename(wallId, 'Renamed wall');
    await repos.gradeBands.recolour('blue', '#000080');
    await repos.gradeBands.move('blue', 1);
    await db.walls.delete(seed.walls[1]!.id); // a row the user removed must not come back

    const counts = async () =>
      Promise.all([db.gyms.count(), db.gradeBands.count(), db.walls.count(), db.wallSets.count()]);
    const before = await counts();

    expect(await applySeed(db, seed, { now: FIXED_NOW + 86_400_000 })).toBe(false);
    expect(await counts()).toEqual(before);
    expect((await db.walls.get(wallId))?.name).toBe('Renamed wall');
    expect((await db.gradeBands.get('blue'))?.hex).toBe('#000080');
    expect((await db.gradeBands.get('blue'))?.order).toBe(3);
    expect(await db.walls.get(seed.walls[1]!.id)).toBeUndefined();
  });

  it('survives a reload (new connection to the same database)', async () => {
    db = freshDb();
    await applySeed(db, seed, { now: FIXED_NOW });
    await reposFor(db).walls.rename(seed.walls[0]!.id, 'Edited');
    db.close();
    const again = new ClimbDB(db.name);
    expect(await applySeed(again, seed, { now: FIXED_NOW })).toBe(false);
    expect(await again.walls.count()).toBe(seed.walls.length);
    expect((await again.walls.get(seed.walls[0]!.id))?.name).toBe('Edited');
    again.close();
  });

  it('a later seed version only adds rows whose IDs do not exist', async () => {
    db = freshDb();
    await applySeed(db, seed, { now: FIXED_NOW });
    await reposFor(db).gradeBands.rename('yellow', 'Lemon');
    const v2 = {
      ...seed,
      seedVersion: 2,
      gradeBands: [...seed.gradeBands, { ...seed.gradeBands[0]!, id: 'new-band', order: 9 }],
    };
    expect(await applySeed(db, v2, { now: FIXED_NOW })).toBe(true);
    expect(await db.gradeBands.count()).toBe(9);
    expect((await db.gradeBands.get('yellow'))?.name).toBe('Lemon');
    expect(await db.wallSets.count()).toBe(seed.walls.filter((w) => w.kind === 'boulder').length);
  });
});
