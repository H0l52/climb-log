import type { Attempt, EpochMs, GradeBand, ID, ISODate, Problem, Session, Wall, WallSet } from '../db/types';
import { addDays, melbourneDate, weekStart } from './dates';
import { firstSuccess, inOrder } from './logging';

/**
 * Metrics from docs/data-model.md, "Metrics". Pure functions over arrays.
 *
 * Every metric is derived from attempts (who sent what, when), never from Problem.status,
 * so expiring a project cannot change history. Board logs never enter this module.
 * Every metric is registered in METRICS so the reset test covers all of them.
 */

export interface MetricInput {
  problems: readonly Problem[];
  attempts: readonly Attempt[];
  bands: readonly Pick<GradeBand, 'id' | 'order'>[];
  /** Needed for the gym filter and streaks. */
  sessions?: readonly Pick<Session, 'id' | 'gymId' | 'date' | 'startedAt'>[];
  /** Needed for wall style tags in the style breakdown. */
  wallSets?: readonly Pick<WallSet, 'id' | 'wallId'>[];
  walls?: readonly Pick<Wall, 'id' | 'styleTags'>[];
}

export interface DateWindow {
  from: ISODate; // inclusive
  to: ISODate; // inclusive
}

/** Days in the trailing window for working grade and flash-rate goals. */
export const TRAILING_DAYS = 42;
/** Problems attempted in the trailing window before a colour can be the working grade. */
export const WORKING_GRADE_MIN_ATTEMPTED = 4;
export const WORKING_GRADE_MIN_RATE = 0.5;

/** What every metric needs to know about one problem, worked out once per input. */
export interface ProblemFact {
  problem: Problem;
  bandId: ID;
  /** Date of the first entry: the problem counts as attempted then. */
  firstDate: ISODate;
  sentAt: EpochMs | null;
  sentDate: ISODate | null;
  sentSessionId: ID | null;
  flash: boolean;
}

const factCache = new WeakMap<MetricInput, ProblemFact[]>();

/** One fact per problem with at least one entry. Cached per input object. */
export function problemFacts(input: MetricInput): ProblemFact[] {
  const hit = factCache.get(input);
  if (hit) return hit;
  const own = new Map<ID, Attempt[]>();
  for (const a of input.attempts) {
    const list = own.get(a.problemId);
    if (list) list.push(a);
    else own.set(a.problemId, [a]);
  }
  const out: ProblemFact[] = [];
  for (const p of input.problems) {
    const list = own.get(p.id);
    if (!list?.length) continue;
    const ordered = inOrder(list);
    const first = firstSuccess(ordered);
    out.push({
      problem: p,
      bandId: p.gradeBandId,
      firstDate: melbourneDate(ordered[0]!.createdAt),
      sentAt: first?.createdAt ?? null,
      sentDate: first ? melbourneDate(first.createdAt) : null,
      sentSessionId: first?.sessionId ?? null,
      flash: first?.result === 'flash',
    });
  }
  factCache.set(input, out);
  return out;
}

export const inWindow = (date: ISODate | null, w?: DateWindow): boolean =>
  date !== null && (!w || (date >= w.from && date <= w.to));

const bump = (m: Record<ID, number>, k: ID, by = 1) => {
  m[k] = (m[k] ?? 0) + by;
};

/** a / b, or null when b is 0 (an undefined rate, shown as "–"). */
export const rate = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** Keep only one gym's sessions and the entries logged in them. Null keeps everything. */
export function filterByGym(input: MetricInput, gymId: ID | null): MetricInput {
  if (gymId === null) return input;
  const sessions = (input.sessions ?? []).filter((s) => s.gymId === gymId);
  const ids = new Set(sessions.map((s) => s.id));
  const attempts = input.attempts.filter((a) => ids.has(a.sessionId));
  const used = new Set(attempts.map((a) => a.problemId));
  return { ...input, sessions, attempts, problems: input.problems.filter((p) => used.has(p.id)) };
}

