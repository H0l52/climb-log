import { describe, expect, it } from 'vitest';
import seedJson from '../data/seed.json';
import type { SeedData } from '../db/types';
import { generateSynthetic } from './__fixtures__/synthetic';
import { melbourneDate } from './dates';
import { firstSuccess, inOrder, statusFromAttempts } from './logging';
import { progressView, RANGES } from './progress';

const seed = seedJson as SeedData;
const NOW = Date.UTC(2026, 10, 13, 23, 0); // 14 Nov 2026, 10 am Melbourne
const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order);
const walls = seed.walls.filter((w) => w.kind === 'boulder').map((w) => ({ id: w.id, gymId: w.gymId }));
const data = generateSynthetic({ now: NOW, bandIds: bands.map((b) => b.id), walls });

describe('synthetic dataset', () => {
  it('covers two years with about 3,000 entries at both gyms', () => {
    expect(data.attempts.length).toBeGreaterThan(2700);
    expect(data.attempts.length).toBeLessThan(3500);
    const dates = data.sessions.map((s) => s.date).sort();
    expect(dates[0]! <= '2024-11-21').toBe(true);
    expect(new Set(data.sessions.map((s) => s.gymId)).size).toBe(2);
    expect(Math.max(...data.attempts.map((a) => a.createdAt))).toBeLessThan(NOW);
  });
  it('is deterministic', () => {
    expect(generateSynthetic({ now: NOW, bandIds: bands.map((b) => b.id), walls }).attempts).toEqual(data.attempts);
  });
  it('follows the domain rules', () => {
    const sets = new Map(data.wallSets.map((s) => [s.id, s]));
    for (const p of data.problems) {
      const own = inOrder(data.attempts.filter((a) => a.problemId === p.id));
      own.forEach((a, i) => {
        if (a.result === 'flash') expect(i === 0 && a.tries === 1).toBe(true);
      });
      expect(p.status).toBe(statusFromAttempts(own, sets.get(p.wallSetId)!.retiredDate !== null));
      expect(firstSuccess(own)?.result ?? 'none').not.toBe('fail');
    }
    for (const w of walls) expect(data.wallSets.filter((s) => s.wallId === w.id && s.retiredDate === null)).toHaveLength(1);
    for (const s of data.sessions) expect(melbourneDate(s.startedAt)).toBe(s.date);
  });
  it('computes every range of the progress view quickly', () => {
    const input = { ...data, bands };
    const t0 = performance.now();
    for (const r of RANGES) for (const gymId of [null, seed.gyms[0]!.id]) progressView({ ...input }, { gymId, range: r.key, today: '2026-11-14' });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(1000);
  });
});
