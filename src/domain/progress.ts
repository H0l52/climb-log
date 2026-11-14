import type { ID, ISODate } from '../db/types';
import { addDays, addMonths, daysBetween, formatMonth, formatShort, monthStart, weekStart } from './dates';
import {
  type DateWindow, type MetricInput, type StyleRow,
  filterByGym, flashesByBand, overallFlashRate, problemFacts, rate, scoreInWindow, sendsByBand, styleBreakdown,
  totalSends, weeklyStreak, workingGrade,
} from './metrics';

/** Progress screen model. Pure: everything the screen shows comes from progressView(). */

export type RangeKey = '6w' | '3m' | 'year' | 'all';
export const RANGES: readonly { key: RangeKey; label: string }[] = [
  { key: '6w', label: '6 weeks' },
  { key: '3m', label: '3 months' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

/** Beyond this many weekly buckets, aggregate to months (charts skill). */
export const MAX_WEEKS = 26;

export interface Bucket extends DateWindow {
  label: string;
}

export type BucketKind = 'week' | 'month';

/** Start of the range (inclusive; it always ends today) and how it is bucketed. */
export function rangeWindow(range: RangeKey, today: ISODate, earliest: ISODate | null): { window: DateWindow; kind: BucketKind } {
  const thisWeek = weekStart(today);
  switch (range) {
    case '6w':
      return { window: { from: addDays(thisWeek, -5 * 7), to: today }, kind: 'week' };
    case '3m':
      return { window: { from: addDays(thisWeek, -12 * 7), to: today }, kind: 'week' };
    case 'year':
      return { window: { from: addMonths(today, -11), to: today }, kind: 'month' };
    case 'all': {
      const start = earliest && earliest < today ? earliest : today;
      const weeks = daysBetween(weekStart(start), thisWeek) / 7 + 1;
      return weeks <= MAX_WEEKS
        ? { window: { from: weekStart(start), to: today }, kind: 'week' }
        : { window: { from: monthStart(start), to: today }, kind: 'month' };
    }
  }
}

/** Every bucket in the window, empty ones included. Weeks start Monday. */
export function bucketsFor(window: DateWindow, kind: BucketKind): Bucket[] {
  const out: Bucket[] = [];
  let from = kind === 'week' ? weekStart(window.from) : monthStart(window.from);
  while (from <= window.to) {
    const next = kind === 'week' ? addDays(from, 7) : addMonths(from, 1);
    const to = addDays(next, -1);
    out.push({ from, to: to < window.to ? to : window.to, label: kind === 'week' ? formatShort(from) : formatMonth(from) });
    from = next;
  }
  return out;
}

/** The window of the same length just before this one, for tile deltas. */
export function previousWindow(w: DateWindow): DateWindow {
  const days = daysBetween(w.from, w.to) + 1;
  return { from: addDays(w.from, -days), to: addDays(w.from, -1) };
}

/** Up to three colours around `centre` (its neighbours by order), shifted inward at either end. */
export function neighbourBands(orderedIds: readonly ID[], centre: ID | null): ID[] {
  const i = centre === null ? -1 : orderedIds.indexOf(centre);
  if (i < 0) return [];
  const start = Math.max(0, Math.min(i - 1, orderedIds.length - 3));
  return orderedIds.slice(start, start + 3);
}

export interface ProgressTiles {
  workingGrade: ID | null;
  sends: number;
  /** Change versus the previous period of the same length; null for "All". */
  sendsDelta: number | null;
  flashRate: number | null;
  /** In percentage points; null when either period has no sends, or for "All". */
  flashRateDelta: number | null;
  streak: number;
}

export interface ProgressView {
  window: DateWindow;
  kind: BucketKind;
  buckets: Bucket[];
  tiles: ProgressTiles;
  /** Sends per colour, one record per bucket. */
  sendsPerBucket: Record<ID, number>[];
  /** Sends per colour over the whole range. */
  pyramid: Record<ID, number>;
  /** Colours with any send in the range, easiest first. */
  sentBands: ID[];
  /** Colours shown by default on the flash trend: the working grade and its neighbours. */
  trendBands: ID[];
  /** Flash rate per bucket for every colour with sends in the range; null = no sends that bucket. */
  flashTrend: Record<ID, (number | null)[]>;
  styles: StyleRow[];
  /** Points from new sends per bucket (0 is a real zero: nothing sent). */
  scores: number[];
  /** Buckets with at least one session; under 3 shows "keep logging" instead of trend lines. */
  activeBuckets: number;
  /** Nothing logged at all under the gym filter. */
  empty: boolean;
}

export interface ProgressFilter {
  gymId: ID | null;
  range: RangeKey;
  today: ISODate;
}

export function progressView(all: MetricInput, filter: ProgressFilter): ProgressView {
  const input = filterByGym(all, filter.gymId);
  const facts = problemFacts(input);
  const earliest = facts.reduce<ISODate | null>((m, f) => (m === null || f.firstDate < m ? f.firstDate : m), null);
  const { window, kind } = rangeWindow(filter.range, filter.today, earliest);
  const buckets = bucketsFor(window, kind);
  const ordered = [...input.bands].sort((a, b) => a.order - b.order).map((b) => b.id);

  const sends = totalSends(input, window);
  const flashRate = overallFlashRate(input, window);
  const prev = filter.range === 'all' ? null : previousWindow(window);
  const prevRate = prev ? overallFlashRate(input, prev) : null;

  const pyramid = sendsByBand(input, window);
  const sentBands = ordered.filter((id) => pyramid[id]);
  const wg = workingGrade(input, filter.today);
  // Centre the trend on the working grade, else on the colour sent most in the range.
  const busiest = sentBands.reduce<ID | null>((m, id) => (m === null || pyramid[id]! >= pyramid[m]! ? id : m), null);
  const trendBands = neighbourBands(ordered, wg ?? busiest).filter((id) => pyramid[id]);

  const sendsPerBucket = buckets.map((b) => sendsByBand(input, b));
  const flashesPerBucket = buckets.map((b) => flashesByBand(input, b));
  const flashTrend = Object.fromEntries(
    sentBands.map((id) => [id, buckets.map((_, i) => rate(flashesPerBucket[i]![id] ?? 0, sendsPerBucket[i]![id] ?? 0))]),
  );

  const sessionDates = (input.sessions ?? []).map((s) => s.date);
  const activeBuckets = buckets.filter((b) => sessionDates.some((d) => d >= b.from && d <= b.to)).length;

  return {
    window,
    kind,
    buckets,
    tiles: {
      workingGrade: wg,
      sends,
      sendsDelta: prev ? sends - totalSends(input, prev) : null,
      flashRate,
      flashRateDelta: flashRate !== null && prevRate !== null ? Math.round(flashRate * 100) - Math.round(prevRate * 100) : null,
      streak: weeklyStreak(sessionDates, filter.today),
    },
    sendsPerBucket,
    pyramid,
    sentBands,
    trendBands,
    flashTrend,
    styles: styleBreakdown(input, window),
    scores: buckets.map((b) => scoreInWindow(input, b)),
    activeBuckets,
    empty: facts.length === 0 && sessionDates.length === 0,
  };
}

/** "–" for an undefined rate (never NaN, Infinity or 0%), else a whole percentage. */
export function formatRate(r: number | null | undefined): string {
  return r === null || r === undefined || !Number.isFinite(r) ? '–' : `${Math.round(r * 100)}%`;
}

/** "+3", "−2", "±0"; "" when there is nothing to compare with. */
export function formatDelta(d: number | null, unit = ''): string {
  if (d === null || !Number.isFinite(d)) return '';
  if (d === 0) return `±0${unit}`;
  return `${d > 0 ? '+' : '−'}${Math.abs(d)}${unit}`;
}
