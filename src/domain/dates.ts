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
