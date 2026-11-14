import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import type { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;
const MIN = 60_000;
const gymId = seed.gyms[0]!.id;
const wallId = seed.walls.find((w) => w.gymId === gymId && w.kind === 'boulder')!.id;
const [easy, hard] = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.id) as [string, string];

beforeEach(async () => {
  db = freshDb();
  clock = testClock();
  repos = reposFor(db, clock);
  await applySeed(db, seed, { now: FIXED_NOW - 30 * 86_400_000 });
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const goal = async (id: string) => (await db.goals.get(id))!;

describe('first send of colour goal', () => {
  it('completes at the moment the matching send is logged, in the same write', async () => {
    const g = await repos.goals.add({ type: 'first-send-of-colour', gradeBandId: hard, target: 1, deadline: null });
    expect(g.achievedAt).toBeNull();

    clock.advance(MIN);
    await repos.logging.logNew({ wallId, gradeBandId: easy, tries: 1, success: true }); // other colour
    clock.advance(MIN);
    const miss = await repos.logging.logNew({ wallId, gradeBandId: hard, tries: 2, success: false }); // not yet
    expect((await goal(g.id)).achievedAt).toBeNull();

    clock.advance(MIN);
    const sent = await repos.logging.logAgain({ problemId: miss.problem.id, tries: 1, success: true });
    expect((await goal(g.id)).achievedAt).toBe(sent.attempt.createdAt);
    expect(sent.attempt.createdAt).toBe(clock.now());
  });

  it('a flash of a new problem completes it too', async () => {
    const g = await repos.goals.add({ type: 'first-send-of-colour', gradeBandId: hard, target: 1, deadline: null });
    clock.advance(MIN);
    const flash = await repos.logging.logNew({ wallId, gradeBandId: hard, tries: 1, success: true });
    expect((await goal(g.id)).achievedAt).toBe(flash.attempt.createdAt);
  });

  it('undoing the send un-completes it; restoring completes it again', async () => {
    const g = await repos.goals.add({ type: 'first-send-of-colour', gradeBandId: hard, target: 1, deadline: null });
    clock.advance(MIN);
    const flash = await repos.logging.logNew({ wallId, gradeBandId: hard, tries: 1, success: true });
    const deleted = await repos.logging.deleteEntry(flash.attempt.id);
    expect((await goal(g.id)).achievedAt).toBeNull();
    await repos.logging.restoreEntry(deleted);
    expect((await goal(g.id)).achievedAt).toBe(flash.attempt.createdAt);
    await repos.logging.updateEntry(flash.attempt.id, { tries: 1, success: false });
    expect((await goal(g.id)).achievedAt).toBeNull();
  });
});

describe('other goals', () => {
  it('sessions a week completes when the session that meets it starts', async () => {
    const g = await repos.goals.add({ type: 'sessions-per-week', gradeBandId: null, target: 2, deadline: null });
    clock.advance(MIN);
    const s1 = await repos.sessions.start(gymId);
    await repos.sessions.end(s1.id);
    expect((await goal(g.id)).achievedAt).toBeNull();
    clock.advance(MIN);
    const s2 = await repos.sessions.start(gymId);
    expect((await goal(g.id)).achievedAt).toBe(s2.startedAt);
  });

  it('rejects an unknown colour; remove and restore keep the goal intact', async () => {
    await expect(repos.goals.add({ type: 'sends-of-colour', gradeBandId: 'nope', target: 3, deadline: null })).rejects.toThrow('Pick a colour');
    const g = await repos.goals.add({ type: 'sends-of-colour', gradeBandId: easy, target: 3, deadline: null });
    const removed = await repos.goals.remove(g.id);
    expect(await db.goals.count()).toBe(0);
    await repos.goals.restore(removed);
    expect(await goal(g.id)).toEqual(g);
  });
});
