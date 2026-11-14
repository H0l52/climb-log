import seedJson from '../../data/seed.json';
import { ClimbDB } from '../schema';
import { createRepositories, type Clock } from '../repositories';
import type { SeedData } from '../types';

export const seed = seedJson as SeedData;

/** 2026-11-14 10:00 Melbourne (AEDT, UTC+11). */
export const FIXED_NOW = Date.UTC(2026, 10, 13, 23, 0, 0);

export function testClock(start = FIXED_NOW): Clock & { advance(ms: number): void } {
  let t = start;
  let n = 0;
  return {
    now: () => t,
    newId: () => `id-${++n}`,
    advance(ms: number) {
      t += ms;
    },
  };
}

let counter = 0;
export function freshDb(): ClimbDB {
  return new ClimbDB(`test-${Date.now()}-${++counter}`);
}

export function reposFor(db: ClimbDB, clock = testClock()) {
  return createRepositories(db, clock);
}