/** Sends of each colour: problems whose first success falls in the window. */
export function sendsByBand(input: MetricInput, w?: DateWindow): Record<ID, number> {
  const out: Record<ID, number> = {};
  for (const f of problemFacts(input)) if (inWindow(f.sentDate, w)) bump(out, f.bandId);
  return out;
}

/** Flashes of each colour in the window. */
export function flashesByBand(input: MetricInput, w?: DateWindow): Record<ID, number> {
  const out: Record<ID, number> = {};
  for (const f of problemFacts(input)) if (f.flash && inWindow(f.sentDate, w)) bump(out, f.bandId);
  return out;
}

/** F_c = flashes_c / sends_c; null when there are no sends. */
export function flashRateByBand(input: MetricInput, w?: DateWindow): Record<ID, number | null> {
  const sends = sendsByBand(input, w);
  const flashes = flashesByBand(input, w);
  return Object.fromEntries(input.bands.map((b) => [b.id, rate(flashes[b.id] ?? 0, sends[b.id] ?? 0)]));
}

/** Problems first attempted in the window, and how many of those were sent (ever), per colour. */
export function attemptedByBand(input: MetricInput, w?: DateWindow): { attempted: Record<ID, number>; sent: Record<ID, number> } {
  const attempted: Record<ID, number> = {};
  const sent: Record<ID, number> = {};
  for (const f of problemFacts(input)) {
    if (!inWindow(f.firstDate, w)) continue;
    bump(attempted, f.bandId);
    if (f.sentAt !== null) bump(sent, f.bandId);
  }
  return { attempted, sent };
}

/** S_c = problems sent_c / problems attempted_c, over problems first attempted in the window. */
export function sendRateByBand(input: MetricInput, w?: DateWindow): Record<ID, number | null> {
  const { attempted, sent } = attemptedByBand(input, w);
  return Object.fromEntries(input.bands.map((b) => [b.id, rate(sent[b.id] ?? 0, attempted[b.id] ?? 0)]));
}

/** Weight of a new send: 2^(order - 1). */
function weights(input: MetricInput): Map<ID, number> {
  return new Map(input.bands.map((b) => [b.id, 2 ** (b.order - 1)]));
}

/** Session score: sum over new sends in the session of 2^(order - 1). */
export function sessionScores(input: MetricInput): Record<ID, number> {
  const w = weights(input);
  const out: Record<ID, number> = {};
  for (const f of problemFacts(input)) if (f.sentSessionId) bump(out, f.sentSessionId, w.get(f.bandId) ?? 1);
  return out;
}

/** Total score of new sends in the window. */
export function scoreInWindow(input: MetricInput, w?: DateWindow): number {
  const wt = weights(input);
  let n = 0;
  for (const f of problemFacts(input)) if (inWindow(f.sentDate, w)) n += wt.get(f.bandId) ?? 1;
  return n;
}

export const totalOf = (m: Record<ID, number>): number => Object.values(m).reduce((a, b) => a + b, 0);

/** Sends of all colours in the window. */
export const totalSends = (input: MetricInput, w?: DateWindow): number => totalOf(sendsByBand(input, w));

/** Flashes / sends over all colours; null with no sends. */
export function overallFlashRate(input: MetricInput, w?: DateWindow): number | null {
  return rate(totalOf(flashesByBand(input, w)), totalSends(input, w));
}

/** The trailing window of `days` days ending today (inclusive). */
export const trailing = (today: ISODate, days = TRAILING_DAYS): DateWindow => ({ from: addDays(today, 1 - days), to: today });

/**
 * Working grade: the highest-order colour with S_c ≥ 0.5 and at least 4 problems attempted
 * over the trailing 42 days. Null when no colour qualifies.
 */
export function workingGrade(input: MetricInput, today: ISODate): ID | null {
  const { attempted, sent } = attemptedByBand(input, trailing(today));
  let best: Pick<GradeBand, 'id' | 'order'> | null = null;
  for (const b of input.bands) {
    const n = attempted[b.id] ?? 0;
    if (n < WORKING_GRADE_MIN_ATTEMPTED || (sent[b.id] ?? 0) / n < WORKING_GRADE_MIN_RATE) continue;
    if (!best || b.order > best.order) best = b;
  }
  return best?.id ?? null;
}

