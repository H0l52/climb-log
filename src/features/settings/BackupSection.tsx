import { useState } from 'react';
import { backup, repos } from '../../db';
import type { BuiltBackup, ParsedBackup } from '../../db/backup';
import { usePhotoUsage, useSetting } from '../../db/hooks';
import type { EpochMs } from '../../db/types';
import { daysBetween, formatDate, melbourneDate } from '../../domain/dates';
import { exportSummary } from '../../domain/exportFormat';
import { formatBytes } from '../../ui/format';
import { showToast } from '../../ui/toast';
import { plural } from '../log/labels';

/** Share sheet when the browser can share files (iOS: Save to Files), else a download. False when cancelled. */
async function deliver(built: BuiltBackup): Promise<boolean> {
  const file = new File([built.bytes as Uint8Array<ArrayBuffer>], built.filename, { type: built.mime });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: built.filename });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = built.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

function lastBackupLine(at: EpochMs | undefined): string {
  if (!at) return 'Never';
  const days = daysBetween(melbourneDate(at), melbourneDate(Date.now()));
  return `${formatDate(melbourneDate(at))} · ${days === 0 ? 'today' : `${plural(days, 'day')} ago`}`;
}

export function BackupSection() {
  const lastAt = useSetting<EpochMs>('backupLastAt');
  const includeSetting = useSetting<boolean>('exportIncludePhotos');
  const includePhotos = includeSetting ?? true;
  const photos = usePhotoUsage();
  const [prepared, setPrepared] = useState<BuiltBackup | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  async function prepare() {
    setBusy(true);
    setError(null);
    try {
      setPrepared(await backup.build({ now: Date.now(), includePhotos }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function save(built: BuiltBackup) {
    setError(null);
    try {
      if (await deliver(built)) {
        await repos.settings.set('backupLastAt', built.file.exportedAt);
        setPrepared(null);
        showToast('Backup saved');
      }
    } catch (e) {
      fail(e);
    }
  }

  async function pick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError(null);
    setPending(null);
    try {
      setPending(backup.parse(new Uint8Array(await file.arrayBuffer())));
    } catch (e) {
      fail(e);
    }
  }

  async function replace(parsed: ParsedBackup) {
    setBusy(true);
    try {
      await backup.replaceWith(parsed);
      setPending(null);
      showToast('Backup imported');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const summary = pending && exportSummary(pending.file);

  return (
    <section className="section" aria-labelledby="backup-h">
      <h2 id="backup-h">Backup</h2>
      <dl className="kv">
        <dt>Last backup</dt>
        <dd data-testid="last-backup">{lastBackupLine(lastAt)}</dd>
      </dl>

      <div className="stack" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="chip"
          aria-pressed={includePhotos}
          onClick={() => { setPrepared(null); void repos.settings.set('exportIncludePhotos', !includePhotos); }}
        >
          Include photos{photos ? ` · ${photos.count} · ${formatBytes(photos.bytes)}` : ''}
        </button>
        {prepared ? (
          <div className="sheet stack">
            <p className="muted">{prepared.filename} · {formatBytes(prepared.bytes.length)}</p>
            <div className="sheet-actions">
              <button type="button" className="btn" onClick={() => setPrepared(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => void save(prepared)}>Save backup</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void prepare()}>Export backup</button>
        )}
        <label className="btn file-btn">
          Import backup
          <input type="file" accept=".zip,.json,application/zip,application/json" className="visually-hidden" disabled={busy} onChange={(e) => void pick(e.currentTarget)} />
        </label>
      </div>

      {pending && summary && (
        <div className="sheet stack" role="group" aria-label="Confirm import" style={{ marginTop: 12 }}>
          <p>
            Replace everything on this phone with the backup from {formatDate(melbourneDate(summary.exportedAt))}?
            It has {plural(summary.sessions, 'session')}, {plural(summary.climbs, 'climb')}
            {summary.board ? `, ${summary.board} board` : ''} and {plural(summary.photos, 'photo')}.
          </p>
          <p className="muted">What is on this phone now is lost unless you export it first.</p>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void replace(pending)}>Replace data</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </section>
  );
}
