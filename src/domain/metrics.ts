import type { Attempt, GradeBand, ID, ISODate, Problem } from '../db/types';
import { melbourneDate } from './dates';
import { firstSuccess, inOrder } from './logging';

/**
 * Metrics from docs/data-model.md, "Metrics". Pure functions over arrays.
 * Phase 3 stubs the core ones so the reset test can prove a reset never changes them;
 * Phase 4 completes this module and must keep every metric listed in METRICS.
 *
 * Every metric is derived from attempts (who sent what, when), never from Problem.status,
 * so expiring a project cannot change history.
 */

export interface MetricInput {
  problems: readonly Problem[];
  attempts: readonly Attempt[];
  bands: readonly Pick<GradeBand, 'id' | 'order'>[];
}

export interface DateWindow {
  from: ISODate; // inclusive
  to: ISODate; // inclusive
}

const inWindow = (at: number, w?: DateWindow) => {
  if (!w) return true;
  const d = melbourneDate(at);
  return d >= w.from && d <= w.to;
};

function byProblem(attempts: readonly Attempt[]): Map<ID, Attempt[]> {
  const m = new Map<ID, Attempt[]>();
  for (const a of attempts) m.set(a.problemId, [...(m.get(a.problemId) ?? []), a]);
  return m;
}

const count = (m: Record<ID, number>, k: ID) => {
  m[k] = (m[k] ?? 0) + 1;
};

/** Sends of each colour: problems whose first success falls in the window. */
export function sendsByBand(input: MetricInput, w?: DateWindow): Record<ID, number> {
  const out: Record<ID, number> = {};
  const own = byProblem(input.attempts);
  for (const p of input.problems) {
    const first = firstSuccess(own.get(p.id) ?? []);
    if (first && inWindow(first.createdAt, w)) count(out, p.gradeBandId);
  }
  return out;
}

/** Flashes of each colour in the window. */
export function flashesByBand(input: MetricInput, w?: DateWindow): Record<ID, number> {
  const out: Record<ID, number> = {};
  const own = byProblem(input.attempts);
  for (const p of input.problems) {
    const first = firstSuccess(own.get(p.id) ?? []);
    if (first?.result === 'flash' && inWindow(first.createdAt, w)) count(out, p.gradeBandId);
  }
  return out;
}

/** F_c = flashes_c / sends_c; null when there are no sends. */
export function flashRateByBand(input: MetricInput, w?: DateWindow): Record<ID, number | null> {
  const sends = sendsByBand(input, w);
  const flashes = flashesByBand(input, w);
  return Object.fromEntries(input.bands.map((b) => [b.id, sends[b.id] ? (flashes[b.id] ?? 0) / sends[b.id]! : null]));
}

/** S_c = problems sent_c / problems attempted_c, over problems first attempted in the window. */
export function sendRateByBand(input: MetricInput, w?: DateWindow): Record<ID, number | null> {
  const attempted: Record<ID, number> = {};
  const sent: Record<ID, number> = {};
  const own = byProblem(input.attempts);
  for (const p of input.problems) {
    const list = inOrder(own.get(p.id) ?? []);
    if (!list.length || !inWindow(list[0]!.createdAt, w)) continue;
    count(attempted, p.gradeBandId);
    if (firstSuccess(list)) count(sent, p.gradeBandId);
  }
  return Object.fromEntries(input.bands.map((b) => [b.id, attempted[b.id] ? (sent[b.id] ?? 0) / attempted[b.id]! : null]));
}

/** Session score: sum over new sends in the session of 2^(order - 1). */
export function sessionScores(input: MetricInput): Record<ID, number> {
  const order = new Map(input.bands.map((b) => [b.id, b.order]));
  const out: Record<ID, number> = {};
  const own = byProblem(input.attempts);
  for (const p of input.problems) {
    const first = firstSuccess(own.get(p.id) ?? []);
    if (!first) continue;
    out[first.sessionId] = (out[first.sessionId] ?? 0) + 2 ** ((order.get(p.gradeBandId) ?? 1) - 1);
  }
  return out;
}

/** Every metric, for tests that must hold across all of them (e.g. a reset changes none). */
export const METRICS: Record<string, (input: MetricInput) => unknown> = {
  sendsByBand: (i) => sendsByBand(i),
  flashesByBand: (i) => flashesByBand(i),
  flashRateByBand: (i) => flashRateByBand(i),
  sendRateByBand: (i) => sendRateByBand(i),
  sessionScores: (i) => sessionScores(i),
};
