import type { EpochMs, ISODate } from '../db/types';

export const APP_TIME_ZONE = 'Australia/Melbourne';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Melbourne calendar date for an instant. Never use toISOString() for this (UTC). */
export function melbourneDate(at: EpochMs): ISODate {
  const parts = fmt.formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** ISO weekday (Monday = 1 … Sunday = 7) of a calendar date. */
export function isoWeekday(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const dayFmt = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

/** 'Sat 14 Nov' for a calendar date. */
export function formatDate(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d))).replace(',', '');
}

const timeFmt = new Intl.DateTimeFormat('en-AU', { timeZone: APP_TIME_ZONE, hour: 'numeric', minute: '2-digit' });

/** Melbourne clock time, e.g. '6:05 pm'. */
export function formatTime(at: EpochMs): string {
  return timeFmt.format(new Date(at));
}

const toUtc = (date: ISODate): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number): ISODate => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Calendar arithmetic on dates (no time zone involved: the date is already a Melbourne date). */
export function addDays(date: ISODate, days: number): ISODate {
  return fromUtc(toUtc(date) + days * 86_400_000);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}
