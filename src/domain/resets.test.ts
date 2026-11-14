import { describe, expect, it } from 'vitest';
import type { Problem, WallSet } from '../db/types';
import { addDays, daysBetween, isoWeekday, melbourneDate } from './dates';
import {
  canUndoReset, currentSet, daysSinceSet, defaultResetDate, isFresh, pastSets, planReset, planUndoReset, resetDateError, setAgeLabel,
} from './resets';

const THU_FRI = [4, 5];
const MON_TUE = [1, 2];

describe('calendar helpers', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-12-28', '2027-01-04')).toBe(7);
    expect(daysBetween('2026-11-14', '2026-11-10')).toBe(-4);
  });

  it('is not shifted by Melbourne daylight saving changes', () => {
    // AEDT starts 2026-10-04 and ends 2027-04-04.
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04');
    expect(daysBetween('2027-04-03', '2027-04-05')).toBe(2);
  });
});

describe('default reset date', () => {
  it('is today when today is a set day', () => {
    expect(isoWeekday('2026-11-13')).toBe(5);
    expect(defaultResetDate(THU_FRI, '2026-11-13')).toBe('2026-11-13');
  });

  it('is the most recent set day earlier in the same week', () => {
    expect(defaultResetDate(THU_FRI, '2026-11-14')).toBe('2026-11-13'); // Sat → Fri
    expect(defaultResetDate(MON_TUE, '2026-11-12')).toBe('2026-11-10'); // Thu → Tue
  });

  it('reaches back across a week boundary (weeks start Monday)', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(defaultResetDate(THU_FRI, '2026-11-16')).toBe('2026-11-13'); // Mon → previous Fri
    expect(defaultResetDate(THU_FRI, '2026-11-18')).toBe('2026-11-13'); // Wed → previous Fri
    expect(defaultResetDate(MON_TUE, '2026-11-15')).toBe('2026-11-10'); // Sun → Tue of the same week
    expect(defaultResetDate([7], '2026-11-21')).toBe('2026-11-15'); // Sat → previous Sun
    expect(defaultResetDate(THU_FRI, '2027-01-04')).toBe('2027-01-01'); // across a year end
  });

  it('uses the Melbourne date, not the UTC date', () => {
    // Sunday 15 Nov 13:30 UTC is Monday 16 Nov 00:30 in Melbourne (AEDT, UTC+11).
    const now = Date.UTC(2026, 10, 15, 13, 30);
    expect(new Date(now).toISOString().slice(0, 10)).toBe('2026-11-15');
    const today = melbourneDate(now);
    expect(today).toBe('2026-11-16');
    expect(defaultResetDate(MON_TUE, today)).toBe('2026-11-16');
    // Monday 23:30 Melbourne (12:30 UTC) is still Monday.
    expect(defaultResetDate(MON_TUE, melbourneDate(Date.UTC(2026, 10, 16, 12, 30)))).toBe('2026-11-16');
    // Sunday 22:00 Melbourne (Sunday 11:00 UTC): last Mon/Tue set day is the previous Tuesday.
    expect(defaultResetDate(MON_TUE, melbourneDate(Date.UTC(2026, 10, 15, 11, 0)))).toBe('2026-11-10');
  });

  it('falls back to today when the gym has no set days', () => {
    expect(defaultResetDate([], '2026-11-14')).toBe('2026-11-14');
  });

  it('is never before the current set', () => {
    expect(defaultResetDate(THU_FRI, '2026-11-14', '2026-11-14')).toBe('2026-11-14');
    expect(defaultResetDate(THU_FRI, '2026-11-14', '2026-11-01')).toBe('2026-11-13');
  });
});

describe('reset date validation', () => {
  it('allows today back to the current set date', () => {
    expect(resetDateError('2026-11-14', '2026-11-14', '2026-11-01')).toBeNull();
    expect(resetDateError('2026-11-01', '2026-11-14', '2026-11-01')).toBeNull();
  });
  it('rejects future dates, dates before the current set and junk', () => {
    expect(resetDateError('2026-11-15', '2026-11-14', '2026-11-01')).toMatch(/future/);
    expect(resetDateError('2026-10-31', '2026-11-14', '2026-11-01')).toMatch(/before/);
    expect(resetDateError('', '2026-11-14', '2026-11-01')).toMatch(/Pick/);
  });
});

const set = (id: string, wallId: string, setDate: string, retiredDate: string | null = null): WallSet => ({ id, wallId, setDate, retiredDate });
const problem = (id: string, wallSetId: string, status: Problem['status']): Problem => ({
  id, wallSetId, gradeBandId: 'band', nickname: null, photoId: null, styleTags: [], status, createdAt: 1,
});