/**
 * Weekly streak: consecutive Monday-to-Sunday weeks with at least one session, counting back from
 * the current week. The current week does not break the streak while it is in progress.
 * Takes Melbourne session dates, so daylight-saving changes cannot move a session between weeks.
 */
export function weeklyStreak(sessionDates: readonly ISODate[], today: ISODate): number {
  const weeks = new Set(sessionDates.map(weekStart));
  let week = weekStart(today);
  let n = 0;
  if (weeks.has(week)) n = 1;
  week = addDays(week, -7);
  while (weeks.has(week)) {
    n += 1;
    week = addDays(week, -7);
  }
  return n;
}

export interface StyleRow {
  tag: string;
  attempted: number;
  sent: number;
  rate: number;
}

/**
 * Style breakdown: S_c grouped by style tag (the wall's tags and the problem's own, each counted
 * once per problem), over problems first attempted in the window. Weakest first; untagged
 * problems are left out.
 */
export function styleBreakdown(input: MetricInput, w?: DateWindow): StyleRow[] {
  const wallOfSet = new Map((input.wallSets ?? []).map((s) => [s.id, s.wallId]));
  const wallTags = new Map((input.walls ?? []).map((x) => [x.id, x.styleTags]));
  const attempted: Record<string, number> = {};
  const sent: Record<string, number> = {};
  for (const f of problemFacts(input)) {
    if (!inWindow(f.firstDate, w)) continue;
    const tags = new Set([...(wallTags.get(wallOfSet.get(f.problem.wallSetId) ?? '') ?? []), ...f.problem.styleTags]);
    for (const t of tags) {
      bump(attempted, t);
      if (f.sentAt !== null) bump(sent, t);
    }
  }
  return Object.keys(attempted)
    .map((tag) => ({ tag, attempted: attempted[tag]!, sent: sent[tag] ?? 0, rate: (sent[tag] ?? 0) / attempted[tag]! }))
    .sort((a, b) => a.rate - b.rate || b.attempted - a.attempted || a.tag.localeCompare(b.tag));
}

export interface FirstSend {
  bandId: ID;
  problemId: ID;
  at: EpochMs;
  date: ISODate;
  flash: boolean;
}

/** The first send of each colour, oldest first: the automatic achievements. */
export function firstSendsOfColour(input: MetricInput): FirstSend[] {
  const best = new Map<ID, ProblemFact>();
  for (const f of problemFacts(input)) {
    if (f.sentAt === null) continue;
    const cur = best.get(f.bandId);
    if (!cur || f.sentAt < cur.sentAt!) best.set(f.bandId, f);
  }
  return [...best.values()]
    .map((f) => ({ bandId: f.bandId, problemId: f.problem.id, at: f.sentAt!, date: f.sentDate!, flash: f.flash }))
    .sort((a, b) => a.at - b.at);
}

/** A fixed date the registered metrics are evaluated at, so they stay pure. */
const METRIC_TODAY = '2026-11-14';

/** Every metric, for tests that must hold across all of them (e.g. a reset changes none). */
export const METRICS: Record<string, (input: MetricInput) => unknown> = {
  sendsByBand: (i) => sendsByBand(i),
  flashesByBand: (i) => flashesByBand(i),
  flashRateByBand: (i) => flashRateByBand(i),
  sendRateByBand: (i) => sendRateByBand(i),
  sessionScores: (i) => sessionScores(i),
  scoreInWindow: (i) => scoreInWindow(i),
  totalSends: (i) => totalSends(i),
  overallFlashRate: (i) => overallFlashRate(i),
  workingGrade: (i) => workingGrade(i, METRIC_TODAY),
  styleBreakdown: (i) => styleBreakdown(i),
  firstSendsOfColour: (i) => firstSendsOfColour(i),
  weeklyStreak: (i) => weeklyStreak((i.sessions ?? []).map((s) => s.date), METRIC_TODAY),
};
