import { describe, expect, it } from 'vitest';
import {
  addAttempt, assertValidEntry, canFlash, createProblemWithFirstAttempt, firstSuccess, nextStatus, resultFor,
  statusFromAttempts, totalTries, triesToSend,
} from './logging';
import { AUTO_CLOSE_MS, autoCloseAt, formatElapsed, newSession, sessionTally } from './sessions';
import { byRecency } from './walls';
import { formatDate } from './dates';
import type { AttemptResult } from '../db/types';

const T0 = Date.UTC(2026, 10, 13, 23, 0, 0); // 2026-11-14 10:00 Melbourne
const base = { wallSetId: 'set-1', gradeBandId: 'band-1', sessionId: 'session-1' };
const first = (tries: number, result: AttemptResult) =>
  createProblemWithFirstAttempt({ ...base, tries, result }, { problemId: 'p1', attemptId: 'a1', now: T0 });
let n = 1;
const again = (state: ReturnType<typeof first>, prior: ReturnType<typeof first>['attempt'][], tries: number, result: AttemptResult) =>
  addAttempt(state.problem, prior, { sessionId: 'session-2', tries, result }, { attemptId: `a${++n}`, now: T0 + n });

describe('flash eligibility', () => {
  it('is only the first entry with one try', () => {
    expect(canFlash(0, 1)).toBe(true);
    expect(canFlash(0, 2)).toBe(false);
    expect(canFlash(1, 1)).toBe(false);
  });

  it('labels a success as flash or send', () => {
    expect(resultFor({ priorEntries: 0, tries: 1, success: true })).toBe('flash');
    expect(resultFor({ priorEntries: 0, tries: 3, success: true })).toBe('send');
    expect(resultFor({ priorEntries: 2, tries: 1, success: true })).toBe('send');
    expect(resultFor({ priorEntries: 0, tries: 1, success: false })).toBe('fail');
  });

  it('rejects a flash with more than one try', () => {
    expect(() => first(2, 'flash')).toThrow(/flash/i);
    expect(() => assertValidEntry({ priorEntries: 0, tries: 2, result: 'flash' })).toThrow(/flash/i);
  });

  it('rejects a flash on a later entry', () => {
    const p = first(1, 'fail');
    expect(() => again(p, [p.attempt], 1, 'flash')).toThrow(/flash/i);
  });

  it('rejects tries below 1 or fractional', () => {
    expect(() => first(0, 'fail')).toThrow(/tries/i);
    expect(() => first(1.5, 'send')).toThrow(/tries/i);
  });
});

describe('create problem + first attempt', () => {
  it('creates both together with matching ids and status', () => {
    const { problem, attempt } = createProblemWithFirstAttempt(
      { ...base, tries: 1, result: 'flash', nickname: '  Pink sloper ', styleTags: ['slab', 'slab'], notes: ' ' },
      { problemId: 'p1', attemptId: 'a1', now: T0 },
    );
    expect(problem).toEqual({
      id: 'p1', wallSetId: 'set-1', gradeBandId: 'band-1', nickname: 'Pink sloper', photoId: null,
      styleTags: ['slab'], status: 'sent', createdAt: T0,
    });
    expect(attempt).toEqual({
      id: 'a1', problemId: 'p1', sessionId: 'session-1', tries: 1, result: 'flash', felt: null, notes: null, createdAt: T0,
    });
  });

  it('a failed first entry makes a project', () => {
    expect(first(3, 'fail').problem.status).toBe('project');
    expect(first(3, 'send').problem.status).toBe('sent');
  });
});

