import { describe, expect, it } from 'vitest';
import { BackupError, EXPORT_TABLES, NOT_A_BACKUP, SCHEMA_VERSION, exportSummary, validateExport, type ExportFile } from './exportFormat';

const valid = (over: Partial<ExportFile> = {}): ExportFile => ({
  app: 'climb-log',
  schemaVersion: SCHEMA_VERSION,
  exportedAt: 1,
  tables: Object.fromEntries(EXPORT_TABLES.map((t) => [t, []])) as unknown as ExportFile['tables'],
  photos: [],
  ...over,
});

const message = (raw: unknown, ...rest: Parameters<typeof validateExport> extends [unknown, ...infer R] ? R : never) => {
  try {
    validateExport(raw, ...rest);
    return null;
  } catch (e) {
    expect(e).toBeInstanceOf(BackupError);
    return (e as Error).message;
  }
};

describe('validateExport', () => {
  it('accepts a current file', () => {
    expect(validateExport(valid()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('refuses a file from another app with a clear message', () => {
    expect(message({ app: 'other-app', schemaVersion: 1, tables: {} })).toBe(NOT_A_BACKUP);
    expect(message({ name: 'climbs', items: [] })).toBe(NOT_A_BACKUP);
    expect(message([1, 2, 3])).toBe(NOT_A_BACKUP);
    expect(message(null)).toBe(NOT_A_BACKUP);
    expect(NOT_A_BACKUP).toBe('This file is not a Climb Log backup.');
  });

  it('refuses a higher schemaVersion and says to update the app', () => {
    const m = message(valid({ schemaVersion: SCHEMA_VERSION + 1 }));
    expect(m).toMatch(/newer version of Climb Log/);
    expect(m).toMatch(/Update the app/);
  });

  it('migrates an older schemaVersion step by step', () => {
    const v1 = { ...valid(), schemaVersion: 1, tables: { ...valid().tables, goals: undefined } } as unknown as ExportFile;
    const out = validateExport(v1, 3, {
      1: (f) => ({ ...f, tables: { ...f.tables, goals: [] } }),
      2: (f) => ({ ...f, tables: { ...f.tables, goals: [{ id: 'added-by-v3' }] } }),
    });
    expect(out.schemaVersion).toBe(3);
    expect(out.tables.goals).toEqual([{ id: 'added-by-v3' }]);
  });

  it('refuses an older version it has no migration for', () => {
    expect(message({ ...valid(), schemaVersion: 1 }, 2, {})).toMatch(/cannot convert/);
  });

  it('refuses damaged files', () => {
    const rest: Partial<ExportFile['tables']> = { ...valid().tables };
    delete rest.gyms;
    expect(message({ ...valid(), tables: rest })).toMatch(/"gyms" is missing/);
    expect(message(valid({ tables: { ...valid().tables, walls: [{ name: 'no id' }] } }))).toMatch(/"walls" has a bad row/);
    expect(message({ ...valid(), photos: [{ id: 'x' }] })).toMatch(/photo list/);
  });

  it('summarises what an import will bring', () => {
    const f = valid({ tables: { ...valid().tables, sessions: [{ id: 's' }], attempts: [{ id: 'a' }, { id: 'b' }] } });
    expect(exportSummary(f)).toEqual({ sessions: 1, climbs: 2, board: 0, photos: 0, exportedAt: 1 });
  });
});
