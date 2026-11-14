import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensurePersistence, readStorageStatus } from './persistence';
import { ClimbDB } from './schema';
import { freshDb, reposFor } from './__fixtures__/testDb';

let db: ClimbDB;
afterEach(async () => {
  db.close();
  await db.delete();
});

function fakeStorage(granted: boolean) {
  return {
    persist: vi.fn(async () => granted),
    persisted: vi.fn(async () => granted),
    estimate: vi.fn(async () => ({ usage: 1234, quota: 10_000 })),
  };
}

describe('storage persistence', () => {
  it('asks once on first launch and records the result', async () => {
    db = freshDb();
    const repos = reposFor(db);
    const s = fakeStorage(true);
    expect(await ensurePersistence(repos, s)).toBe(true);
    expect(s.persist).toHaveBeenCalledTimes(1);
    expect(await repos.settings.get('persistGranted')).toBe(true);

    await ensurePersistence(repos, s);
    expect(s.persist).toHaveBeenCalledTimes(1);
    expect(s.persisted).toHaveBeenCalledTimes(1);
  });

  it('records null when the API is missing', async () => {
    db = freshDb();
    const repos = reposFor(db);
    expect(await ensurePersistence(repos, undefined)).toBeNull();
    expect(await repos.settings.get('persistGranted')).toBeNull();
  });

  it('reads status and usage', async () => {
    db = freshDb();
    expect(await readStorageStatus(fakeStorage(false))).toEqual({ supported: true, persisted: false, usage: 1234, quota: 10_000 });
    expect(await readStorageStatus(undefined)).toMatchObject({ supported: false });
  });
});
