import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;
const gymId = seed.gyms[0]!.id;
const otherGymId = seed.gyms[1]!.id;
const boulder = (n: number) => seed.walls.filter((w) => w.gymId === gymId && w.kind === 'boulder')[n]!.id;

beforeEach(async () => {
  db = freshDb();
  clock = testClock();
  repos = reposFor(db, clock);
  await applySeed(db, seed, { now: FIXED_NOW });
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('walls', () => {
  it('adds a boulder wall with a current set, and a board wall without one', async () => {
    const w = await repos.walls.add({ gymId, name: '  New   cave ', kind: 'boulder' });
    expect(w).toMatchObject({ name: 'New cave', gymId, active: true, mergedIntoId: null, gradeSystemId: 'uc-colours' });
    expect(await repos.walls.setsFor(w.id)).toEqual([
      expect.objectContaining({ wallId: w.id, setDate: '2026-11-14', retiredDate: null }),
    ]);
    const b = await repos.walls.add({ gymId, name: 'Board two', kind: 'board' });
    expect(await repos.walls.setsFor(b.id)).toEqual([]);
  });

  it('rejects empty names and unknown gyms', async () => {
    await expect(repos.walls.add({ gymId, name: '   ', kind: 'boulder' })).rejects.toThrow();
    await expect(repos.walls.add({ gymId: 'nope', name: 'X', kind: 'boulder' })).rejects.toThrow();
    await expect(repos.walls.rename(boulder(0), ' ')).rejects.toThrow();
  });

  it('rename changes the name only and keeps its wall sets', async () => {
    const id = boulder(0);
    const before = await db.walls.get(id);
    const setsBefore = await repos.walls.setsFor(id);
    await repos.walls.rename(id, 'Fresh name');
    expect(await db.walls.get(id)).toEqual({ ...before, name: 'Fresh name' });
    expect(await repos.walls.setsFor(id)).toEqual(setsBefore);
  });

  it('retire hides from active list but keeps the wall and its sets; restore brings it back', async () => {
    const id = boulder(1);
    const sets = await repos.walls.setsFor(id);
    await repos.walls.setActive(id, false);
    expect((await db.walls.get(id))?.active).toBe(false);
    expect(await repos.walls.setsFor(id)).toEqual(sets);
    await repos.walls.setActive(id, true);
    expect((await db.walls.get(id))?.active).toBe(true);
  });

  it('merge moves every set to the target, retires the duplicate current set and keeps history', async () => {
    const a = boulder(2);
    const b = boulder(3);
    const [aSet] = await repos.walls.setsFor(a);
    const [bSet] = await repos.walls.setsFor(b);
    // A has an older, already retired set too.
    await db.wallSets.add({ id: 'old-a', wallId: a, setDate: '2026-10-01', retiredDate: '2026-11-01' });
    clock.advance(86_400_000);

    await repos.walls.merge(a, b);

    expect(await repos.walls.setsFor(a)).toEqual([]);
    const bSets = await repos.walls.setsFor(b);
    expect(bSets).toHaveLength(3);
    expect(bSets).toContainEqual(bSet);
    expect(bSets).toContainEqual({ ...aSet, wallId: b, retiredDate: '2026-11-15' });
    expect(bSets).toContainEqual({ id: 'old-a', wallId: b, setDate: '2026-10-01', retiredDate: '2026-11-01' });
    expect(bSets.filter((s) => s.retiredDate === null)).toHaveLength(1);

    expect(await db.walls.get(a)).toMatchObject({ active: false, mergedIntoId: b });
    expect(await db.walls.get(b)).toMatchObject({ active: true, mergedIntoId: null });
    await expect(repos.walls.setActive(a, true)).rejects.toThrow();
  });

  it('merge keeps the source current set open when the target has none', async () => {
    const a = boulder(4);
    const board = seed.walls.find((w) => w.gymId === gymId && w.kind === 'board')!.id;
    const [aSet] = await repos.walls.setsFor(a);
    await repos.walls.merge(a, board);
    expect(await repos.walls.setsFor(board)).toEqual([{ ...aSet, wallId: board }]);
  });

  it('merge refuses self, cross-gym and retired targets', async () => {
    const a = boulder(0);
    const elsewhere = seed.walls.find((w) => w.gymId === otherGymId)!.id;
    await expect(repos.walls.merge(a, a)).rejects.toThrow();
    await expect(repos.walls.merge(a, elsewhere)).rejects.toThrow();
    await repos.walls.setActive(boulder(1), false);
    await expect(repos.walls.merge(a, boulder(1))).rejects.toThrow();
  });
});

describe('grade bands', () => {
  const ids = async () => (await repos.gradeBands.listOrdered()).map((b) => b.id);

  it('reorder persists across a reload', async () => {
    const start = await ids();
    await repos.gradeBands.move(start[4]!, -1);
    const expected = [...start];
    [expected[3], expected[4]] = [expected[4]!, expected[3]!];
    expect(await ids()).toEqual(expected);
    expect((await repos.gradeBands.listOrdered()).map((b) => b.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    db.close();
    const reopened = new ClimbDB(db.name);
    expect((await reopened.gradeBands.orderBy('order').toArray()).map((b) => b.id)).toEqual(expected);
    reopened.close();
    db = new ClimbDB(db.name);
  });

  it('moving past either end is a no-op', async () => {
    const start = await ids();
    await repos.gradeBands.move(start[0]!, -1);
    await repos.gradeBands.move(start[7]!, 1);
    expect(await ids()).toEqual(start);
  });

  it('rename, recolour, add and retire', async () => {
    await repos.gradeBands.rename('purple', 'Violet');
    await repos.gradeBands.recolour('purple', '#aa00ff');
    await expect(repos.gradeBands.recolour('purple', 'red')).rejects.toThrow();
    expect(await db.gradeBands.get('purple')).toMatchObject({ name: 'Violet', hex: '#AA00FF', order: 3 });

    const added = await repos.gradeBands.add({ name: 'Pink', hex: '#ff69b4' });
    expect(added).toMatchObject({ order: 9, active: true, approxV: null, gradeSystemId: 'uc-colours' });

    await repos.gradeBands.setActive('white', false);
    expect((await db.gradeBands.get('white'))?.active).toBe(false);
    expect(await db.gradeBands.count()).toBe(9);
  });
});

describe('gyms and settings', () => {
  it('stores set days sorted and de-duplicated', async () => {
    await repos.gyms.setSetDays(gymId, [5, 3, 3, 9, 0]);
    expect((await db.gyms.get(gymId))?.setDays).toEqual([3, 5]);
  });

  it('round-trips a setting', async () => {
    await repos.settings.set('lastGymId', gymId);
    expect(await repos.settings.get('lastGymId')).toBe(gymId);
  });
});
