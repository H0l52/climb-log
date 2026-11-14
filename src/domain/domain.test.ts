import { describe, expect, it } from 'vitest';
import { isoWeekday, melbourneDate } from './dates';
import { contrastRatio, isValidHex, needsBorder, parseHex, textOn } from './colour';
import { moveItem, nextOrder } from './ordering';
import { activeWalls, cleanName, countByBand, planMerge, total } from './walls';
import type { WallSet } from '../db/types';

describe('dates', () => {
  it('uses the Melbourne calendar date, not UTC', () => {
    // 2026-11-14 13:30 UTC = 2026-11-15 00:30 AEDT
    expect(melbourneDate(Date.UTC(2026, 10, 14, 13, 30))).toBe('2026-11-15');
    // 2026-06-30 14:30 UTC = 2026-07-01 00:30 AEST
    expect(melbourneDate(Date.UTC(2026, 5, 30, 14, 30))).toBe('2026-07-01');
    expect(melbourneDate(Date.UTC(2026, 5, 30, 13, 30))).toBe('2026-06-30');
  });

  it('ISO weekday with Monday = 1', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-15')).toBe(7);
  });
});

describe('colour', () => {
  it('parses and validates hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#1E6FD9')).toEqual([30, 111, 217]);
    expect(parseHex('nope')).toBeNull();
    expect(isValidHex('#1e6fd9')).toBe(true);
    expect(isValidHex('#fff')).toBe(false);
  });

  it('picks chip text with at least 4.5:1 contrast for every seeded colour', async () => {
    const seed = (await import('../data/seed.json')).default;
    for (const b of seed.gradeBands) {
      expect(contrastRatio(b.hex, textOn(b.hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('flags chips that blend into the background', () => {
    expect(needsBorder('#1A1A1A', '#15171a')).toBe(true);
    expect(needsBorder('#F5F5F5', '#ffffff')).toBe(true);
    expect(needsBorder('#1E6FD9', '#15171a')).toBe(false);
  });
});

describe('ordering', () => {
  const items = [
    { id: 'a', order: 1 },
    { id: 'c', order: 5 },
    { id: 'b', order: 2 },
  ];
  it('moves up and down and renumbers', () => {
    expect(moveItem(items, 'c', -1).map((x) => [x.id, x.order])).toEqual([['a', 1], ['c', 2], ['b', 3]]);
    expect(moveItem(items, 'a', 1).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
  it('ignores moves past the ends and unknown ids', () => {
    expect(moveItem(items, 'a', -1).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, 'c', 1).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, 'z', 1).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('does not mutate input', () => {
    const copy = structuredClone(items);
    moveItem(items, 'c', -1);
    expect(items).toEqual(copy);
  });
  it('nextOrder', () => {
    expect(nextOrder(items)).toBe(6);
    expect(nextOrder([])).toBe(1);
  });
});

describe('walls', () => {
  const set = (id: string, wallId: string, retiredDate: string | null): WallSet => ({ id, wallId, setDate: '2026-01-01', retiredDate });

  it('planMerge moves sets and retires the duplicate current set', () => {
    const plan = planMerge('a', 'b', [set('1', 'a', null), set('2', 'a', '2026-02-01')], [set('3', 'b', null)], '2026-03-03');
    expect(plan.from).toEqual({ id: 'a', active: false, mergedIntoId: 'b' });
    expect(plan.wallSets).toEqual([set('1', 'b', '2026-03-03'), set('2', 'b', '2026-02-01')]);
  });

  it('planMerge keeps the current set when the target has none', () => {
    expect(planMerge('a', 'b', [set('1', 'a', null)], [], '2026-03-03').wallSets).toEqual([set('1', 'b', null)]);
  });

  it('planMerge rejects self-merge', () => {
    expect(() => planMerge('a', 'a', [], [], '2026-03-03')).toThrow();
  });

  it('activeWalls and cleanName', () => {
    expect(activeWalls([{ name: 'b', active: true }, { name: 'a', active: true }, { name: 'c', active: false }]).map((w) => w.name)).toEqual(['a', 'b']);
    expect(cleanName('  x   y ')).toBe('x y');
  });
});

describe('countByBand', () => {
  it('counts problems by status and colour', () => {
    const c = countByBand([
      { gradeBandId: 'y', status: 'sent' },
      { gradeBandId: 'y', status: 'sent' },
      { gradeBandId: 'b', status: 'project' },
      { gradeBandId: 'y', status: 'expired' },
    ]);
    expect(c).toEqual({ sent: { y: 2 }, project: { b: 1 }, expired: { y: 1 } });
    expect(total(c.sent)).toBe(2);
    expect(total({})).toBe(0);
  });
});
