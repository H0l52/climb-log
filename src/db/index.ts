import seedJson from '../data/seed.json';
import { ClimbDB } from './schema';
import { createRepositories } from './repositories';
import { createWallViews } from './wallViews';
import { applySeed } from './seed';
import { ensurePersistence } from './persistence';
import type { SeedData } from './types';
import { buildBackup, importBackup, parseBackup, type ParsedBackup } from './backup';

export const db = new ClimbDB();
export const repos = createRepositories(db);
export const wallViews = createWallViews(db, repos);

let ready: Promise<void> | null = null;

/** Open the database, seed on first launch and request persistent storage. Safe to call repeatedly. */
export function initDatabase(): Promise<void> {
  ready ??= (async () => {
    await applySeed(db, seedJson as SeedData, { now: Date.now() });
    await repos.sessions.closeStale();
    await repos.photos.applyRetention();
    await ensurePersistence(repos, typeof navigator !== 'undefined' ? navigator.storage : undefined);
  })();
  return ready;
}

/** Style tags offered when logging (from the seed file; not stored per database). */
export const styleTagOptions: readonly string[] = (seedJson as SeedData).styleTags;

/** Backup export and import against the app database. */
export const backup = {
  build: (opts: { now: number; includePhotos: boolean }) => buildBackup(db, opts),
  parse: parseBackup,
  replaceWith: (parsed: ParsedBackup) => importBackup(db, parsed),
};
