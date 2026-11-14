import type { AttemptResult, EpochMs, ID, Session } from '../db/types';
import { melbourneDate } from './dates';

export const AUTO_CLOSE_MS = 6 * 60 * 60 * 1000;

export function newSession(gymId: ID, now: EpochMs, id: ID): Session {
  return { id, gymId, date: melbourneDate(now), startedAt: now, endedAt: null, notes: null, energy: null };
}

/**
 * A session with no activity for 6 hours is closed at its last entry's time
 * (its start time when nothing was logged). Returns that time, or null to leave it open.
 */
export function autoCloseAt(session: Pick<Session, 'startedAt' | 'endedAt'>, attemptTimes: readonly EpochMs[], now: EpochMs): EpochMs | null {
  if (session.endedAt !== null) return null;
  const last = attemptTimes.reduce((m, t) => Math.max(m, t), session.startedAt);
  return now - last >= AUTO_CLOSE_MS ? last : null;
}

export interface TallyInput {
  gradeBandId: ID;
  result: AttemptResult;
  /** True when this entry is the problem's first success. */
  newSend: boolean;
}

export interface Tally {
  climbs: number;
  sends: number;
  flashes: number;
  notYet: number;
  sendsByBand: Record<ID, number>;
}

/** Running tally of a session. Repeats of a sent problem count as climbs, not sends. */
export function sessionTally(entries: readonly TallyInput[]): Tally {
  const t: Tally = { climbs: entries.length, sends: 0, flashes: 0, notYet: 0, sendsByBand: {} };
  for (const e of entries) {
    if (e.result === 'fail') t.notYet += 1;
    if (!e.newSend) continue;
    t.sends += 1;
    if (e.result === 'flash') t.flashes += 1;
    t.sendsByBand[e.gradeBandId] = (t.sendsByBand[e.gradeBandId] ?? 0) + 1;
  }
  return t;
}

/** '48m', '1h 05m'. */
export function formatElapsed(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
