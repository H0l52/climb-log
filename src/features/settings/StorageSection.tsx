import { useEffect, useState } from 'react';
import { repos } from '../../db';
import { readStorageStatus, type StorageStatus } from '../../db/persistence';
import { usePhotoUsage, useSetting } from '../../db/hooks';
import { RETENTION_CHOICES, retentionDays } from '../../domain/photos';
import { formatBytes } from '../../ui/format';
import { useAction } from './useAction';

export function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const asked = useSetting<boolean | null>('persistGranted');
  const photos = usePhotoUsage();
  const retention = retentionDays(useSetting<number>('photoRetentionDays'));
  const { error, run } = useAction();

  useEffect(() => {
    let live = true;
    void readStorageStatus(typeof navigator !== 'undefined' ? navigator.storage : undefined).then((s) => live && setStatus(s));
    return () => { live = false; };
  }, [asked, photos?.bytes]);

  const persisted = status?.persisted ?? asked ?? null;
  const label = persisted === true ? 'Granted' : persisted === false ? 'Not granted' : 'Not supported';

  return (
    <section className="section" aria-labelledby="storage-h">
      <h2 id="storage-h">Storage</h2>
      <dl className="kv">
        <dt>Persistent storage</dt>
        <dd data-testid="persist-status">{label}</dd>
        <dt>Used</dt>
        <dd data-testid="storage-used">{formatBytes(status?.usage ?? null)}</dd>
        <dt>Photos</dt>
        <dd data-testid="photo-usage">{photos ? `${photos.count} · ${formatBytes(photos.bytes)}` : '–'}</dd>
      </dl>
      <p className="muted">
        Your climbs are stored on this phone only.
        {persisted !== true && ' Without persistent storage the browser may clear them if the app is unused for a while. Add the app to your Home Screen and export backups.'}
      </p>
      <h3 className="label" id="retention-h">Keep photos of reset sets for</h3>
      <div className="chips" role="group" aria-labelledby="retention-h">
        {RETENTION_CHOICES.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={retention === d}
            onClick={() => void run(async () => {
              await repos.settings.set('photoRetentionDays', d);
              await repos.photos.applyRetention();
            })}
          >
            {d} days
          </button>
        ))}
      </div>
      <p className="muted hint">Photos of climbs on a set retired longer ago are deleted. The climbs stay.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
