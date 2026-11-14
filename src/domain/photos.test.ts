import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETENTION_DAYS, ORPHAN_GRACE_MS, encodeWithin, fitWithin, orphanPhotos, photosPastRetention, qualityLadder, retentionDays,
} from './photos';

describe('fitWithin', () => {
  it('scales the long edge down to the limit, keeping the aspect ratio', () => {
    expect(fitWithin(4032, 3024, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3024, 4032, 1280)).toEqual({ width: 960, height: 1280 });
    expect(fitWithin(4032, 3024, 160)).toEqual({ width: 160, height: 120 });
  });
  it('never upscales and never returns zero', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1, 160)).toEqual({ width: 160, height: 1 });
  });
  it('rejects an image with no size', () => {
    expect(() => fitWithin(0, 100, 160)).toThrow();
  });
});

describe('quality ladder', () => {
  it('starts at the given quality and steps down by 0.1 to 0.4', () => {
    expect(qualityLadder(0.7)).toEqual([0.7, 0.6, 0.5, 0.4]);
  });
  it('returns the first encoding that fits', async () => {
    const tried: number[] = [];
    const out = await encodeWithin(async (q) => (tried.push(q), { size: q * 1000, q }), 0.7, 550);
    expect(out.q).toBe(0.5);
    expect(tried).toEqual([0.7, 0.6, 0.5]);
  });
  it('keeps the smallest result when nothing fits', async () => {
    const out = await encodeWithin(async (q) => ({ size: 1000 + q, q }), 0.7, 10);
    expect(out.q).toBe(0.4);
  });
  it('does not re-encode when the first try fits', async () => {
    let calls = 0;
    await encodeWithin(async () => (calls++, { size: 1 }), 0.7, 10);
    expect(calls).toBe(1);
  });
});

describe('retention', () => {
  const sets = [
    { id: 'current', retiredDate: null },
    { id: 'old', retiredDate: '2026-08-15' }, // 91 days before 2026-11-14
    { id: 'edge', retiredDate: '2026-08-16' }, // exactly 90 days
    { id: 'recent', retiredDate: '2026-11-01' },
  ];
  const problems = [
    { id: 'p-current', wallSetId: 'current', photoId: 'ph1' },
    { id: 'p-old', wallSetId: 'old', photoId: 'ph2' },
    { id: 'p-old-nophoto', wallSetId: 'old', photoId: null },
    { id: 'p-edge', wallSetId: 'edge', photoId: 'ph3' },
    { id: 'p-recent', wallSetId: 'recent', photoId: 'ph4' },
  ];

  it('selects only photos of sets retired more than the window ago', () => {
    expect(photosPastRetention(problems, sets, '2026-11-14', 90)).toEqual([{ problemId: 'p-old', photoId: 'ph2' }]);
  });
  it('follows the configured window', () => {
    expect(photosPastRetention(problems, sets, '2026-11-14', 10).map((r) => r.problemId)).toEqual(['p-old', 'p-edge', 'p-recent']);
  });
  it('defaults to 90 days for missing or bad settings', () => {
    expect(retentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays(-3)).toBe(90);
    expect(retentionDays(30)).toBe(30);
  });
  it('finds unreferenced photos only after the grace period', () => {
    const now = 10 * ORPHAN_GRACE_MS;
    const photos = [
      { id: 'used', createdAt: 0 },
      { id: 'orphan-old', createdAt: 0 },
      { id: 'orphan-new', createdAt: now - 1000 },
    ];
    expect(orphanPhotos(photos, [{ photoId: 'used' }, { photoId: null }], now)).toEqual(['orphan-old']);
  });
});
