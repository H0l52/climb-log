import { useEffect, useState } from 'react';
import { readStorageStatus, type StorageStatus } from '../../db/persistence';
import { useSetting } from '../../db/hooks';

function formatBytes(n: number | null): string {
  if (n === null) return '–';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const asked = useSetting<boolean | null>('persistGranted');

  useEffect(() => {
    let live = true;
    void readStorageStatus(typeof navigator !== 'undefined' ? navigator.storage : undefined).then((s) => live && setStatus(s));
    return () => { live = false; };
  }, [asked]);

  const persisted = status?.persisted ?? asked ?? null;
  const label = persisted === true ? 'Granted' : persisted === false ? 'Not granted' : 'Not supported';

  return (
    <section className="section" aria-labelledby="storage-h">
      <h2 id="storage-h">Storage</h2>
      <dl className="kv">
        <dt>Persistent storage</dt>
        <dd data-testid="persist-status">{label}</dd>
        <dt>Used</dt>
        <dd>{formatBytes(status?.usage ?? null)}</dd>
      </dl>
      <p className="muted">
        Your climbs are stored on this phone only.
        {persisted !== true && ' Without persistent storage the browser may clear them if the app is unused for a while. Add the app to your Home Screen and export backups.'}
      </p>
    </section>
  );
}
