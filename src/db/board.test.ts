import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import type { ClimbDB } from './schema';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';
import { loadMetricInput } from './goals';
import { sessionHistory } from './history';
import { METRICS } from '../domain/metrics';
import { progressView } from '../domain/progress';
import { sessionTally } from '../domain/sessions';

const DAY = 86_400_000;
const MIN = 60_000;
const gymId = seed.gyms[0]!.id;
const boulder = seed.walls.find((w) => w.gymId === gymId && w.kind === 'boulder')!.id;
const boards = seed.walls.filter((w) => w.gymId === gymId && w.kind === 'board').map((w) => w.id);
const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.id);

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;

beforeEach(async () => {
  db = freshDb();
  clock = testClock(FIXED_NOW - 20 * DAY);
  repos = reposFor(db, clock);
  await applySeed(db, seed, { now: clock.now() });
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const allMetrics = async () => {
  const input = await loadMetricInput(db);
  return Object.fromEntries(Object.entries(METRICS).map(([k, f]) => [k, f(input)]));
};

describe('board log', () => {
  it('logs on a board wall, starting a session, and refuses boulder walls', async () => {
    const log = await repos.board.log({ wallId: boards[0]!, climbName: 'Crimp ladder', angle: 40, vGrade: 5, tries: 2, success: true });
    const open = await repos.sessions.open();
    expect(open?.gymId).toBe(gymId);
    expect(log.sessionId).toBe(open?.id);
    await expect(repos.board.log({ wallId: boulder, tries: 1, success: true })).rejects.toThrow('Pick a board');
  });

  it('board entries appear in session history', async () => {
    await repos.logging.logNew({ wallId: boulder, gradeBandId: bands[0]!, tries: 1, success: true });
    clock.advance(MIN);
    const b1 = await repos.board.log({ wallId: boards[0]!, angle: 40, vGrade: 5, tries: 2, success: true });
    clock.advance(MIN);
    const b2 = await repos.board.log({ wallId: boards[1]!, tries: 1, success: false });
    const session = (await repos.sessions.open())!;
    const history = await sessionHistory(db);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ climbs: 1, board: 2, session: { id: session.id } });
    const rows = await repos.board.forSession(session.id);
    expect(rows.map((r) => r.log.id)).toEqual([b2.id, b1.id]);
    expect(rows[0]!.wall?.id).toBe(boards[1]);
  });

  it('board entries are excluded from every colour metric and the session tally', async () => {
    // A boulder history across three weeks.
    for (let week = 0; week < 3; week++) {
      for (const [i, band] of bands.slice(0, 4).entries()) {
        await repos.logging.logNew({ wallId: boulder, gradeBandId: band, tries: i + 1, success: i % 2 === 0 });
        clock.advance(MIN);
      }
      clock.advance(7 * DAY);
    }
    const session = (await repos.sessions.open())!;
    const metricsBefore = await allMetrics();
    const progressBefore = progressView(await loadMetricInput(db), { gymId: null, range: 'all', today: '2026-11-14' });
    const tallyBefore = sessionTally((await repos.sessions.entries(session.id)).map((e) => ({ gradeBandId: e.problem.gradeBandId, result: e.attempt.result, newSend: e.newSend })));

    // Board climbs in the same session and in a board-only session.
    for (let i = 0; i < 6; i++) {
      await repos.board.log({ wallId: boards[i % 2]!, vGrade: i, angle: 40, tries: 1, success: true });
      clock.advance(MIN);
    }
    await repos.sessions.end(session.id);
    clock.advance(DAY);
    await repos.board.log({ wallId: boards[0]!, vGrade: 8, tries: 3, success: true });

    expect(await db.boardLogs.count()).toBe(7);
    // Every colour metric is unchanged. The week streak counts sessions (a board-only visit is still a visit, decision 54).
    const colourAfter = await allMetrics();
    const colourBefore = { ...metricsBefore };
    delete colourAfter.weeklyStreak;
    delete colourBefore.weeklyStreak;
    expect(Object.keys(colourAfter).length).toBe(Object.keys(METRICS).length - 1);
    expect(colourAfter).toEqual(colourBefore);
    const progressAfter = progressView(await loadMetricInput(db), { gymId: null, range: 'all', today: '2026-11-14' });
    // Sessions themselves still count (streaks, session goals); every colour figure is unchanged.
    expect({ ...progressAfter, tiles: { ...progressAfter.tiles, streak: 0 } }).toEqual({ ...progressBefore, tiles: { ...progressBefore.tiles, streak: 0 } });
    const tallyAfter = sessionTally((await repos.sessions.entries(session.id)).map((e) => ({ gradeBandId: e.problem.gradeBandId, result: e.attempt.result, newSend: e.newSend })));
    expect(tallyAfter).toEqual(tallyBefore);
    expect(Object.keys(await loadMetricInput(db))).not.toContain('boardLogs');
  });

  it('delete and undo restore the entry exactly', async () => {
    const log = await repos.board.log({ wallId: boards[0]!, climbName: 'x', tries: 1, success: true });
    const removed = await repos.board.remove(log.id);
    expect(await db.boardLogs.count()).toBe(0);
    await repos.board.restore(removed);
    expect(await db.boardLogs.get(log.id)).toEqual(log);
  });
});