describe('status transitions', () => {
  it('project → sent on first success', () => {
    const p = first(2, 'fail');
    const second = again(p, [p.attempt], 1, 'fail');
    expect(second.problem.status).toBe('project');
    const third = again(second, [p.attempt, second.attempt], 2, 'send');
    expect(third.problem.status).toBe('sent');
    expect(third.attempt.problemId).toBe('p1');
  });

  it('a sent problem never returns to project, and repeats add no sends', () => {
    const p = first(1, 'flash');
    const fail = again(p, [p.attempt], 2, 'fail');
    expect(fail.problem.status).toBe('sent');
    const repeat = again(fail, [p.attempt, fail.attempt], 1, 'send');
    expect(repeat.problem.status).toBe('sent');
    expect(nextStatus('sent', 'fail')).toBe('sent');
    const all = [p.attempt, fail.attempt, repeat.attempt];
    expect(firstSuccess(all)?.id).toBe(p.attempt.id);
    const tally = sessionTally(all.map((a) => ({ gradeBandId: 'band-1', result: a.result, newSend: firstSuccess(all)?.id === a.id })));
    expect(tally).toMatchObject({ climbs: 3, sends: 1, flashes: 1, notYet: 1 });
  });

  it('an expired problem takes no new entries', () => {
    const p = first(1, 'fail');
    expect(() => addAttempt({ ...p.problem, status: 'expired' }, [p.attempt], { sessionId: 's', tries: 1, result: 'send' }, { attemptId: 'x', now: T0 })).toThrow(/reset/);
  });

  it('keeps entries of a problem strictly ordered even on the same millisecond', () => {
    const p = first(1, 'fail');
    const { attempt } = addAttempt(p.problem, [p.attempt], { sessionId: 's', tries: 1, result: 'fail' }, { attemptId: 'x', now: T0 });
    expect(attempt.createdAt).toBeGreaterThan(p.attempt.createdAt);
  });

  it('re-derives status after a correction', () => {
    expect(statusFromAttempts([{ result: 'fail' }], false)).toBe('project');
    expect(statusFromAttempts([{ result: 'fail' }], true)).toBe('expired');
    expect(statusFromAttempts([{ result: 'fail' }, { result: 'send' }], true)).toBe('sent');
  });
});

describe('tries to send', () => {
  it('sums tries up to and including the first success', () => {
    const p = first(3, 'fail');
    const b = again(p, [p.attempt], 2, 'fail');
    const c = again(b, [p.attempt, b.attempt], 4, 'send');
    const d = again(c, [p.attempt, b.attempt, c.attempt], 5, 'send');
    const all = [d.attempt, c.attempt, p.attempt, b.attempt]; // any order
    expect(triesToSend(all)).toBe(9);
    expect(totalTries(all)).toBe(14);
    expect(triesToSend([p.attempt, b.attempt])).toBeNull();
    expect(triesToSend([first(1, 'flash').attempt])).toBe(1);
  });
});

describe('sessions', () => {
  it('a new session is open and dated in Melbourne', () => {
    expect(newSession('g', T0, 's1')).toEqual({ id: 's1', gymId: 'g', date: '2026-11-14', startedAt: T0, endedAt: null, notes: null, energy: null });
  });

  it('auto-closes after 6 idle hours, at the last entry', () => {
    const s = newSession('g', T0, 's1');
    const last = T0 + 90 * 60000;
    expect(autoCloseAt(s, [T0 + 1000, last], last + AUTO_CLOSE_MS - 1)).toBeNull();
    expect(autoCloseAt(s, [last, T0 + 1000], last + AUTO_CLOSE_MS)).toBe(last);
    expect(autoCloseAt(s, [], T0 + AUTO_CLOSE_MS)).toBe(T0);
    expect(autoCloseAt({ ...s, endedAt: T0 + 5 }, [], T0 + 10 * AUTO_CLOSE_MS)).toBeNull();
  });

  it('tallies sends by colour', () => {
    const t = sessionTally([
      { gradeBandId: 'a', result: 'flash', newSend: true },
      { gradeBandId: 'a', result: 'send', newSend: true },
      { gradeBandId: 'b', result: 'fail', newSend: false },
      { gradeBandId: 'b', result: 'send', newSend: false },
    ]);
    expect(t).toEqual({ climbs: 4, sends: 2, flashes: 1, notYet: 1, sendsByBand: { a: 2 } });
  });

  it('formats elapsed time and dates', () => {
    expect(formatElapsed(0)).toBe('0m');
    expect(formatElapsed(48 * 60000 + 59000)).toBe('48m');
    expect(formatElapsed(65 * 60000)).toBe('1h 05m');
    expect(formatDate('2026-11-14')).toBe('Sat 14 Nov');
  });
});

describe('wall picker order', () => {
  it('most recently used first, then by name; retired walls hidden', () => {
    const walls = [
      { id: 'c', name: 'C', active: true },
      { id: 'a', name: 'A', active: true },
      { id: 'b', name: 'B', active: true },
      { id: 'd', name: 'D', active: false },
    ];
    expect(byRecency(walls, { b: 5, c: 9, d: 99 }).map((w) => w.id)).toEqual(['c', 'b', 'a']);
    expect(byRecency(walls, {}).map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });
});
