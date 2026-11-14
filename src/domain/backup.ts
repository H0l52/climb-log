import type { EpochMs } from '../db/types';
import { daysBetween, melbourneDate } from './dates';

/** The reminder shows once the last backup is more than this many calendar days old. */
export const BACKUP_REMINDER_DAYS = 30;
/** "Dismiss" hides the reminder for this many days. */
export const BACKUP_SNOOZE_DAYS = 7;

export interface BackupState {
  /** Last successful export; null when never exported. */
  lastBackupAt: EpochMs | null;
  /** First session ever started; null when nothing is logged (nothing to lose, no reminder). */
  firstSessionAt: EpochMs | null;
  /** When the reminder was last dismissed. */
  dismissedAt: EpochMs | null;
  now: EpochMs;
}

/** Whole Melbourne calendar days since the last backup (or, with none, since the first session). Null with no data. */
export function daysSinceBackup(s: Pick<BackupState, 'lastBackupAt' | 'firstSessionAt' | 'now'>): number | null {
  const from = s.lastBackupAt ?? s.firstSessionAt;
  return from === null ? null : daysBetween(melbourneDate(from), melbourneDate(s.now));
}

/** True when the Today banner should show: more than 30 days since the last backup and not snoozed. */
export function backupReminderDue(s: BackupState): boolean {
  const days = daysSinceBackup(s);
  if (days === null || days <= BACKUP_REMINDER_DAYS) return false;
  if (s.dismissedAt !== null && daysBetween(melbourneDate(s.dismissedAt), melbourneDate(s.now)) < BACKUP_SNOOZE_DAYS) return false;
  return true;
}
