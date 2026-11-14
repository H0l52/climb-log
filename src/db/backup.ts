import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { ClimbDB } from './schema';
import type { EpochMs, Photo, Problem } from './types';
import {
  BACKUP_JSON, BackupError, EXPORT_APP, EXPORT_TABLES, NOT_A_BACKUP, SCHEMA_VERSION, photoPath, thumbPath, validateExport,
  type ExportFile, type ExportTable,
} from '../domain/exportFormat';
import { melbourneDate } from '../domain/dates';

export interface BuiltBackup {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  file: ExportFile;
}

/** A backup read from disk and checked, with its photo bytes, ready to import. */
export interface ParsedBackup {
  file: ExportFile;
  photos: Map<string, { blob: Uint8Array; thumb: Uint8Array }>;
}

const bytesOf = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());
const tableOf = (db: ClimbDB, name: ExportTable) => db.table(name);

/**
 * Read the whole database into an export file. `backupLastAt` is written as `exportedAt` in the file, so the
 * imported copy remembers this backup. A zip holds the JSON and `photos/`; without photos the JSON is the file.
 */
export async function buildBackup(db: ClimbDB, opts: { now: EpochMs; includePhotos: boolean }): Promise<BuiltBackup> {
  const { tables, photos } = await db.transaction('r', [...EXPORT_TABLES.map((t) => tableOf(db, t)), db.photos], async () => {
    const out = {} as Record<ExportTable, Record<string, unknown>[]>;
    for (const name of EXPORT_TABLES) out[name] = await tableOf(db, name).toArray();
    return { tables: out, photos: opts.includePhotos ? await db.photos.toArray() : [] };
  });
  tables.settings = [
    ...tables.settings.filter((s) => s.key !== 'backupLastAt'),
    { key: 'backupLastAt', value: opts.now },
  ];
  const file: ExportFile = {
    app: EXPORT_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: opts.now,
    tables,
    photos: photos.map((p) => ({ id: p.id, createdAt: p.createdAt, file: photoPath(p.id), thumb: thumbPath(p.id) })),
  };
  const base = `climb-log-${melbourneDate(opts.now)}`;
  const json = JSON.stringify(file);
  if (!opts.includePhotos) return { bytes: strToU8(json), filename: `${base}.json`, mime: 'application/json', file };

  const zip: Zippable = { [BACKUP_JSON]: strToU8(json) };
  for (const p of photos) {
    // JPEGs are already compressed: store them as they are.
    zip[photoPath(p.id)] = [await bytesOf(p.blob), { level: 0 }];
    zip[thumbPath(p.id)] = [await bytesOf(p.thumb), { level: 0 }];
  }
  return { bytes: zipSync(zip, { level: 6 }), filename: `${base}.zip`, mime: 'application/zip', file };
}

const isZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Read a backup (.zip or .json), check it and migrate it to the current format. Throws BackupError. */
export function parseBackup(bytes: Uint8Array): ParsedBackup {
  let entries: Record<string, Uint8Array> = {};
  let text: string;
  try {
    if (isZip(bytes)) {
      entries = unzipSync(bytes);
      const json = entries[BACKUP_JSON];
      if (!json) throw new BackupError(NOT_A_BACKUP);
      text = strFromU8(json);
    } else {
      text = strFromU8(bytes);
    }
  } catch (e) {
    throw e instanceof BackupError ? e : new BackupError(NOT_A_BACKUP);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  const file = validateExport(raw);
  const photos = new Map<string, { blob: Uint8Array; thumb: Uint8Array }>();
  for (const p of file.photos) {
    const blob = entries[p.file];
    const thumb = entries[p.thumb];
    if (!blob || !thumb) throw new BackupError('This backup is missing photo files. Export it again with photos, or turn photos off.');
    photos.set(p.id, { blob, thumb });
  }
  return { file, photos };
}

/**
 * Replace the whole database with a parsed backup, in one transaction. Photos the file does not carry
 * (a JSON-only backup) are cleared from their problems, so no problem points at a missing photo.
 */
export async function importBackup(db: ClimbDB, parsed: ParsedBackup): Promise<void> {
  const { file } = parsed;
  // Build blobs before the transaction: Safari aborts transactions that await non-Dexie work.
  const photos: Photo[] = file.photos.map((p) => {
    const bytes = parsed.photos.get(p.id)!;
    return {
      id: p.id,
      createdAt: p.createdAt,
      blob: new Blob([bytes.blob as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
      thumb: new Blob([bytes.thumb as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
    };
  });
  const have = new Set(photos.map((p) => p.id));
  const problems = (file.tables.problems as unknown as Problem[]).map((p) => (p.photoId && !have.has(p.photoId) ? { ...p, photoId: null } : p));

  await db.transaction('rw', [...EXPORT_TABLES.map((t) => tableOf(db, t)), db.photos], async () => {
    for (const name of EXPORT_TABLES) await tableOf(db, name).clear();
    await db.photos.clear();
    for (const name of EXPORT_TABLES) await tableOf(db, name).bulkAdd(name === 'problems' ? problems : file.tables[name]);
    await db.photos.bulkAdd(photos);
  });
}
