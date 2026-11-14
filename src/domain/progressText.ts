import type { ID } from '../db/types';
import { formatRate, type ProgressView, type RangeKey } from './progress';

/**
 * One-line summaries under each Progress chart (also their accessible descriptions). Pure, so
 * tests can assert the exact text the screen shows for any dataset and filter.
 */

export const RANGE_PHRASE: Record<RangeKey, string> = {
  '6w': 'over 6 weeks',
  '3m': 'over 3 months',
  year: 'over the year',
  all: 'in all',
};

type Names = Record<ID, string>;

const bucketName = (v: ProgressView, i: number) => (v.kind === 'week' ? `week of ${v.buckets[i]!.label}` : v.buckets[i]!.label);

/** Index of the largest value (the latest on a tie); -1 when all are 0. */
function peak(values: readonly number[]): number {
  let best = -1;
  values.forEach((x, i) => {
    if (x > 0 && (best < 0 || x >= values[best]!)) best = i;
  });
  return best;
}

export function sendsSummary(v: ProgressView, range: RangeKey): string {
  if (!v.tiles.sends) return `No sends ${RANGE_PHRASE[range]}`;
  const totals = v.sendsPerBucket.map((b) => Object.values(b).reduce((a, n) => a + n, 0));
  const i = peak(totals);
  return `${v.tiles.sends} ${v.tiles.sends === 1 ? 'send' : 'sends'} ${RANGE_PHRASE[range]} · most in ${bucketName(v, i)} (${totals[i]})`;
}

export function pyramidSummary(v: ProgressView, names: Names): string {
  if (!v.sentBands.length) return 'No sends to build a pyramid yet';
  const most = v.sentBands.reduce((m, id) => (v.pyramid[id]! > v.pyramid[m]! ? id : m));
  const hardest = v.sentBands.at(-1)!;
  return `Most sends: ${names[most]} ${v.pyramid[most]} · hardest sent: ${names[hardest]}`;
}

export function flashSummary(v: ProgressView, names: Names, range: RangeKey, bandId: ID | undefined = v.trendBands.find((id) => id === v.tiles.workingGrade) ?? v.trendBands[0]): string {
  const series = bandId ? v.flashTrend[bandId] : undefined;
  if (!bandId || !series) return 'No sends to show a flash rate yet';
  const defined = series.filter((x): x is number => x !== null);
  if (defined.length === 1) return `Flash rate on ${names[bandId]}: ${formatRate(defined[0])}`;
  return `Flash rate on ${names[bandId]}: ${formatRate(defined[0])} → ${formatRate(defined.at(-1))} ${RANGE_PHRASE[range]}`;
}

export function styleSummary(v: ProgressView): string {
  const w = v.styles[0];
  if (!w) return 'No style tags on climbs in this range';
  return `Weakest style: ${w.tag} ${formatRate(w.rate)} (${w.sent}/${w.attempted})`;
}

export function scoreSummary(v: ProgressView, range: RangeKey): string {
  const total = v.scores.reduce((a, b) => a + b, 0);
  if (!total) return `No points ${RANGE_PHRASE[range]}`;
  const i = peak(v.scores);
  return `${total} points ${RANGE_PHRASE[range]} · best ${bucketName(v, i)} (${v.scores[i]})`;
}
