import { describe, expect, it } from 'vitest';
import { backupReminderDue, daysSinceBackup } from './backup';

const DAY = 86_400_000;
/** 2026-11-14 10:00 Melbourne. */
const T0 = Date.UTC(2026, 10, 13, 23, 0, 0);

describe('backup reminder', () => {
  const base = { lastBackupAt: T0, firstSessionAt: T0 - 100 * DAY, dismissedAt: null };

  it('is quiet at 30 days and due at 31', () => {
    expect(backupReminderDue({ ...base, now: T0 + 30 * DAY })).toBe(false);
    expect(backupReminderDue({ ...base, now: T0 + 31 * DAY })).toBe(true);
  });
  it('counts Melbourne calendar days, not 24-hour blocks', () => {
    // 23:59 on day 30 is still day 30; 00:01 the next day is day 31.
    const late = Date.UTC(2026, 10, 14, 12, 59); // 2026-11-14 23:59 Melbourne
    expect(daysSinceBackup({ lastBackupAt: T0, firstSessionAt: null, now: late + 30 * DAY })).toBe(30);
    expect(daysSinceBackup({ lastBackupAt: T0, firstSessionAt: null, now: late + 30 * DAY + 2 * 60_000 })).toBe(31);
  });
  it('clears after an export', () => {
    const now = T0 + 40 * DAY;
    expect(backupReminderDue({ ...base, now })).toBe(true);
    expect(backupReminderDue({ ...base, lastBackupAt: now, now })).toBe(false);
  });
  it('with no backup ever, counts from the first session', () => {
    expect(backupReminderDue({ lastBackupAt: null, firstSessionAt: T0, dismissedAt: null, now: T0 + 31 * DAY })).toBe(true);
    expect(backupReminderDue({ lastBackupAt: null, firstSessionAt: T0, dismissedAt: null, now: T0 + 5 * DAY })).toBe(false);
  });
  it('never shows with nothing logged', () => {
    expect(backupReminderDue({ lastBackupAt: null, firstSessionAt: null, dismissedAt: null, now: T0 })).toBe(false);
  });
  it('Dismiss snoozes it for 7 days', () => {
    const now = T0 + 40 * DAY;
    expect(backupReminderDue({ ...base, dismissedAt: now - 6 * DAY, now })).toBe(false);
    expect(backupReminderDue({ ...base, dismissedAt: now - 7 * DAY, now })).toBe(true);
  });
});
