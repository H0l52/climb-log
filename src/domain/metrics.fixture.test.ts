import { describe, expect, it } from 'vitest';
import { TODAY, entryAt, fixture } from './__fixtures__/metricsFixture';
import {
  METRICS, filterByGym, firstSendsOfColour, flashRateByBand, flashesByBand, overallFlashRate, scoreInWindow,
  sendRateByBand, sendsByBand, sessionScores, styleBreakdown, totalSends, weeklyStreak, workingGrade,
} from './metrics';
import { progressView } from './progress';

// Every expected value below is worked by hand from the table in __fixtures__/metricsFixture.ts.
const SIX_WEEKS = { from: '2026-10-05', to: TODAY };
const PREV_SIX_WEEKS = { from: '2026-08-24', to: '2026-10-04' };
const A = filterByGym(fixture, 'A');
const B = filterByGym(fixture, 'B');

describe('fixture: sends and flashes', () => {
  it('all time: y P0 P1 P4 P6 P12; b P2 P5 P7 P10 P11; p P3; g none. The P1 repeat is not a send', () => {
    expect(sendsByBand(fixture)).toEqual({ y: 5, b: 5, p: 1 });
    expect(flashesByBand(fixture)).toEqual({ y: 4, b: 3 });
    expect(totalSends(fixture)).toBe(11);
  });
  it('6 weeks drops P0 (1 Sep)', () => {
    expect(sendsByBand(fixture, SIX_WEEKS)).toEqual({ y: 4, b: 5, p: 1 });
    expect(flashesByBand(fixture, SIX_WEEKS)).toEqual({ y: 3, b: 3 });
    expect(totalSends(fixture, PREV_SIX_WEEKS)).toBe(1);
  });
  it('flash rate: y 4/5, b 3/5, p 0/1, g undefined (no sends)', () => {
    expect(flashRateByBand(fixture)).toEqual({ y: 0.8, b: 0.6, p: 0, g: null });
    expect(overallFlashRate(fixture, SIX_WEEKS)).toBe(0.6); // 6 / 10
    expect(overallFlashRate(fixture, PREV_SIX_WEEKS)).toBe(1); // P0
    expect(overallFlashRate(fixture, { from: '2026-10-19', to: '2026-10-25' })).toBeNull(); // the empty week
  });
});

describe('fixture: send rate, working grade, scores', () => {
  it('send rate over problems first attempted: y 5/5, b 5/5, p 1/2 (P8 expired), g 0/1', () => {
    expect(sendRateByBand(fixture)).toEqual({ y: 1, b: 1, p: 0.5, g: 0 });
  });
  it('send rate in the week of 3 Nov: only P8 and P9 were first tried then', () => {
    expect(sendRateByBand(fixture, { from: '2026-11-02', to: '2026-11-08' })).toEqual({ y: null, b: null, p: 0, g: 0 });
  });
  it('working grade over 4 Oct–14 Nov: y 4/4 and b 5/5 qualify, p has 2 attempted → b', () => {
    expect(workingGrade(fixture, TODAY)).toBe('b');
  });
  it('working grade at gym A: y has 2, b has 3 attempted → none', () => {
    expect(workingGrade(A, TODAY)).toBeNull();
  });
  it('session score: new sends weighted 1, 2, 4, 8; S4 sent nothing', () => {
    expect(sessionScores(fixture)).toEqual({ S0: 1, S1: 1, S2: 2 + 1 + 2, S3: 1, S5: 2 + 4, S6: 2 + 2 + 1 });
    expect(scoreInWindow(fixture, SIX_WEEKS)).toBe(1 + 5 + 1 + 6 + 5);
  });
});

