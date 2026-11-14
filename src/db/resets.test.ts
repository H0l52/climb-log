import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';
import { METRICS, type MetricInput } from '../domain/metrics';

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;
const DAY = 86_400_000;
const MIN = 60_000;
const gymId = seed.gyms[0]!.id;
const otherGymId = seed.gyms[1]!.id;
const bouldersOf = (g: string) => seed.walls.filter((w) => w.gymId === g && w.kind === 'boulder').map((w) => w.id);
const [wallA, wallB] = bouldersOf(gymId) as [string, string];
const otherWall = bouldersOf(otherGymId)[0]!;
const boardWall = seed.walls.find((w) => w.kind === 'board')!.id;
const [band1, band2, band3] = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.id) as [string, string, string];

/** First launch 20 days before "now", so every seeded set is dated 2026-10-25. */
const SEEDED_AT = FIXED_NOW - 20 * DAY;

const dump = async () => ({
  wallSets: await db.wallSets.orderBy('id').toArray(),
  problems: await db.problems.orderBy('id').toArray(),
  attempts: await db.attempts.orderBy('id').toArray(),
  sessions: await db.sessions.orderBy('id').toArray(),
  walls: await db.walls.orderBy('id').toArray(),
});

const metricsNow = async () => {
  const input: MetricInput = {
    problems: await db.problems.toArray(),
    attempts: await db.attempts.toArray(),
    bands: await db.gradeBands.toArray(),
  };
  return Object.fromEntries(Object.entries(METRICS).map(([k, f]) => [k, f(input)]));
};

/**
 * Fixture dataset over two sessions: on wall A a flash, a multi-try send, a repeat of a sent problem and
 * two projects (one with several entries); on wall B a send and a project; at the other gym a project.
 */
async function buildFixture() {
  const log = repos.logging;
  // Session 1, a week ago, at the first gym.
  clock.advance(-7 * DAY);
  const flash = await log.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
  clock.advance(MIN);
  const multi = await log.logNew({ wallId: wallA, gradeBandId: band2, tries: 3, success: true });
  clock.advance(MIN);
  const proj1 = await log.logNew({ wallId: wallA, gradeBandId: band3, tries: 2, success: false, nickname: 'crimpy' });
  clock.advance(MIN);
  const projB = await log.logNew({ wallId: wallB, gradeBandId: band2, tries: 4, success: false });
  clock.advance(MIN);
  await log.logNew({ wallId: wallB, gradeBandId: band1, tries: 1, success: false });
  clock.advance(MIN);
  await log.logAgain({ problemId: (await log.projects(wallB)).find((p) => p.problem.gradeBandId === band1)!.problem.id, tries: 1, success: true });
  await repos.sessions.end(flash.session.id);
  // Session 2, today: re-try the project, a new project, repeat a sent problem; then the other gym.
  clock.advance(7 * DAY - 5 * MIN);
  await log.logAgain({ problemId: proj1.problem.id, tries: 3, success: false });
  clock.advance(MIN);
  const proj2 = await log.logNew({ wallId: wallA, gradeBandId: band1, tries: 2, success: false });
  clock.advance(MIN);
  await log.logAgain({ problemId: multi.problem.id, tries: 1, success: true });
  clock.advance(MIN);
  const projOther = await log.logNew({ wallId: otherWall, gradeBandId: band2, tries: 1, success: false });
  clock.advance(MIN);
  return { flash, multi, proj1, proj2, projB, projOther };
}

