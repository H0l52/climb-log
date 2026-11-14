import { strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeed } from './seed';
import { ClimbDB } from './schema';
import { buildBackup, importBackup, parseBackup } from './backup';
import { FIXED_NOW, freshDb, reposFor, seed, testClock } from './__fixtures__/testDb';
import { BACKUP_JSON, BackupError, NOT_A_BACKUP, SCHEMA_VERSION } from '../domain/exportFormat';

const DAY = 86_400_000;
const MIN = 60_000;
const gymId = seed.gyms[0]!.id;
const boulders = seed.walls.filter((w) => w.gymId === gymId && w.kind === 'boulder').map((w) => w.id);
const board = seed.walls.find((w) => w.gymId === gymId && w.kind === 'board')!.id;
const [band1, band2] = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.id) as [string, string];

let db: ClimbDB;
let clock: ReturnType<typeof testClock>;
let repos: ReturnType<typeof reposFor>;

/** Fake JPEG bytes: distinct per photo so a mix-up would show. */
const jpeg = (seedByte: number, size: number) => new Blob([Uint8Array.from({ length: size }, (_, i) => (seedByte * 31 + i * 7) % 256)], { type: 'image/jpeg' });
const photo = (n: number) => ({ blob: jpeg(n, 2000 + n), thumb: jpeg(n + 100, 300 + n) });

/** A database with every table in use: sessions, climbs with photos, a reset, board logs, a goal, settings. */
async function buildData() {
  await applySeed(db, seed, { now: FIXED_NOW - 30 * DAY });
  clock.advance(-10 * DAY);
  await repos.logging.logNew({ wallId: boulders[0]!, gradeBandId: band1, tries: 1, success: true, photo: photo(1) });
  clock.advance(MIN);
  const proj = await repos.logging.logNew({ wallId: boulders[0]!, gradeBandId: band2, tries: 2, success: false, nickname: 'pinchy', photo: photo(2), felt: 'hard', notes: 'left heel' });
  clock.advance(MIN);
  await repos.board.log({ wallId: board, climbName: 'Board one', angle: 40, vGrade: 4, tries: 2, success: true });
  clock.advance(DAY);
  await repos.resets.mark(boulders[0]!, '2026-11-05');
  clock.advance(2 * DAY);
  await repos.logging.logNew({ wallId: boulders[1]!, gradeBandId: band2, tries: 3, success: true, photo: photo(3) });
  await repos.goals.add({ type: 'sends-of-colour', gradeBandId: band2, target: 3, deadline: null });
  await repos.settings.set('photoRetentionDays', 180);
  return proj;
}

/** Every table, rows sorted by key, with photo blobs read as bytes so they compare by content. */
async function snapshot(d: ClimbDB) {
  const out: Record<string, unknown[]> = {};
  for (const t of d.tables) {
    const rows = await t.toArray();
    out[t.name] = await Promise.all(
      rows
        .sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)))
        .map(async (r) =>
          t.name === 'photos'
            ? { ...r, blob: [r.blob.type, [...new Uint8Array(await r.blob.arrayBuffer())]], thumb: [r.thumb.type, [...new Uint8Array(await r.thumb.arrayBuffer())]] }
            : r,
        ),
    );
  }
  return out;
}

beforeEach(() => {
  db = freshDb();
  clock = testClock();
  repos = reposFor(db, clock);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('export → clear → import', () => {
  it('yields a deep-equal database, photos included', async () => {
    await buildData();
    const built = await buildBackup(db, { now: clock.now(), includePhotos: true });
    // The app records the backup once it is saved; the file already carries that value.
    await repos.settings.set('backupLastAt', clock.now());
    const before = await snapshot(db);
    expect(before.photos).toHaveLength(3);
    expect(before.boardLogs).toHaveLength(1);
    expect(before.wallSets!.some((s) => (s as { retiredDate: string | null }).retiredDate)).toBe(true);

    // Clear: delete the database and open an empty one under the same name (no seed).
    const name = db.name;
    db.close();
    await db.delete();
    db = new ClimbDB(name);
    await db.open();
    expect((await snapshot(db)).problems).toEqual([]);

    await importBackup(db, parseBackup(built.bytes));
    expect(await snapshot(db)).toEqual(before);
  });

  it('writes a zip with the JSON and one file per photo and thumbnail', async () => {
    await buildData();
    const built = await buildBackup(db, { now: clock.now(), includePhotos: true });
    expect(built.filename).toBe('climb-log-2026-11-07.zip');
    const files = Object.keys(unzipSync(built.bytes)).sort();
    expect(files).toHaveLength(1 + 3 * 2);
    expect(files).toContain(BACKUP_JSON);
    expect(files.filter((f) => f.endsWith('.thumb.jpg'))).toHaveLength(3);
    expect(built.file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(built.file.tables.settings).toContainEqual({ key: 'backupLastAt', value: clock.now() });
  });

  it('without photos writes JSON only, and the import clears dangling photo references', async () => {
    await buildData();
    const built = await buildBackup(db, { now: clock.now(), includePhotos: false });
    expect(built.mime).toBe('application/json');
    expect(built.file.photos).toEqual([]);
    const before = await snapshot(db);
    await importBackup(db, parseBackup(built.bytes));
    const after = await snapshot(db);
    expect(after.photos).toEqual([]);
    expect((after.problems as { photoId: string | null }[]).every((p) => p.photoId === null)).toBe(true);
    expect(after.problems).toHaveLength(before.problems!.length);
    expect(after.attempts).toEqual(before.attempts);
    expect(after.boardLogs).toEqual(before.boardLogs);
  });

  it('import replaces data that was there before', async () => {
    await buildData();
    const built = await buildBackup(db, { now: clock.now(), includePhotos: true });
    clock.advance(MIN);
    await repos.logging.logNew({ wallId: boulders[2]!, gradeBandId: band1, tries: 1, success: true });
    expect(await db.attempts.count()).toBe(4);
    await importBackup(db, parseBackup(built.bytes));
    expect(await db.attempts.count()).toBe(3);
  });
});

describe('parseBackup refuses bad files', () => {
  const refuse = (bytes: Uint8Array): string => {
    try {
      parseBackup(bytes);
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      return (e as Error).message;
    }
    throw new Error('accepted');
  };

  it('a higher schemaVersion, as JSON or zip', async () => {
    await buildData();
    const { file } = await buildBackup(db, { now: clock.now(), includePhotos: false });
    const newer = JSON.stringify({ ...file, schemaVersion: SCHEMA_VERSION + 1 });
    expect(refuse(strToU8(newer))).toMatch(/newer version of Climb Log.*Update the app/);
    expect(refuse(zipSync({ [BACKUP_JSON]: strToU8(newer) }))).toMatch(/newer version/);
  });

  it('a file from another app', () => {
    expect(refuse(strToU8(JSON.stringify({ app: 'some-other-app', schemaVersion: 1, tables: {} })))).toBe(NOT_A_BACKUP);
    expect(refuse(zipSync({ 'data.json': strToU8('{}') }))).toBe(NOT_A_BACKUP);
    expect(refuse(strToU8('date,climb\n2026-01-01,V3'))).toBe(NOT_A_BACKUP);
    expect(refuse(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toBe(NOT_A_BACKUP);
  });

  it('a zip that lost its photo files', async () => {
    await buildData();
    const built = await buildBackup(db, { now: clock.now(), includePhotos: true });
    const files = unzipSync(built.bytes);
    expect(refuse(zipSync({ [BACKUP_JSON]: files[BACKUP_JSON]! }))).toMatch(/missing photo files/);
  });
});
