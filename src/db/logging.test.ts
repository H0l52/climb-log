import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';
import { AUTO_CLOSE_MS } from '../domain/sessions';
import { byRecency } from '../domain/walls';

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;
const gymId = seed.gyms[0]!.id;
const otherGymId = seed.gyms[1]!.id;
const bouldersOf = (g: string) => seed.walls.filter((w) => w.gymId === g && w.kind === 'boulder').map((w) => w.id);
const [wallA, wallB] = bouldersOf(gymId) as [string, string];
const otherWall = bouldersOf(otherGymId)[0]!;
const boardWall = seed.walls.find((w) => w.kind === 'board')!.id;
const [band1, band2] = seed.gradeBands.map((b) => b.id) as [string, string];
const MIN = 60000;

const dump = async () => ({
  problems: await db.problems.orderBy('id').toArray(),
  attempts: await db.attempts.orderBy('id').toArray(),
  sessions: await db.sessions.orderBy('id').toArray(),
});

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

describe('sessions', () => {
  it('logging with no open session starts one for the wall\'s gym', async () => {
    expect(await repos.sessions.open()).toBeNull();
    const { session, attempt } = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    expect(session).toMatchObject({ gymId, date: '2026-11-14', startedAt: FIXED_NOW, endedAt: null });
    expect(attempt.sessionId).toBe(session.id);
    expect((await repos.sessions.open())?.id).toBe(session.id);
    expect(await repos.settings.get('lastGymId')).toBe(gymId);
  });

  it('later climbs join the open session; only one session is open at a time', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    clock.advance(MIN);
    const b = await repos.logging.logNew({ wallId: wallB, gradeBandId: band2, tries: 2, success: false });
    expect(b.session.id).toBe(a.session.id);
    expect(await repos.sessions.start(gymId)).toMatchObject({ id: a.session.id });
    expect(await db.sessions.count()).toBe(1);
  });

  it('logging at another gym ends the open session and starts one there', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    clock.advance(30 * MIN);
    const b = await repos.logging.logNew({ wallId: otherWall, gradeBandId: band1, tries: 1, success: true });
    expect(b.session.gymId).toBe(otherGymId);
    expect((await db.sessions.get(a.session.id))?.endedAt).toBe(FIXED_NOW + 30 * MIN);
    expect((await db.sessions.filter((s) => s.endedAt === null).toArray()).map((s) => s.id)).toEqual([b.session.id]);
  });

  it('end closes the session; the next climb starts a new one', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    clock.advance(MIN);
    await repos.sessions.end(a.session.id);
    expect(await repos.sessions.open()).toBeNull();
    expect((await repos.sessions.lastEnded(gymId))?.endedAt).toBe(FIXED_NOW + MIN);
    const b = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    expect(b.session.id).not.toBe(a.session.id);
  });

  it('a session idle for 6 hours is closed at its last entry', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    clock.advance(20 * MIN);
    const last = await repos.logging.logNew({ wallId: wallA, gradeBandId: band2, tries: 1, success: false });
    clock.advance(AUTO_CLOSE_MS - 1);
    await repos.sessions.closeStale();
    expect((await repos.sessions.open())?.id).toBe(a.session.id);
    clock.advance(1);
    await repos.sessions.closeStale();
    expect(await repos.sessions.open()).toBeNull();
    expect((await db.sessions.get(a.session.id))?.endedAt).toBe(last.attempt.createdAt);
    const next = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    expect(next.session.id).not.toBe(a.session.id);
  });
});