beforeEach(async () => {
  db = freshDb();
  clock = testClock();
  repos = reposFor(db, clock);
  await applySeed(db, seed, { now: SEEDED_AT });
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const setsOf = (wallId: string) => db.wallSets.where('wallId').equals(wallId).toArray();
const current = async (wallId: string) => (await setsOf(wallId)).find((s) => s.retiredDate === null)!;

describe('mark as reset', () => {
  it('expires every project on the wall\'s current set, leaves sent as sent and creates a new current set', async () => {
    const f = await buildFixture();
    const before = await current(wallA);
    expect(before.setDate).toBe('2026-10-25');

    await repos.resets.mark(wallA, '2026-11-13');

    const sets = await setsOf(wallA);
    expect(sets).toHaveLength(2);
    expect(sets.find((s) => s.id === before.id)).toEqual({ ...before, retiredDate: '2026-11-13' });
    const now = await current(wallA);
    expect(now).toMatchObject({ wallId: wallA, setDate: '2026-11-13', retiredDate: null });
    expect(now.id).not.toBe(before.id);

    const status = async (id: string) => (await db.problems.get(id))!.status;
    expect(await status(f.proj1.problem.id)).toBe('expired');
    expect(await status(f.proj2.problem.id)).toBe('expired');
    expect(await status(f.flash.problem.id)).toBe('sent');
    expect(await status(f.multi.problem.id)).toBe('sent');
    // Problems stay on the set they were climbed on.
    expect((await db.problems.get(f.proj1.problem.id))!.wallSetId).toBe(before.id);
  });

  it('never deletes an attempt or a problem', async () => {
    await buildFixture();
    const before = await dump();
    await repos.resets.mark(wallA, '2026-11-14');
    const after = await dump();
    expect(after.attempts).toEqual(before.attempts);
    expect(after.problems.map((p) => p.id)).toEqual(before.problems.map((p) => p.id));
  });

  it('leaves other walls and the other gym untouched', async () => {
    const f = await buildFixture();
    const before = await dump();
    await repos.resets.mark(wallA, '2026-11-13');
    const after = await dump();
    const wallASetIds = new Set([...before.wallSets, ...after.wallSets].filter((s) => s.wallId === wallA).map((s) => s.id));
    const notA = <T extends { wallSetId: string }>(xs: T[]) => xs.filter((p) => !wallASetIds.has(p.wallSetId));
    expect(after.wallSets.filter((s) => s.wallId !== wallA)).toEqual(before.wallSets.filter((s) => s.wallId !== wallA));
    expect(notA(after.problems)).toEqual(notA(before.problems));
    expect(after.sessions).toEqual(before.sessions);
    expect(after.walls).toEqual(before.walls);
    expect((await db.problems.get(f.projB.problem.id))!.status).toBe('project');
    expect((await db.problems.get(f.projOther.problem.id))!.status).toBe('project');
    expect((await repos.logging.projects(wallB)).map((p) => p.problem.id)).toEqual([f.projB.problem.id]);
    expect((await repos.logging.projects(otherWall)).map((p) => p.problem.id)).toEqual([f.projOther.problem.id]);
  });

  it('changes no metric', async () => {
    await buildFixture();
    const before = await metricsNow();
    expect(Object.values(before.sendsByBand as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(3);
    await repos.resets.mark(wallA, '2026-11-13');
    await repos.resets.mark(wallB, '2026-11-14');
    expect(await metricsNow()).toEqual(before);
  });

  it('removes expired projects from the Log climb projects list; new climbs go on the new set', async () => {
    const f = await buildFixture();
    expect((await repos.logging.projects(wallA)).map((p) => p.problem.id).sort()).toEqual([f.proj1.problem.id, f.proj2.problem.id].sort());
    await repos.resets.mark(wallA, '2026-11-13');
    expect(await repos.logging.projects(wallA)).toEqual([]);
    const fresh = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: false });
    expect(fresh.problem.wallSetId).toBe((await current(wallA)).id);
    await expect(repos.logging.logAgain({ problemId: f.proj1.problem.id, tries: 1, success: true })).rejects.toThrow(/reset/);
  });

  it('refuses future dates, dates before the current set, board walls and retired walls', async () => {
    await expect(repos.resets.mark(wallA, '2026-11-15')).rejects.toThrow(/future/);
    await expect(repos.resets.mark(wallA, '2026-10-24')).rejects.toThrow(/before/);
    await expect(repos.resets.mark(boardWall, '2026-11-14')).rejects.toThrow(/boulder/);
    await repos.walls.setActive(wallB, false);
    await expect(repos.resets.mark(wallB, '2026-11-14')).rejects.toThrow(/boulder/);
    expect(await setsOf(wallA)).toHaveLength(1);
  });

  it('defaults to the gym\'s latest set day, in Melbourne time', async () => {
    const days = seed.gyms[0]!.setDays;
    await repos.gyms.setSetDays(gymId, [5]); // Friday
    expect(await repos.resets.defaultDate(wallA)).toBe('2026-11-13'); // Saturday 14 Nov → Friday
    clock.advance(2 * DAY); // Monday 16 Nov
    expect(await repos.resets.defaultDate(wallA)).toBe('2026-11-13');
    await repos.gyms.setSetDays(gymId, []);
    expect(await repos.resets.defaultDate(wallA)).toBe('2026-11-16');
    await repos.gyms.setSetDays(gymId, days);
  });
});

describe('undo reset', () => {
  it('restores every status and the old set, and removes the new set', async () => {
    await buildFixture();
    const before = await dump();
    const record = await repos.resets.mark(wallA, '2026-11-13');
    expect(await repos.resets.undoable(wallA)).toEqual(record);
    await repos.resets.undo(wallA);
    expect(await dump()).toEqual(before);
    expect(await db.wallSets.get(record.newSetId)).toBeUndefined();
    expect(await repos.resets.undoable(wallA)).toBeNull();
  });

  it('keeps climbs logged on the new set, moving them to the restored set', async () => {
    await buildFixture();
    const old = await current(wallA);
    await repos.sessions.start(gymId); // the session the reset happens in
    clock.advance(MIN);
    await repos.resets.mark(wallA, '2026-11-14');
    const fresh = await repos.logging.logNew({ wallId: wallA, gradeBandId: band2, tries: 1, success: true });
    await repos.resets.undo(wallA);
    expect(await db.problems.get(fresh.problem.id)).toMatchObject({ wallSetId: old.id, status: 'sent' });
    expect(await db.attempts.get(fresh.attempt.id)).toEqual(fresh.attempt);
  });

  it('is available until the session ends', async () => {
    const f = await buildFixture();
    await repos.resets.mark(wallA, '2026-11-14');
    clock.advance(MIN);
    await repos.sessions.end(f.projOther.session.id);
    expect(await repos.resets.undoable(wallA)).toBeNull();
    await expect(repos.resets.undo(wallA)).rejects.toThrow(/no longer/);
  });

  it('is available until another reset is made on that wall', async () => {
    await buildFixture();
    clock.advance(-DAY);
    await repos.resets.mark(wallA, '2026-11-13');
    clock.advance(DAY);
    await repos.resets.mark(wallA, '2026-11-14');
    const afterSecond = await dump();
    await repos.resets.undo(wallA); // undoes only the second
    expect(await repos.resets.undoable(wallA)).toBeNull();
    expect((await current(wallA)).setDate).toBe('2026-11-13');
    expect((await dump()).attempts).toEqual(afterSecond.attempts);
  });

  it('a reset on one wall does not affect undo on another', async () => {
    await buildFixture();
    await repos.resets.mark(wallA, '2026-11-14');
    await repos.resets.mark(wallB, '2026-11-14');
    await repos.resets.undo(wallB);
    expect(await repos.resets.undoable(wallA)).not.toBeNull();
  });
});
