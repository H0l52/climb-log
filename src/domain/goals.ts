import type { EpochMs, Goal, GoalType, ID, ISODate } from '../db/types';
import { melbourneDate, weekStart } from './dates';
import { type MetricInput, TRAILING_DAYS, problemFacts, rate, trailing } from './metrics';

/**
 * Goals from docs/data-model.md, "Goals". Pure.
 *
 * Every goal's achievement is derived from the log, so it is the same whenever it is checked:
 * it completes at the instant of the entry (or session) that met it, and a correction that
 * removes that entry un-completes it. A goal with a deadline only counts what happened by then.
 */

const DAY = 86_400_000;
/** Sends in the trailing window before a flash-rate goal can complete. */
export const FLASH_GOAL_MIN_SENDS = 4;

export const GOAL_TYPES: readonly { type: GoalType; label: string; needsBand: boolean }[] = [
  { type: 'first-send-of-colour', label: 'First send', needsBand: true },
  { type: 'sends-of-colour', label: 'Sends', needsBand: true },
  { type: 'flash-rate', label: 'Flash rate', needsBand: true },
  { type: 'sessions-per-week', label: 'Sessions a week', needsBand: false },
];

export interface NewGoal {
  type: GoalType;
  gradeBandId: ID | null;
  target: number;
  deadline: ISODate | null;
}

/** Throws when a new goal is not valid. Returns it normalised. */
export function validateGoal(g: NewGoal, today: ISODate): NewGoal {
  const needsBand = g.type !== 'sessions-per-week';
  if (needsBand && !g.gradeBandId) throw new Error('Pick a colour');
  const target = g.type === 'first-send-of-colour' ? 1 : g.target;
  if (!Number.isInteger(target) || target < 1) throw new Error('Target must be 1 or more');
  if (g.type === 'flash-rate' && target > 100) throw new Error('A flash rate goal is a percentage up to 100');
  if (g.deadline !== null && !/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)) throw new Error('Deadline must be a date');
  if (g.deadline !== null && g.deadline < today) throw new Error('The deadline has passed');
  return { type: g.type, gradeBandId: needsBand ? g.gradeBandId : null, target, deadline: g.deadline };
}

const byDeadline = (goal: Pick<Goal, 'deadline'>, at: EpochMs) => goal.deadline === null || melbourneDate(at) <= goal.deadline;

/** When the goal was met, from the log; null if it has not been. */
export function achievedAt(goal: Goal, input: MetricInput): EpochMs | null {
  const counts = (at: EpochMs) => at >= goal.createdAt && byDeadline(goal, at);
  const sends = () =>
    problemFacts(input)
      .filter((f) => f.bandId === goal.gradeBandId && f.sentAt !== null)
      .map((f) => ({ at: f.sentAt!, flash: f.flash }))
      .sort((a, b) => a.at - b.at);

  switch (goal.type) {
    case 'first-send-of-colour': {
      const first = sends()[0];
      if (!first) return null;
      // Already sent before the goal was set: met when it was set.
      const at = Math.max(first.at, goal.createdAt);
      return byDeadline(goal, at) ? at : null;
    }
    case 'sends-of-colour': {
      const hit = sends().filter((s) => counts(s.at))[goal.target - 1];
      return hit?.at ?? null;
    }
    case 'flash-rate': {
      const all = sends();
      for (const s of all) {
        if (!counts(s.at)) continue;
        const recent = all.filter((x) => x.at > s.at - TRAILING_DAYS * DAY && x.at <= s.at);
        const r = rate(recent.filter((x) => x.flash).length, recent.length);
        if (recent.length >= FLASH_GOAL_MIN_SENDS && r !== null && r * 100 >= goal.target) return s.at;
      }
      return null;
    }
    case 'sessions-per-week': {
      const perWeek = new Map<ISODate, EpochMs[]>();
      const sessions = [...(input.sessions ?? [])]
        .filter((s) => counts(s.startedAt))
        .sort((a, b) => a.startedAt - b.startedAt);
      for (const s of sessions) {
        const wk = weekStart(s.date);
        const list = [...(perWeek.get(wk) ?? []), s.startedAt];
        perWeek.set(wk, list);
        if (list.length === goal.target) return s.startedAt;
      }
      return null;
    }
  }
}

export interface GoalProgress {
  current: number;
  target: number;
  /** 0..1 for a progress bar. */
  fraction: number;
  status: 'done' | 'active' | 'missed';
  /** Text for the current value, e.g. "3 / 5", "40% / 60%", "–". */
  text: string;
}

/** Where a goal stands today. `doneAt` is the stored (or derived) achievement time. */
export function goalProgress(goal: Goal, input: MetricInput, today: ISODate, doneAt: EpochMs | null = achievedAt(goal, input)): GoalProgress {
  const status = doneAt !== null ? 'done' : goal.deadline !== null && today > goal.deadline ? 'missed' : 'active';
  const facts = problemFacts(input).filter((f) => f.bandId === goal.gradeBandId && f.sentAt !== null);
  const make = (current: number, text: string): GoalProgress => ({
    current, target: goal.target, fraction: status === 'done' ? 1 : Math.min(1, current / goal.target), status, text,
  });
  switch (goal.type) {
    case 'first-send-of-colour':
      return make(doneAt !== null ? 1 : 0, doneAt !== null ? 'Sent' : 'Not yet');
    case 'sends-of-colour': {
      const n = facts.filter((f) => f.sentAt! >= goal.createdAt && byDeadline(goal, f.sentAt!)).length;
      return make(n, `${n} / ${goal.target}`);
    }
    case 'flash-rate': {
      const w = trailing(today);
      const recent = facts.filter((f) => f.sentDate! >= w.from && f.sentDate! <= w.to);
      const r = rate(recent.filter((f) => f.flash).length, recent.length);
      const pct = r === null ? null : Math.round(r * 100);
      return make(pct ?? 0, `${pct === null ? '–' : `${pct}%`} / ${goal.target}%`);
    }
    case 'sessions-per-week': {
      const wk = weekStart(today);
      const n = (input.sessions ?? []).filter((s) => weekStart(s.date) === wk).length;
      return make(n, `${n} / ${goal.target} this week`);
    }
  }
}

/** Goals whose stored achievedAt no longer matches the log, with the value to store. */
export function goalUpdates(goals: readonly Goal[], input: MetricInput): { id: ID; achievedAt: EpochMs | null }[] {
  return goals.flatMap((g) => {
    const at = achievedAt(g, input);
    return at === g.achievedAt ? [] : [{ id: g.id, achievedAt: at }];
  });
}
