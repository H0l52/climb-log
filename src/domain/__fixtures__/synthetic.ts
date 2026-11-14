import type { Attempt, EpochMs, ID, ISODate, Problem, Session, WallSet } from '../../db/types';
import { addDays, daysBetween, isoWeekday, melbourneDate } from '../dates';

/**
 * Synthetic climbing history for performance tests: about two years and ~3,000 entries,
 * deterministic for a given seed. Follows the domain rules: a flash is only a first single-try
 * entry, statuses match entries, walls are reset every few weeks and projects expire with them.
 * Pure: takes the walls and bands to use (from the seed) and returns rows to insert.
 */

export interface SyntheticOptions {
  /** End of the history (usually now). */
  now: EpochMs;
  /** Grade band ids, easiest first. */
  bandIds: readonly ID[];
  /** Boulder walls to climb on. The first gym listed is the main gym. */
  walls: readonly { id: ID; gymId: ID }[];
  days?: number;
  seed?: number;
}

export interface SyntheticData {
  sessions: Session[];
  wallSets: WallSet[];
  problems: Problem[];
  attempts: Attempt[];
}

const HOUR = 3_600_000;
const MIN = 60_000;

/** Small deterministic PRNG (mulberry32). */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Instant of 6 pm Melbourne on a date (the offset is +10 or +11; pick the one that lands on the date). */
function eveningOf(date: ISODate): EpochMs {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  for (const off of [11, 10]) {
    const t = Date.UTC(y, m - 1, d, 18 - off);
    if (melbourneDate(t) === date && new Date(t + off * HOUR).getUTCHours() === 18) return t;
  }
  return Date.UTC(y, m - 1, d, 8);
}

export function generateSynthetic(o: SyntheticOptions): SyntheticData {
  const rand = prng(o.seed ?? 42);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const days = o.days ?? 730;
  const today = melbourneDate(o.now);
  const start = addDays(today, -days);
  const gyms = [...new Set(o.walls.map((w) => w.gymId))];
  const mainGym = gyms[0]!;

  const out: SyntheticData = { sessions: [], wallSets: [], problems: [], attempts: [] };
  let n = 0;
  const id = (k: string) => `syn-${k}-${++n}`;

  // Wall sets: each wall is reset every 28–42 days, staggered.
  const current = new Map<ID, WallSet>();
  const nextReset = new Map<ID, ISODate>();
  const openProblems = new Map<ID, { problem: Problem; entries: number }[]>(); // by wall set
  for (const w of o.walls) {
    const set: WallSet = { id: id('set'), wallId: w.id, setDate: addDays(start, -Math.floor(rand() * 30)), retiredDate: null };
    out.wallSets.push(set);
    current.set(w.id, set);
    nextReset.set(w.id, addDays(start, 7 + Math.floor(rand() * 35)));
  }

  for (let day = 0; day <= days; day++) {
    const date = addDays(start, day);
    // Resets happen before the day's climbing.
    for (const w of o.walls) {
      if (nextReset.get(w.id)! > date) continue;
      const old = current.get(w.id)!;
      old.retiredDate = date;
      for (const p of openProblems.get(old.id) ?? []) if (p.problem.status === 'project') p.problem.status = 'expired';
      openProblems.delete(old.id);
      const set: WallSet = { id: id('set'), wallId: w.id, setDate: date, retiredDate: null };
      out.wallSets.push(set);
      current.set(w.id, set);
      nextReset.set(w.id, addDays(date, 28 + Math.floor(rand() * 15)));
    }

    // About 2.5 sessions a week, mostly Tue/Thu/Sat; an occasional week off.
    const wd = isoWeekday(date);
    const weekOff = Math.floor(daysBetween(start, date) / 7) % 11 === 5;
    const chance = wd === 2 || wd === 4 ? 0.8 : wd === 6 ? 0.6 : 0.05;
    if (weekOff || rand() > chance) continue;

    const gymId = rand() < 0.85 ? mainGym : pick(gyms);
    const gymWalls = o.walls.filter((w) => w.gymId === gymId);
    const startedAt = eveningOf(date) + Math.floor(rand() * 60) * MIN;
    if (startedAt + 3 * HOUR > o.now) continue; // never log in the future
    const session: Session = { id: id('session'), gymId, date, startedAt, endedAt: null, notes: null, energy: null };
    out.sessions.push(session);

    // Skill rises over the two years: the hardest comfortable band index goes from ~1.5 to ~4.
    const skill = 1.5 + (2.5 * day) / days;
    const entries = 9 + Math.floor(rand() * 9);
    let t = startedAt;
    for (let e = 0; e < entries; e++) {
      t += (3 + Math.floor(rand() * 6)) * MIN;
      const wall = pick(gymWalls);
      const set = current.get(wall.id)!;
      const open = (openProblems.get(set.id) ?? []).filter((p) => p.problem.status === 'project');
      const retry = open.length > 0 && rand() < 0.35;
      const entry = retry ? pick(open) : null;
      const bandIndex = entry
        ? o.bandIds.indexOf(entry.problem.gradeBandId)
        : Math.max(0, Math.min(o.bandIds.length - 1, Math.round(skill - 1.5 + rand() * 3)));
      const tries = 1 + Math.floor(rand() * 3);
      const pSend = 1 / (1 + Math.exp(2 * (bandIndex - skill))) + (entry ? 0.1 * entry.entries : 0);
      const success = rand() < pSend;
      const first = !entry;
      const flash = first && tries === 1 && success;

      let problem: Problem;
      if (entry) {
        problem = entry.problem;
        entry.entries += 1;
      } else {
        problem = {
          id: id('problem'), wallSetId: set.id, gradeBandId: o.bandIds[bandIndex]!, nickname: null, photoId: null,
          styleTags: rand() < 0.3 ? [pick(['crimp', 'sloper', 'dyno', 'balance'])] : [], status: 'project', createdAt: t,
        };
        out.problems.push(problem);
        openProblems.set(set.id, [...(openProblems.get(set.id) ?? []), { problem, entries: 1 }]);
      }
      if (success) problem.status = 'sent';
      out.attempts.push({
        id: id('attempt'), problemId: problem.id, sessionId: session.id, tries,
        result: flash ? 'flash' : success ? 'send' : 'fail', felt: null, notes: null, createdAt: t,
      });
    }
    session.endedAt = t + 10 * MIN;
  }
  return out;
}
