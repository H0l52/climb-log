import type { EpochMs, ID } from '../db/types';

/** Identifies a climb-log backup. */
export const EXPORT_APP = 'climb-log';
/** Current export format version. Bump with every schema change and add a step to MIGRATIONS. */
export const SCHEMA_VERSION = 1;
/** Name of the JSON file inside a backup zip. */
export const BACKUP_JSON = 'climb-log.json';

/** Every table in the export, in the order they are written. Photos travel separately. */
export const EXPORT_TABLES = [
  'gyms', 'gradeSystems', 'gradeBands', 'walls', 'wallSets', 'problems',
  'sessions', 'attempts', 'boardLogs', 'goals', 'settings',
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface ExportPhoto {
  id: ID;
  createdAt: EpochMs;
  /** Path of the full photo inside the zip. */
  file: string;
  /** Path of the thumbnail inside the zip. */
  thumb: string;
}

export interface ExportFile {
  app: typeof EXPORT_APP;
  schemaVersion: number;
  exportedAt: EpochMs;
  tables: Record<ExportTable, Record<string, unknown>[]>;
  photos: ExportPhoto[];
}

export const photoPath = (id: ID) => `photos/${id}.jpg`;
export const thumbPath = (id: ID) => `photos/${id}.thumb.jpg`;

/** One step from version n to n + 1. */
export type Migration = (file: ExportFile) => ExportFile;
/** MIGRATIONS[n] upgrades a version-n file to n + 1. Empty while there is only version 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export const NOT_A_BACKUP = 'This file is not a Climb Log backup.';
export const newerVersionMessage = (v: number) =>
  `This backup was made by a newer version of Climb Log (format ${v}; this app reads up to ${SCHEMA_VERSION}). Update the app, then import again.`;

export class BackupError extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Check a parsed backup and bring it up to the current format.
 * Refuses files from another app and files newer than this app. Throws BackupError with a user-facing message.
 */
export function validateExport(raw: unknown, current = SCHEMA_VERSION, migrations: Readonly<Record<number, Migration>> = MIGRATIONS): ExportFile {
  if (!isRecord(raw) || raw.app !== EXPORT_APP) throw new BackupError(NOT_A_BACKUP);
  const v = raw.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new BackupError(NOT_A_BACKUP);
  if (v > current) throw new BackupError(newerVersionMessage(v));
  if (typeof raw.exportedAt !== 'number' || !isRecord(raw.tables)) throw new BackupError('This backup is damaged: it has no tables.');

  let file = raw as unknown as ExportFile;
  for (let n = v; n < current; n++) {
    const step = migrations[n];
    if (!step) throw new BackupError(`This backup uses format ${v}, which this app cannot convert.`);
    file = { ...step(file), schemaVersion: n + 1 };
  }

  const tables = file.tables as Record<string, unknown>;
  for (const name of EXPORT_TABLES) {
    const rows = tables[name];
    if (!Array.isArray(rows)) throw new BackupError(`This backup is damaged: "${name}" is missing.`);
    const key = name === 'settings' ? 'key' : 'id';
    if (!rows.every((r) => isRecord(r) && typeof r[key] === 'string')) throw new BackupError(`This backup is damaged: "${name}" has a bad row.`);
  }
  const photos = (file as { photos?: unknown }).photos ?? [];
  if (!Array.isArray(photos) || !photos.every((p) => isRecord(p) && typeof p.id === 'string' && typeof p.createdAt === 'number' && typeof p.file === 'string' && typeof p.thumb === 'string')) {
    throw new BackupError('This backup is damaged: the photo list is unreadable.');
  }
  return { ...file, photos: photos as ExportPhoto[] };
}

/** Counts shown before an import replaces the data. */
export function exportSummary(file: ExportFile): { sessions: number; climbs: number; board: number; photos: number; exportedAt: EpochMs } {
  return {
    sessions: file.tables.sessions.length,
    climbs: file.tables.attempts.length,
    board: file.tables.boardLogs.length,
    photos: file.photos.length,
    exportedAt: file.exportedAt,
  };
}
