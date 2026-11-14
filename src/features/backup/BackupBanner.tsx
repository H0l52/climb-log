import { repos } from '../../db';
import { useFirstSessionAt, useSetting } from '../../db/hooks';
import type { EpochMs } from '../../db/types';
import { backupReminderDue, daysSinceBackup } from '../../domain/backup';
import { href } from '../../app/router';
import { plural } from '../log/labels';

/** Today's reminder when the last backup is more than 30 days old. Dismiss snoozes it for a week. */
export function BackupBanner({ now }: { now: EpochMs }) {
  const lastBackupAt = useSetting<EpochMs>('backupLastAt');
  const dismissedAt = useSetting<EpochMs>('backupReminderDismissedAt');
  const firstSessionAt = useFirstSessionAt();
  if (firstSessionAt === undefined) return null;
  const state = { lastBackupAt: lastBackupAt ?? null, dismissedAt: dismissedAt ?? null, firstSessionAt, now };
  if (!backupReminderDue(state)) return null;
  const days = daysSinceBackup(state)!;
  return (
    <div className="inline-banner" role="status" data-testid="backup-banner">
      <span className="grow">{lastBackupAt ? `Last backup ${plural(days, 'day')} ago` : 'No backup yet'}. Your climbs live only on this phone.</span>
      <div className="row">
        <a className="btn btn-small btn-primary" href={href('/settings')}>Back up</a>
        <button type="button" className="btn btn-small" onClick={() => void repos.settings.set('backupReminderDismissedAt', Date.now())}>Dismiss</button>
      </div>
    </div>
  );
}
