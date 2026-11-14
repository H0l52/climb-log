import type { Attempt, AttemptResult, EpochMs, GradeBand, ISODate, Problem, Session, Wall, WallSet } from '../../db/types';
import type { MetricInput } from '../metrics';

/**
 * Hand-built dataset for the metric tests. Every expected value in metrics.fixture.test.ts was worked
 * out by hand from the table below (see the comments there), not by running the code.
 *
 * "Today" is Sat 2026-11-14. Weeks start Monday: 5 Oct, 12 Oct, 19 Oct, 26 Oct, 2 Nov, 9 Nov.
 * Bands: y(1) b(2) p(3) g(4), weights 1, 2, 4, 8.
 * Gyms: A (walls wA [slab], wB []), B (wall wC [roof]).
 * Wall wA was reset on 2026-11-04: set sA1 retired, sA2 current. P8 expired with it.
 *
 * | Session | Date (gym)     | Entries, in order                                                  |
 * |---------|----------------|--------------------------------------------------------------------|
 * | S0      | Tue 1 Sep (A)  | P0 y wA flash                                                      |
 * | S1      | Tue 6 Oct (A)  | P1 y wA flash · P2 b wA [crimp] fail×3 · P3 p wB fail×2           |
 * | S2      | Wed 14 Oct (A) | P2 send×2 · P4 y wB send×2 · P5 b wA flash                         |
 * | –       | week of 19 Oct | no sessions                                                        |
 * | S3      | Wed 28 Oct (B) | P6 y wC flash · P7 b wC fail                                       |
 * | S4      | Tue 3 Nov (A)  | P8 p wA [crimp] fail×4 · P3 fail · P9 g wB fail                    |
 * | reset   | Wed 4 Nov      | wA: sA1 retired, P8 expired                                        |
 * | S5      | Tue 10 Nov (A) | P10 b wA(sA2) flash · P3 send · P1 send (repeat, not a new send)  |
 * | S6      | Thu 12 Nov (B) | P7 send · P11 b wC flash · P12 y wC flash                          |
 */

export const TODAY: ISODate = '2026-11-14';

/** The instant of a Melbourne wall-clock time (handles AEST/AEDT). */
export function melbourneInstant(date: ISODate, hour: number, minute = 0): EpochMs {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (const offset of [11, 10]) {
    const t = Date.UTC(y, m - 1, d, hour - offset, minute);
    const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && Number(parts.hour) === hour) return t;
  }
  throw new Error(`No Melbourne instant for ${date} ${hour}:${minute}`);
}

export const bands: GradeBand[] = [
  { id: 'y', gradeSystemId: 'gs', name: 'Band Y', hex: '#F2C200', order: 1, approxV: null, active: true },
  { id: 'b', gradeSystemId: 'gs', name: 'Band B', hex: '#1E6FD9', order: 2, approxV: null, active: true },
  { id: 'p', gradeSystemId: 'gs', name: 'Band P', hex: '#7B3FB5', order: 3, approxV: null, active: true },
  { id: 'g', gradeSystemId: 'gs', name: 'Band G', hex: '#2E9E4F', order: 4, approxV: null, active: true },
];

const wall = (id: string, gymId: string, styleTags: string[]): Wall => ({
  id, gymId, name: `Wall ${id}`, kind: 'boulder', gradeSystemId: 'gs', styleTags, active: true, mergedIntoId: null, createdAt: 0,
});
export const walls: Wall[] = [wall('wA', 'A', ['slab']), wall('wB', 'A', []), wall('wC', 'B', ['roof'])];
export const wallSets: WallSet[] = [
  { id: 'sA1', wallId: 'wA', setDate: '2026-08-01', retiredDate: '2026-11-04' },
  { id: 'sA2', wallId: 'wA', setDate: '2026-11-04', retiredDate: null },
  { id: 'sB1', wallId: 'wB', setDate: '2026-08-01', retiredDate: null },
  { id: 'sC1', wallId: 'wC', setDate: '2026-08-01', retiredDate: null },
];

const sessionRows: [string, string, ISODate][] = [
  ['S0', 'A', '2026-09-01'],
  ['S1', 'A', '2026-10-06'],
  ['S2', 'A', '2026-10-14'],
  ['S3', 'B', '2026-10-28'],
  ['S4', 'A', '2026-11-03'],
  ['S5', 'A', '2026-11-10'],
  ['S6', 'B', '2026-11-12'],
];
export const sessions: Session[] = sessionRows.map(([id, gymId, date]) => {
  const startedAt = melbourneInstant(date, 18);
  return { id, gymId, date, startedAt, endedAt: startedAt + 2 * 3_600_000, notes: null, energy: null };
});

const problemRows: [string, string, string, string[], Problem['status']][] = [
  ['P0', 'y', 'sA1', [], 'sent'],
  ['P1', 'y', 'sA1', [], 'sent'],
  ['P2', 'b', 'sA1', ['crimp'], 'sent'],
  ['P3', 'p', 'sB1', [], 'sent'],
  ['P4', 'y', 'sB1', [], 'sent'],
  ['P5', 'b', 'sA1', [], 'sent'],
  ['P6', 'y', 'sC1', [], 'sent'],
  ['P7', 'b', 'sC1', [], 'sent'],
  ['P8', 'p', 'sA1', ['crimp'], 'expired'],
  ['P9', 'g', 'sB1', [], 'project'],
  ['P10', 'b', 'sA2', [], 'sent'],
  ['P11', 'b', 'sC1', [], 'sent'],
  ['P12', 'y', 'sC1', [], 'sent'],
];

/** Entries per session, in order: [problem, result, tries]. One minute apart from 18:00. */
const entryRows: Record<string, [string, AttemptResult, number][]> = {
  S0: [['P0', 'flash', 1]],
  S1: [['P1', 'flash', 1], ['P2', 'fail', 3], ['P3', 'fail', 2]],
  S2: [['P2', 'send', 2], ['P4', 'send', 2], ['P5', 'flash', 1]],
  S3: [['P6', 'flash', 1], ['P7', 'fail', 1]],
  S4: [['P8', 'fail', 4], ['P3', 'fail', 1], ['P9', 'fail', 1]],
  S5: [['P10', 'flash', 1], ['P3', 'send', 1], ['P1', 'send', 1]],
  S6: [['P7', 'send', 1], ['P11', 'flash', 1], ['P12', 'flash', 1]],
};

export const attempts: Attempt[] = sessions.flatMap((s) =>
  entryRows[s.id]!.map(([problemId, result, tries], i) => ({
    id: `${s.id}-${i}`, problemId, sessionId: s.id, tries, result, felt: null, notes: null, createdAt: s.startedAt + (i + 1) * 60_000,
  })),
);

const firstAt = (pid: string) => Math.min(...attempts.filter((a) => a.problemId === pid).map((a) => a.createdAt));
export const problems: Problem[] = problemRows.map(([id, gradeBandId, wallSetId, styleTags, status]) => ({
  id, gradeBandId, wallSetId, styleTags, status, nickname: null, photoId: null, createdAt: firstAt(id),
}));

export const fixture: MetricInput = { problems, attempts, bands, sessions, wallSets, walls };

/** The instant of an entry, by session and position, for asserting achievement times. */
export const entryAt = (sessionId: string, index: number): EpochMs => attempts.find((a) => a.id === `${sessionId}-${index}`)!.createdAt;