describe('fixture: streak, styles, first sends', () => {
  const dates = (input: typeof fixture) => (input.sessions ?? []).map((s) => s.date);
  it('streak: weeks of 9 Nov, 2 Nov, 26 Oct; 19 Oct is empty → 3', () => {
    expect(weeklyStreak(dates(fixture), TODAY)).toBe(3);
    expect(weeklyStreak(dates(A), TODAY)).toBe(2);
    expect(weeklyStreak(dates(B), TODAY)).toBe(1);
  });
  it('style breakdown, weakest first: crimp 1/2, slab 5/6 (across the reset), roof 4/4', () => {
    expect(styleBreakdown(fixture)).toEqual([
      { tag: 'crimp', attempted: 2, sent: 1, rate: 0.5 },
      { tag: 'slab', attempted: 6, sent: 5, rate: 5 / 6 },
      { tag: 'roof', attempted: 4, sent: 4, rate: 1 },
    ]);
    expect(styleBreakdown(fixture, SIX_WEEKS).find((r) => r.tag === 'slab')).toEqual({ tag: 'slab', attempted: 5, sent: 4, rate: 0.8 });
  });
  it('first send of each colour: y P0, b P2 (before P5 in S2), p P3', () => {
    expect(firstSendsOfColour(fixture).map((f) => [f.bandId, f.problemId, f.at])).toEqual([
      ['y', 'P0', entryAt('S0', 0)],
      ['b', 'P2', entryAt('S2', 0)],
      ['p', 'P3', entryAt('S5', 1)],
    ]);
  });
});

describe('fixture: gym filter', () => {
  it('gym A keeps its sessions and the entries logged in them', () => {
    expect(sendsByBand(A, SIX_WEEKS)).toEqual({ y: 2, b: 3, p: 1 });
    expect(overallFlashRate(A, SIX_WEEKS)).toBe(0.5);
    expect(A.problems.map((p) => p.id).sort()).toEqual(['P0', 'P1', 'P10', 'P2', 'P3', 'P4', 'P5', 'P8', 'P9']);
  });
  it('gym B: P6 P7 P11 P12', () => {
    expect(sendsByBand(B)).toEqual({ y: 2, b: 2 });
    expect(overallFlashRate(B)).toBe(0.75);
  });
});

describe('fixture: progress view (6 weeks)', () => {
  const v = progressView(fixture, { gymId: null, range: '6w', today: TODAY });
  it('six Monday buckets, the empty week kept', () => {
    expect(v.buckets.map((b) => b.from)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(v.buckets.at(-1)!.to).toBe(TODAY);
  });
  it('tiles', () => {
    expect(v.tiles).toEqual({ workingGrade: 'b', sends: 10, sendsDelta: 9, flashRate: 0.6, flashRateDelta: -40, streak: 3 });
  });
  it('sends per week, pyramid and score', () => {
    expect(v.sendsPerBucket).toEqual([{ y: 1 }, { b: 2, y: 1 }, {}, { y: 1 }, {}, { b: 3, p: 1, y: 1 }]);
    expect(v.pyramid).toEqual({ y: 4, b: 5, p: 1 });
    expect(v.scores).toEqual([1, 5, 0, 1, 0, 11]);
    expect(v.activeBuckets).toBe(5);
  });
  it('flash trend: gaps where a colour has no sends; centred on the working grade', () => {
    expect(v.sentBands).toEqual(['y', 'b', 'p']);
    expect(v.trendBands).toEqual(['y', 'b', 'p']);
    expect(v.flashTrend).toEqual({
      y: [1, 0, null, 1, null, 1],
      b: [null, 0.5, null, null, null, 2 / 3],
      p: [null, null, null, null, null, 0],
    });
  });
  it('gym B tiles', () => {
    expect(progressView(fixture, { gymId: 'B', range: '6w', today: TODAY }).tiles).toEqual({
      workingGrade: null, sends: 4, sendsDelta: 4, flashRate: 0.75, flashRateDelta: null, streak: 1,
    });
  });
  it('all: weekly from the week of the first entry (31 Aug), 11 buckets, no deltas', () => {
    const all = progressView(fixture, { gymId: null, range: 'all', today: TODAY });
    expect(all.kind).toBe('week');
    expect(all.buckets).toHaveLength(11);
    expect(all.buckets[0]!.from).toBe('2026-08-31');
    expect(all.tiles).toMatchObject({ sends: 11, sendsDelta: null, flashRateDelta: null });
  });
});

describe('fixture: every registered metric', () => {
  it('is covered by a hand-calculated test above', () => {
    expect(Object.keys(METRICS).sort()).toEqual([
      'firstSendsOfColour', 'flashRateByBand', 'flashesByBand', 'overallFlashRate', 'scoreInWindow', 'sendRateByBand',
      'sendsByBand', 'sessionScores', 'styleBreakdown', 'totalSends', 'weeklyStreak', 'workingGrade',
    ]);
  });
});