describe('planReset', () => {
  const sets = [set('old', 'w1', '2026-10-01', '2026-11-01'), set('cur', 'w1', '2026-11-01'), set('other', 'w2', '2026-11-01')];
  const problems = [
    problem('p1', 'cur', 'project'),
    problem('p2', 'cur', 'sent'),
    problem('p3', 'cur', 'project'),
    problem('p4', 'old', 'expired'),
    problem('p5', 'other', 'project'),
  ];
  const plan = planReset(sets, problems, { wallId: 'w1', date: '2026-11-13', today: '2026-11-14' }, { newSetId: 'new', now: 100 });

  it('retires the current set on the date and starts a new one', () => {
    expect(plan.retiredSet).toEqual(set('cur', 'w1', '2026-11-01', '2026-11-13'));
    expect(plan.newSet).toEqual(set('new', 'w1', '2026-11-13'));
  });

  it('expires only the projects on that wall\'s current set; sent stays sent', () => {
    expect(plan.expired.map((p) => [p.id, p.status])).toEqual([['p1', 'expired'], ['p3', 'expired']]);
    expect(plan.record.changed).toEqual([{ problemId: 'p1', before: 'project' }, { problemId: 'p3', before: 'project' }]);
  });

  it('refuses a wall with no current set and bad dates', () => {
    expect(() => planReset(sets, problems, { wallId: 'w9', date: '2026-11-13', today: '2026-11-14' }, { newSetId: 'x', now: 1 })).toThrow(/current set/);
    expect(() => planReset(sets, problems, { wallId: 'w1', date: '2026-11-15', today: '2026-11-14' }, { newSetId: 'x', now: 1 })).toThrow(/future/);
    expect(() => planReset(sets, problems, { wallId: 'w1', date: '2026-10-30', today: '2026-11-14' }, { newSetId: 'x', now: 1 })).toThrow(/before/);
  });

  it('undo restores every status and the old set, and removes the new set', () => {
    const after = [...sets.filter((s) => s.id !== 'cur'), plan.retiredSet, plan.newSet];
    const afterProblems = problems.map((p) => plan.expired.find((e) => e.id === p.id) ?? p);
    const undo = planUndoReset(plan.record, after, afterProblems);
    expect(undo.restoredSet).toEqual(set('cur', 'w1', '2026-11-01'));
    expect(undo.removeSetId).toBe('new');
    const restored = afterProblems.map((p) => undo.problems.find((u) => u.id === p.id) ?? p);
    expect(restored).toEqual(problems);
  });

  it('undo moves climbs logged on the new set back to the restored set', () => {
    const after = [...sets.filter((s) => s.id !== 'cur'), plan.retiredSet, plan.newSet];
    const logged = problem('p6', 'new', 'project');
    const undo = planUndoReset(plan.record, after, [...problems, logged]);
    expect(undo.problems.find((p) => p.id === 'p6')).toEqual({ ...logged, wallSetId: 'cur' });
  });

  it('undo leaves a problem the user corrected since the reset', () => {
    const after = [...sets.filter((s) => s.id !== 'cur'), plan.retiredSet, plan.newSet];
    const corrected = [problem('p1', 'cur', 'sent'), problem('p3', 'cur', 'expired')];
    const undo = planUndoReset(plan.record, after, corrected);
    expect(undo.problems.map((p) => [p.id, p.status])).toEqual([['p3', 'project']]);
  });

  describe('canUndoReset', () => {
    const after = [...sets.filter((s) => s.id !== 'cur'), plan.retiredSet, plan.newSet];
    it('is true right after the reset', () => {
      expect(canUndoReset(plan.record, after, [{ endedAt: null }, { endedAt: 50 }])).toBe(true);
    });
    it('is false once a session ends after the reset', () => {
      expect(canUndoReset(plan.record, after, [{ endedAt: 100 }])).toBe(false);
    });
    it('is false once another reset is made on that wall', () => {
      const again = planReset(after, [], { wallId: 'w1', date: '2026-11-14', today: '2026-11-14' }, { newSetId: 'newer', now: 101 });
      const later = [...after.filter((s) => s.id !== 'new'), again.retiredSet, again.newSet];
      expect(canUndoReset(plan.record, later, [])).toBe(false);
      expect(canUndoReset(again.record, later, [])).toBe(true);
    });
    it('is false with no record', () => {
      expect(canUndoReset(undefined, after, [])).toBe(false);
    });
  });
});

describe('set age and fresh badge', () => {
  it('counts calendar days since the set', () => {
    expect(daysSinceSet('2026-11-14', '2026-11-14')).toBe(0);
    expect(daysSinceSet('2026-11-01', '2026-11-14')).toBe(13);
    expect(setAgeLabel('2026-11-14', '2026-11-14')).toBe('Set today');
    expect(setAgeLabel('2026-11-13', '2026-11-14')).toBe('Set 1 day ago');
    expect(setAgeLabel('2026-11-01', '2026-11-14')).toBe('Set 13 days ago');
  });
  it('is fresh for 7 days (0–6 days since set)', () => {
    expect(isFresh('2026-11-14', '2026-11-14')).toBe(true);
    expect(isFresh('2026-11-08', '2026-11-14')).toBe(true);
    expect(isFresh('2026-11-07', '2026-11-14')).toBe(false);
  });
  it('finds current and past sets', () => {
    const sets = [set('a', 'w', '2026-09-01', '2026-10-01'), set('b', 'w', '2026-10-01', '2026-11-01'), set('c', 'w', '2026-11-01'), set('d', 'x', '2026-11-01')];
    expect(currentSet(sets, 'w')?.id).toBe('c');
    expect(pastSets(sets, 'w').map((s) => s.id)).toEqual(['b', 'a']);
  });
});
