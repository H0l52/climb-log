import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import type { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';
import { ORPHAN_GRACE_MS } from '../domain/photos';

const DAY = 86_400_000;
const gymId = seed.gyms[0]!.id;
const [wallA, wallB, wallC] = seed.walls.filter((w) => w.gymId === gymId && w.kind === 'boulder').map((w) => w.id) as [string, string, string];
const band = seed.gradeBands[0]!.id;
const photo = (n: number) => ({ blob: new Blob([new Uint8Array(1000 + n)], { type: 'image/jpeg' }), thumb: new Blob([new Uint8Array(100)], { type: 'image/jpeg' }) });

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;

beforeEach(async () => {
  db = freshDb();
  // Start 200 days back so sets can be retired long ago.
  clock = testClock(FIXED_NOW - 200 * DAY);
  repos = reposFor(db, clock);
  await applySeed(db, seed, { now: clock.now() });
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('photos on problems', () => {
  it('stores the photo with a new problem and on re-log replaces it', async () => {
    const { problem } = await repos.logging.logNew({ wallId: wallA, gradeBandId: band, tries: 1, success: false, photo: photo(1) });
    expect(problem.photoId).not.toBeNull();
    const stored = await repos.photos.get(problem.photoId!);
    expect(stored?.blob.size).toBe(1001);
    clock.advance(60_000);
    await repos.logging.logAgain({ problemId: problem.id, tries: 1, success: false, photo: photo(2) });
    const after = await db.problems.get(problem.id);
    expect(after?.photoId).not.toBe(problem.photoId);
    expect((await repos.photos.get(after!.photoId!))?.blob.size).toBe(1002);
    expect(await repos.photos.usage()).toEqual({ count: 2, bytes: 1001 + 1002 + 200 });
  });

  it('logs without a photo as before', async () => {
    const { problem } = await repos.logging.logNew({ wallId: wallA, gradeBandId: band, tries: 1, success: true });
    expect(problem.photoId).toBeNull();
    expect(await db.photos.count()).toBe(0);
  });
});

describe('photo retention', () => {
  /** Problems with photos on: a set retired 100 days ago, one retired 90 days ago, and a current set. */
  async function build() {
    const old = await repos.logging.logNew({ wallId: wallA, gradeBandId: band, tries: 2, success: false, photo: photo(1) });
    const edge = await repos.logging.logNew({ wallId: wallB, gradeBandId: band, tries: 1, success: true, photo: photo(2) });
    clock.advance(100 * DAY); // FIXED_NOW - 100 days
    await repos.resets.mark(wallA, '2026-08-06'); // 100 days before 2026-11-14
    clock.advance(10 * DAY);
    await repos.resets.mark(wallB, '2026-08-16'); // exactly 90 days before
    const current = await repos.logging.logNew({ wallId: wallC, gradeBandId: band, tries: 1, success: false, photo: photo(3) });
    clock.advance(90 * DAY); // FIXED_NOW
    return { old: old.problem, edge: edge.problem, current: current.problem };
  }

  it('removes only photos past the window and leaves the problems intact', async () => {
    const p = await build();
    const problemsBefore = await db.problems.orderBy('id').toArray();
    const attemptsBefore = await db.attempts.orderBy('id').toArray();

    expect(await repos.photos.applyRetention()).toBe(1);

    expect(await db.photos.get(p.old.photoId!)).toBeUndefined();
    expect(await db.photos.get(p.edge.photoId!)).toBeDefined();
    expect(await db.photos.get(p.current.photoId!)).toBeDefined();
    const problemsAfter = await db.problems.orderBy('id').toArray();
    expect(problemsAfter).toEqual(problemsBefore.map((x) => (x.id === p.old.id ? { ...x, photoId: null } : x)));
    expect(await db.attempts.orderBy('id').toArray()).toEqual(attemptsBefore);
  });

  it('uses the photoRetentionDays setting', async () => {
    const p = await build();
    await repos.settings.set('photoRetentionDays', 30);
    expect(await repos.photos.applyRetention()).toBe(2);
    expect(await db.photos.get(p.current.photoId!)).toBeDefined();
    await repos.settings.set('photoRetentionDays', 365);
    expect(await repos.photos.applyRetention()).toBe(0);
  });

  it('is idempotent', async () => {
    await build();
    await repos.photos.applyRetention();
    expect(await repos.photos.applyRetention()).toBe(0);
  });

  it('sweeps a photo whose problem was deleted, after the undo grace period', async () => {
    const { attempt, problem } = await repos.logging.logNew({ wallId: wallA, gradeBandId: band, tries: 1, success: false, photo: photo(1) });
    await repos.logging.deleteEntry(attempt.id);
    expect(await repos.photos.applyRetention()).toBe(0);
    clock.advance(ORPHAN_GRACE_MS + 1);
    expect(await repos.photos.applyRetention()).toBe(1);
    expect(await db.photos.get(problem.photoId!)).toBeUndefined();
  });
});
