import seedJson from '../data/seed.json';
import { ClimbDB } from './schema';
import { createRepositories } from './repositories';
import { applySeed } from './seed';
import { ensurePersistence } from './persistence';
import type { SeedData } from './types';

export const db = new ClimbDB();
export const repos = createRepositories(db);

let ready: Promise<void> | null = null;

/** Open the database, seed on first launch and request persistent storage. Safe to call repeatedly. */
export function initDatabase(): Promise<void> {
  ready ??= (async () => {
    await applySeed(db, seedJson as SeedData, { now: Date.now() });
    await ensurePersistence(repos, typeof navigator !== 'undefined' ? navigator.storage : undefined);
  })();
  return ready;
}
