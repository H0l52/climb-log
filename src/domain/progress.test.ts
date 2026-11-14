import { describe, expect, it } from 'vitest';
import type { Attempt, Problem } from '../db/types';
import { addMonths, formatShort, melbourneDate, monthStart, weekStart } from './dates';
import { melbourneInstant } from './__fixtures__/metricsFixture';
import { flashRateByBand, overallFlashRate, weeklyStreak } from './metrics';
import { bucketsFor, formatDelta, formatRate, neighbourBands, progressView, rangeWindow } from './progress';
import { newSession } from './sessions';

describe('weeks and months', () => {
  it('weeks start Monday', () => {
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // Monday
    expect(weekStart('2026-11-14')).toBe('2026-11-09'); // Saturday
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(weekStart('2027-01-02')).toBe('2026-12-28'); // across the year boundary
  });
  it('month arithmetic', () => {
    expect(monthStart('2026-11-14')).toBe('2026-11-01');
    expect(addMonths('2026-11-14', -11)).toBe('2025-12-01');
    expect(addMonths('2026-12-31', 1)).toBe('2027-01-01');
    expect(formatShort('2026-11-03')).toBe('3 Nov');
  });
});

describe('weekly streak', () => {
  const at = (date: string, h: number, m = 0) => melbourneDate(melbourneInstant(date, h, m));

  it('the current week in progress does not break the streak', () => {
    expect(weeklyStreak(['2026-11-03', '2026-10-27'], '2026-11-11')).toBe(2);
    expect(weeklyStreak(['2026-11-03', '2026-10-27', '2026-11-10'], '2026-11-11')).toBe(3);
  });
  it('an empty week breaks it; no sessions is 0', () => {
    expect(weeklyStreak(['2026-10-20'], '2026-11-11')).toBe(0);
    expect(weeklyStreak([], '2026-11-11')).toBe(0);
  });
  it('a session just after midnight on the Monday clocks go forward (4 Oct 2026) starts the new week', () => {
    const instant = melbourneInstant('2026-10-05', 0, 30); // AEDT: 13:30 UTC on Sunday
    expect(new Date(instant).getUTCDay()).toBe(0);
    const session = newSession('gym', instant, 's');
    expect(session.date).toBe('2026-10-05');
    expect(weekStart(session.date)).toBe('2026-10-05');
    // Sunday night before the change and Monday after: two weeks.
    expect(weeklyStreak([at('2026-10-04', 23, 30), session.date], '2026-10-07')).toBe(2);
    expect(weeklyStreak([at('2026-10-04', 23, 30)], '2026-10-07')).toBe(1);
  });
  it('the week clocks go back (5 Apr 2026) is still Monday to Sunday', () => {
    const sundayNight = at('2026-04-05', 23, 30);
    const mondayEarly = at('2026-04-06', 0, 30);
    expect([sundayNight, mondayEarly]).toEqual(['2026-04-05', '2026-04-06']);
    expect(weeklyStreak([sundayNight], '2026-04-08')).toBe(1);
    expect(weeklyStreak([mondayEarly], '2026-04-08')).toBe(1);
    expect(weeklyStreak([at('2026-03-30', 19), sundayNight, mondayEarly], '2026-04-08')).toBe(2);
  });
  it('counts across a year boundary (week of 28 Dec 2026 – 3 Jan 2027)', () => {
    expect(weeklyStreak(['2026-12-22', '2027-01-02', '2027-01-06'], '2027-01-08')).toBe(3);
    expect(weeklyStreak(['2026-12-22', '2026-12-31'], '2027-01-03')).toBe(2);
    expect(weeklyStreak(['2026-12-22', '2027-01-06'], '2027-01-08')).toBe(1);
  });
});

describe('ranges and buckets', () => {
  it('6 weeks and 3 months are weekly; year is monthly', () => {
    expect(bucketsFor(rangeWindow('6w', '2026-11-14', null).window, 'week')).toHaveLength(6);
    expect(rangeWindow('3m', '2026-11-14', null)).toEqual({ window: { from: '2026-08-17', to: '2026-11-14' }, kind: 'week' });
    const year = rangeWindow('year', '2026-11-14', null);
    expect(year.kind).toBe('month');
    const months = bucketsFor(year.window, year.kind);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ from: '2025-12-01', to: '2025-12-31', label: 'Dec' });
    expect(months.at(-1)).toEqual({ from: '2026-11-01', to: '2026-11-14', label: 'Nov' });
  });
  it('all switches to months beyond 26 weeks', () => {
    expect(rangeWindow('all', '2026-11-14', '2026-05-18').kind).toBe('week'); // 26 weeks
    expect(rangeWindow('all', '2026-11-14', '2026-05-17').kind).toBe('month'); // 27 weeks
    expect(rangeWindow('all', '2026-11-14', null).window).toEqual({ from: '2026-11-09', to: '2026-11-14' });
  });
  it('trend colours: the centre and its neighbours, shifted at the ends', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(neighbourBands(ids, 'c')).toEqual(['b', 'c', 'd']);
    expect(neighbourBands(ids, 'a')).toEqual(['a', 'b', 'c']);
    expect(neighbourBands(ids, 'e')).toEqual(['c', 'd', 'e']);
    expect(neighbourBands(ids, null)).toEqual([]);
  });
});

describe('undefined rates', () => {
  const p: Problem = { id: 'p', wallSetId: 's', gradeBandId: 'x', nickname: null, photoId: null, styleTags: [], status: 'project', createdAt: 0 };
  const a: Attempt = { id: 'a', problemId: 'p', sessionId: 's1', tries: 3, result: 'fail', felt: null, notes: null, createdAt: melbourneInstant('2026-11-10', 18) };
  const input = { problems: [p], attempts: [a], bands: [{ id: 'x', order: 1 }], sessions: [{ id: 's1', gymId: 'g', date: '2026-11-10', startedAt: a.createdAt }] };

  it('zero sends give null, not 0, NaN or Infinity', () => {
    expect(flashRateByBand(input)).toEqual({ x: null });
    expect(overallFlashRate(input)).toBeNull();
    const v = progressView(input, { gymId: null, range: '6w', today: '2026-11-14' });
    expect(v.tiles.flashRate).toBeNull();
    expect(v.tiles.flashRateDelta).toBeNull();
    expect(v.tiles.sends).toBe(0);
    expect(v.empty).toBe(false);
  });
  it('display "–" for anything undefined', () => {
    expect(formatRate(null)).toBe('–');
    expect(formatRate(undefined)).toBe('–');
    expect(formatRate(NaN)).toBe('–');
    expect(formatRate(Infinity)).toBe('–');
    expect(formatRate(0 / 0)).toBe('–');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(0.555)).toBe('56%');
    expect(formatRate(1)).toBe('100%');
  });
  it('deltas', () => {
    expect(formatDelta(null)).toBe('');
    expect(formatDelta(NaN)).toBe('');
    expect(formatDelta(3)).toBe('+3');
    expect(formatDelta(-40, ' pts')).toBe('−40 pts');
    expect(formatDelta(0)).toBe('±0');
  });
  it('an empty log is empty', () => {
    const v = progressView({ problems: [], attempts: [], bands: [], sessions: [] }, { gymId: null, range: 'all', today: '2026-11-14' });
    expect(v.empty).toBe(true);
    expect(v.buckets).toHaveLength(1);
    expect(v.tiles).toEqual({ workingGrade: null, sends: 0, sendsDelta: null, flashRate: null, flashRateDelta: null, streak: 0 });
  });
});
