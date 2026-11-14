import type { EpochMs, ID, ISODate, Problem, WallSet } from '../db/types';
import { daysBetween } from './dates';

/** Stored photo: long edge in px, starting JPEG quality and size ceiling (docs/data-model.md, Photos). */
export const PHOTO_MAX_EDGE = 1280;
export const THUMB_MAX_EDGE = 160;
export const PHOTO_QUALITY = 0.7;
export const THUMB_QUALITY = 0.7;
export const PHOTO_MAX_BYTES = 300 * 1024;
export const THUMB_MAX_BYTES = 15 * 1024;
/** Lowest quality the size ladder goes to before keeping the smallest result. */
export const MIN_QUALITY = 0.4;
export const DEFAULT_RETENTION_DAYS = 90;
export const RETENTION_CHOICES: readonly number[] = [30, 90, 180, 365];
/** A photo no problem points at (its only entry was deleted) is removed after this grace period, which outlasts Undo. */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/** Size that fits within `maxEdge` on the long edge, keeping the aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error('Image has no size');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Qualities to try in order: start, then down in 0.1 steps to MIN_QUALITY. */
export function qualityLadder(start: number, min = MIN_QUALITY): number[] {
  const out: number[] = [];
  for (let q = Math.round(start * 10); q >= Math.round(min * 10); q--) out.push(q / 10);
  return out.length ? out : [start];
}

/**
 * Encode at the starting quality and step down until the result fits `maxBytes`.
 * Returns the first result that fits, else the smallest one tried.
 */
export async function encodeWithin<T extends { size: number }>(encode: (quality: number) => Promise<T>, start: number, maxBytes: number): Promise<T> {
  let best: T | null = null;
  for (const q of qualityLadder(start)) {
    const out = await encode(q);
    if (out.size <= maxBytes) return out;
    if (!best || out.size < best.size) best = out;
  }
  return best!;
}

/** Retention setting, falling back to the default for missing or invalid values. */
export function retentionDays(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : DEFAULT_RETENTION_DAYS;
}

/**
 * Problems whose photo is past retention: the problem's set was retired more than `days` days before `today`.
 * Problems on current sets, or retired within the window, keep their photos. The problems themselves always stay.
 */
export function photosPastRetention(
  problems: readonly Pick<Problem, 'id' | 'wallSetId' | 'photoId'>[],
  wallSets: readonly Pick<WallSet, 'id' | 'retiredDate'>[],
  today: ISODate,
  days: number,
): { problemId: ID; photoId: ID }[] {
  const retired = new Map(wallSets.flatMap((s) => (s.retiredDate ? [[s.id, s.retiredDate] as const] : [])));
  return problems.flatMap((p) => {
    const date = retired.get(p.wallSetId);
    return p.photoId && date && daysBetween(date, today) > days ? [{ problemId: p.id, photoId: p.photoId }] : [];
  });
}

/** Photos no problem refers to, older than the grace period. */
export function orphanPhotos(
  photos: readonly { id: ID; createdAt: EpochMs }[],
  problems: readonly Pick<Problem, 'photoId'>[],
  now: EpochMs,
): ID[] {
  const used = new Set(problems.map((p) => p.photoId).filter(Boolean));
  return photos.filter((p) => !used.has(p.id) && now - p.createdAt > ORPHAN_GRACE_MS).map((p) => p.id);
}