describe('logging', () => {
  it('stores a flash only for a first single try', async () => {
    const flash = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    expect(flash.attempt.result).toBe('flash');
    expect(flash.problem.status).toBe('sent');
    const send = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 2, success: true });
    expect(send.attempt.result).toBe('send');
    const project = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: false });
    clock.advance(MIN);
    const later = await repos.logging.logAgain({ problemId: project.problem.id, tries: 1, success: true });
    expect(later.attempt.result).toBe('send');
    expect(later.problem.status).toBe('sent');
    expect((await db.attempts.toArray()).filter((a) => a.result === 'flash')).toHaveLength(1);
  });

  it('rejects bad tries, board walls and unknown colours without writing anything', async () => {
    await expect(repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 0, success: true })).rejects.toThrow(/tries/i);
    await expect(repos.logging.logNew({ wallId: boardWall, gradeBandId: band1, tries: 1, success: true })).rejects.toThrow(/boulder/);
    await expect(repos.logging.logNew({ wallId: wallA, gradeBandId: 'nope', tries: 1, success: true })).rejects.toThrow(/colour/);
    expect(await dump()).toEqual({ problems: [], attempts: [], sessions: [] });
  });

  it('a sent problem stays sent, and a repeat is not a new send', async () => {
    const first = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 3, success: true });
    clock.advance(MIN);
    const fail = await repos.logging.logAgain({ problemId: first.problem.id, tries: 1, success: false });
    clock.advance(MIN);
    const repeat = await repos.logging.logAgain({ problemId: first.problem.id, tries: 1, success: true });
    expect(fail.problem.status).toBe('sent');
    expect(repeat.problem.status).toBe('sent');
    expect(repeat.attempt.result).toBe('send');
    const entries = await repos.sessions.entries(first.session.id);
    expect(entries.map((e) => e.attempt.id)).toEqual([repeat.attempt.id, fail.attempt.id, first.attempt.id]);
    expect(entries.filter((e) => e.newSend).map((e) => e.attempt.id)).toEqual([first.attempt.id]);
    expect(await repos.logging.projects(wallA)).toEqual([]);
  });

  it('lists projects on the wall with tries so far, most recent first', async () => {
    const p1 = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 2, success: false, nickname: 'Arete' });
    clock.advance(MIN);
    const p2 = await repos.logging.logNew({ wallId: wallA, gradeBandId: band2, tries: 1, success: false });
    await repos.logging.logNew({ wallId: wallA, gradeBandId: band2, tries: 1, success: true });
    await repos.logging.logNew({ wallId: wallB, gradeBandId: band2, tries: 1, success: false });
    clock.advance(MIN);
    await repos.logging.logAgain({ problemId: p1.problem.id, tries: 3, success: false });
    expect((await repos.logging.projects(wallA)).map((r) => [r.problem.id, r.tries])).toEqual([[p1.problem.id, 5], [p2.problem.id, 1]]);
    const entries = await repos.sessions.entries(p1.session.id);
    expect(entries[0]).toMatchObject({ wall: { id: wallA }, problem: { nickname: 'Arete' }, newSend: false });
  });

  it('remembers the most recently used wall order per gym', async () => {
    await repos.logging.logNew({ wallId: wallB, gradeBandId: band1, tries: 1, success: true });
    clock.advance(MIN);
    await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    const used = (await repos.settings.get<Record<string, number>>('wallLastUsed'))!;
    const order = byRecency(await repos.walls.listForGym(gymId), used).map((w) => w.id);
    expect(order.slice(0, 2)).toEqual([wallA, wallB]);
  });

  it('a wall added from the picker belongs to the current gym and can be logged on', async () => {
    const wall = await repos.walls.add({ gymId: otherGymId, name: 'Cave two', kind: 'boulder' });
    expect((await repos.walls.listForGym(otherGymId)).map((w) => w.id)).toContain(wall.id);
    expect((await repos.walls.listForGym(gymId)).map((w) => w.id)).not.toContain(wall.id);
    const { session, problem } = await repos.logging.logNew({ wallId: wall.id, gradeBandId: band1, tries: 1, success: false });
    expect(session.gymId).toBe(otherGymId);
    expect((await repos.logging.projects(wall.id)).map((r) => r.problem.id)).toEqual([problem.id]);
    expect(byRecency(await repos.walls.listForGym(otherGymId), (await repos.settings.get<Record<string, number>>('wallLastUsed'))!)[0]!.id).toBe(wall.id);
  });
});

describe('edit and delete', () => {
  it('editing an entry re-labels the result and re-derives the status', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    await repos.logging.updateEntry(a.attempt.id, { tries: 3, success: true });
    expect(await db.attempts.get(a.attempt.id)).toMatchObject({ tries: 3, result: 'send' });
    await repos.logging.updateEntry(a.attempt.id, { tries: 3, success: false, gradeBandId: band2 });
    expect(await db.problems.get(a.problem.id)).toMatchObject({ status: 'project', gradeBandId: band2 });
    await repos.logging.updateEntry(a.attempt.id, { tries: 1, success: true });
    expect(await db.attempts.get(a.attempt.id)).toMatchObject({ tries: 1, result: 'flash' });
    expect((await db.problems.get(a.problem.id))?.status).toBe('sent');
    await expect(repos.logging.updateEntry(a.attempt.id, { tries: 0, success: true })).rejects.toThrow(/tries/i);
  });

  it('a later entry can never become a flash by editing', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: false });
    clock.advance(MIN);
    const b = await repos.logging.logAgain({ problemId: a.problem.id, tries: 2, success: true });
    await repos.logging.updateEntry(b.attempt.id, { tries: 1, success: true });
    expect((await db.attempts.get(b.attempt.id))?.result).toBe('send');
  });

  it('deleting a problem\'s only entry removes the problem; Undo restores both exactly', async () => {
    await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 1, success: true });
    clock.advance(MIN);
    const b = await repos.logging.logNew({ wallId: wallB, gradeBandId: band2, tries: 4, success: false, nickname: 'Dyno', styleTags: ['dyno'], felt: 'hard', notes: 'left heel' });
    const before = await dump();
    const deleted = await repos.logging.deleteEntry(b.attempt.id);
    expect(await db.problems.get(b.problem.id)).toBeUndefined();
    expect(await db.attempts.count()).toBe(1);
    clock.advance(MIN);
    await repos.logging.restoreEntry(deleted);
    expect(await dump()).toEqual(before);
  });

  it('deleting the sending entry returns the problem to project; Undo restores it exactly', async () => {
    const a = await repos.logging.logNew({ wallId: wallA, gradeBandId: band1, tries: 2, success: false });
    clock.advance(MIN);
    const b = await repos.logging.logAgain({ problemId: a.problem.id, tries: 1, success: true });
    const before = await dump();
    const deleted = await repos.logging.deleteEntry(b.attempt.id);
    expect((await db.problems.get(a.problem.id))?.status).toBe('project');
    expect(await db.attempts.count()).toBe(1);
    await repos.logging.restoreEntry(deleted);
    expect(await dump()).toEqual(before);
  });
});
