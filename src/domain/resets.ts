import type { ID, ISODate, Problem, ProblemStatus, Session, WallSet } from '../db/types';
import { addDays, daysBetween, isoWeekday } from './dates';

/** Rules from docs/data-model.md, "Resets". Pure: ids and dates are passed in. */

/** A wall counts as "fresh" while its current set is less than this many days old. */
export const FRESH_DAYS = 7;

/** What Undo needs to put a reset back exactly. Kept per wall in the `lastReset` setting. */
export interface ResetRecord {
  wallId: ID;
  /** The set that was current before the reset (now retired). */
  retiredSetId: ID;
  /** The set the reset created. */
  newSetId: ID;
  date: ISODate;
  /** Every problem whose status the reset changed, with its status before. */
  changed: { problemId: ID; before: ProblemStatus }[];
  madeAt: number;
}

export interface ResetPlan {
  retiredSet: WallSet;
  newSet: WallSet;
  /** Problems with their new status (only those that changed). */
  expired: Problem[];
  record: ResetRecord;
}

/**
 * Default reset date: the most recent configured set day on or before `today`.
 * Falls back to `today` when the gym has no set days. Never earlier than `notBefore`
 * (the current set's date), since a reset cannot predate the set it retires.
 */
export function defaultResetDate(setDays: readonly number[], today: ISODate, notBefore?: ISODate): ISODate {
  let d = today;
  const days = new Set(setDays);
  if (days.size > 0) {
    for (let back = 0; back < 7; back += 1) {
      const candidate = addDays(today, -back);
      if (days.has(isoWeekday(candidate))) {
        d = candidate;
        break;
      }
    }
  }
  return notBefore && d < notBefore ? notBefore : d;
}

/** Why a reset date is not allowed, or null when it is. */
export function resetDateError(date: ISODate, today: ISODate, currentSetDate: ISODate): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Pick a date';
  if (date > today) return 'A reset cannot be in the future';
  if (date < currentSetDate) return 'A reset cannot be before the current set';
  return null;
}

/**
 * Mark a wall as reset on `date`: retire its current set, expire every project on it,
 * start a new current set. Sent problems stay sent. Nothing is deleted.
 */
export function planReset(
  sets: readonly WallSet[],
  problems: readonly Problem[],
  input: { wallId: ID; date: ISODate; today: ISODate },
  ctx: { newSetId: ID; now: number },
): ResetPlan {
  const current = sets.find((s) => s.wallId === input.wallId && s.retiredDate === null);
  if (!current) throw new Error('This wall has no current set');
  const err = resetDateError(input.date, input.today, current.setDate);
  if (err) throw new Error(err);
  const expired = problems
    .filter((p) => p.wallSetId === current.id && p.status === 'project')
    .map((p) => ({ ...p, status: 'expired' as const }));
  return {
    retiredSet: { ...current, retiredDate: input.date },
    newSet: { id: ctx.newSetId, wallId: input.wallId, setDate: input.date, retiredDate: null },
    expired,
    record: {
      wallId: input.wallId,
      retiredSetId: current.id,
      newSetId: ctx.newSetId,
      date: input.date,
      changed: expired.map((p) => ({ problemId: p.id, before: 'project' })),
      madeAt: ctx.now,
    },
  };
}

/**
 * Undo is available until the session that was open at the reset ends, or (with no session open)
 * until the next session ends; and only while the reset is the wall's latest one.
 */
export function canUndoReset(
  record: ResetRecord | undefined,
  sets: readonly WallSet[],
  sessions: readonly Pick<Session, 'endedAt'>[],
): boolean {
  if (!record) return false;
  const newSet = sets.find((s) => s.id === record.newSetId);
  const retired = sets.find((s) => s.id === record.retiredSetId);
  if (!newSet || newSet.retiredDate !== null || newSet.wallId !== record.wallId) return false;
  if (!retired || retired.retiredDate !== record.date || retired.wallId !== record.wallId) return false;
  return !sessions.some((s) => s.endedAt !== null && s.endedAt >= record.madeAt);
}

export interface UndoPlan {
  restoredSet: WallSet;
  removeSetId: ID;
  /** Problems whose status goes back, plus any climbs logged on the new set, moved back to the restored set. */
  problems: Problem[];
}

/**
 * Undo a reset: the retired set becomes current again, the new set is removed, and every status the
 * reset changed goes back exactly. A problem the user has corrected since (no longer expired) is left as is.
 * Climbs logged on the new set in the meantime move to the restored set, so no history is lost.
 */
export function planUndoReset(record: ResetRecord, sets: readonly WallSet[], problems: readonly Problem[]): UndoPlan {
  const retired = sets.find((s) => s.id === record.retiredSetId);
  if (!retired) throw new Error('Nothing to undo');
  const before = new Map(record.changed.map((c) => [c.problemId, c.before]));
  const out: Problem[] = [];
  for (const p of problems) {
    if (p.wallSetId === record.newSetId) {
      out.push({ ...p, wallSetId: retired.id });
    } else if (p.wallSetId === retired.id && before.has(p.id) && p.status === 'expired') {
      out.push({ ...p, status: before.get(p.id)! });
    }
  }
  return { restoredSet: { ...retired, retiredDate: null }, removeSetId: record.newSetId, problems: out };
}

/** Days since a set went up (0 on the day). */
export const daysSinceSet = (setDate: ISODate, today: ISODate): number => Math.max(0, daysBetween(setDate, today));

/** Set within the last 7 days (days since set 0–6). */
export const isFresh = (setDate: ISODate, today: ISODate): boolean => daysSinceSet(setDate, today) < FRESH_DAYS;

/** '0 days' reads oddly on the wall strip: 'Set today', 'Set 1 day ago', 'Set 12 days ago'. */
export function setAgeLabel(setDate: ISODate, today: ISODate): string {
  const n = daysSinceSet(setDate, today);
  if (n === 0) return 'Set today';
  return `Set ${n} ${n === 1 ? 'day' : 'days'} ago`;
}

/** The wall's current set, if any. */
export const currentSet = (sets: readonly WallSet[], wallId: ID): WallSet | undefined =>
  sets.find((s) => s.wallId === wallId && s.retiredDate === null);

/** A wall's past sets, newest first. */
export const pastSets = (sets: readonly WallSet[], wallId: ID): WallSet[] =>
  sets
    .filter((s) => s.wallId === wallId && s.retiredDate !== null)
    .sort((a, b) => (b.setDate === a.setDate ? (b.retiredDate ?? '').localeCompare(a.retiredDate ?? '') : b.setDate.localeCompare(a.setDate)));
