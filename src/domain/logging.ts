import type { Attempt, AttemptResult, EpochMs, Felt, ID, Problem, ProblemStatus } from '../db/types';

/** Rules from docs/data-model.md, "Problems and attempts". Pure: ids and the clock are passed in. */

export const isSuccess = (result: AttemptResult): boolean => result !== 'fail';

export const validTries = (tries: number): boolean => Number.isInteger(tries) && tries >= 1;

/** Oldest first. */
export function inOrder(attempts: readonly Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => a.createdAt - b.createdAt);
}

/** A flash is only possible on a problem's first entry, with exactly one try. */
export function canFlash(priorEntries: number, tries: number): boolean {
  return priorEntries === 0 && tries === 1;
}

/** The result to store for a "Sent" / "Not yet" choice. */
export function resultFor(o: { priorEntries: number; tries: number; success: boolean }): AttemptResult {
  if (!o.success) return 'fail';
  return canFlash(o.priorEntries, o.tries) ? 'flash' : 'send';
}

/** Throws when an entry breaks the rules (bad tries, or a flash that is not a first single try). */
export function assertValidEntry(o: { priorEntries: number; tries: number; result: AttemptResult }): void {
  if (!validTries(o.tries)) throw new Error('Tries must be a whole number of 1 or more');
  if (o.result === 'flash' && !canFlash(o.priorEntries, o.tries)) {
    throw new Error('A flash is only possible on the first entry for a problem, with one try');
  }
}

/** project → sent on first success; sent never goes back; an expired problem takes no new entries. */
export function nextStatus(current: ProblemStatus, result: AttemptResult): ProblemStatus {
  if (current === 'expired') throw new Error('This problem was reset; log it as a new climb');
  return current === 'sent' || isSuccess(result) ? 'sent' : 'project';
}

/**
 * Status implied by a problem's entries. Used only after the user corrects history
 * (edits or deletes an entry), where the stored status may no longer match.
 */
export function statusFromAttempts(attempts: readonly Pick<Attempt, 'result'>[], setRetired: boolean): ProblemStatus {
  if (attempts.some((a) => isSuccess(a.result))) return 'sent';
  return setRetired ? 'expired' : 'project';
}

export interface EntryInput {
  sessionId: ID;
  tries: number;
  result: AttemptResult;
  felt?: Felt | null;
  notes?: string | null;
}

export interface NewProblemInput extends EntryInput {
  wallSetId: ID;
  gradeBandId: ID;
  nickname?: string | null;
  styleTags?: string[];
}

const text = (s: string | null | undefined): string | null => s?.trim() || null;

/** A problem is always created together with its first entry. */
export function createProblemWithFirstAttempt(
  input: NewProblemInput,
  ctx: { problemId: ID; attemptId: ID; now: EpochMs },
): { problem: Problem; attempt: Attempt } {
  assertValidEntry({ priorEntries: 0, tries: input.tries, result: input.result });
  const problem: Problem = {
    id: ctx.problemId,
    wallSetId: input.wallSetId,
    gradeBandId: input.gradeBandId,
    nickname: text(input.nickname),
    photoId: null,
    styleTags: [...new Set(input.styleTags ?? [])],
    status: nextStatus('project', input.result),
    createdAt: ctx.now,
  };
  const attempt: Attempt = {
    id: ctx.attemptId,
    problemId: problem.id,
    sessionId: input.sessionId,
    tries: input.tries,
    result: input.result,
    felt: input.felt ?? null,
    notes: text(input.notes),
    createdAt: ctx.now,
  };
  return { problem, attempt };
}

/** Add a later entry to an existing problem. Returns the problem with its new status. */
export function addAttempt(
  problem: Problem,
  prior: readonly Attempt[],
  input: EntryInput,
  ctx: { attemptId: ID; now: EpochMs },
): { problem: Problem; attempt: Attempt } {
  assertValidEntry({ priorEntries: prior.length, tries: input.tries, result: input.result });
  const status = nextStatus(problem.status, input.result);
  const latest = prior.reduce((m, a) => Math.max(m, a.createdAt), -Infinity);
  const attempt: Attempt = {
    id: ctx.attemptId,
    problemId: problem.id,
    sessionId: input.sessionId,
    tries: input.tries,
    result: input.result,
    felt: input.felt ?? null,
    notes: text(input.notes),
    // Entries of one problem are strictly ordered in time, so "first entry" is never ambiguous.
    createdAt: Math.max(ctx.now, latest + 1),
  };
  return { problem: { ...problem, status }, attempt };
}

/** The entry that sent the problem (its first success), if any. Repeats after it are not sends. */
export function firstSuccess(attempts: readonly Attempt[]): Attempt | null {
  return inOrder(attempts).find((a) => isSuccess(a.result)) ?? null;
}

/** Sum of tries up to and including the first success; null while unsent. */
export function triesToSend(attempts: readonly Attempt[]): number | null {
  let total = 0;
  for (const a of inOrder(attempts)) {
    total += a.tries;
    if (isSuccess(a.result)) return total;
  }
  return null;
}

export const totalTries = (attempts: readonly Pick<Attempt, 'tries'>[]): number =>
  attempts.reduce((n, a) => n + a.tries, 0);
