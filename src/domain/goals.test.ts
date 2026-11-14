import { describe, expect, it } from 'vitest';
import type { Goal } from '../db/types';
import { TODAY, entryAt, fixture, melbourneInstant, sessions } from './__fixtures__/metricsFixture';
import { achievedAt, goalProgress, goalUpdates, validateGoal } from './goals';

const goal = (g: Partial<Goal> & Pick<Goal, 'type'>): Goal => ({
  id: 'goal', gradeBandId: null, target: 1, deadline: null, createdAt: melbourneInstant('2026-08-01', 12), achievedAt: null, ...g,
});

describe('goal achievement (fixture)', () => {
  it('first send of a colour completes at that send', () => {
    expect(achievedAt(goal({ type: 'first-send-of-colour', gradeBandId: 'p' }), fixture)).toBe(entryAt('S5', 1));
    expect(achievedAt(goal({ type: 'first-send-of-colour', gradeBandId: 'g' }), fixture)).toBeNull();
  });
  it('set after the colour was already sent: complete when set', () => {
    const createdAt = melbourneInstant('2026-11-13', 9);
    expect(achievedAt(goal({ type: 'first-send-of-colour', gradeBandId: 'y', createdAt }), fixture)).toBe(createdAt);
  });
  it('a deadline before the send means not achieved, and missed once it passes', () => {
    const g = goal({ type: 'first-send-of-colour', gradeBandId: 'p', deadline: '2026-11-09' });
    expect(achievedAt(g, fixture)).toBeNull();
    expect(goalProgress(g, fixture, TODAY).status).toBe('missed');
    expect(goalProgress(g, fixture, '2026-11-09').status).toBe('active');
  });
  it('sends of a colour counts sends after the goal was set: P10, then P7 completes it', () => {
    const g = goal({ type: 'sends-of-colour', gradeBandId: 'b', target: 2, createdAt: melbourneInstant('2026-10-20', 9) });
    expect(achievedAt(g, fixture)).toBe(entryAt('S6', 0));
    expect(goalProgress(g, fixture, TODAY)).toMatchObject({ current: 3, text: '3 / 2', status: 'done', fraction: 1 });
    expect(achievedAt({ ...g, target: 4 }, fixture)).toBeNull();
    expect(goalProgress({ ...g, target: 4 }, fixture, TODAY)).toMatchObject({ current: 3, fraction: 0.75, status: 'active' });
  });
  it('flash rate needs 4 sends in the trailing 42 days: y reaches 3/4 = 75% with P12', () => {
    const g = goal({ type: 'flash-rate', gradeBandId: 'y', target: 75, createdAt: melbourneInstant('2026-10-01', 9) });
    expect(achievedAt(g, fixture)).toBe(entryAt('S6', 2));
    expect(achievedAt({ ...g, target: 76 }, fixture)).toBeNull();
    expect(goalProgress({ ...g, target: 76 }, fixture, TODAY)).toMatchObject({ current: 75, text: '75% / 76%' });
    expect(goalProgress(goal({ type: 'flash-rate', gradeBandId: 'g', target: 50 }), fixture, TODAY).text).toBe('– / 50%');
  });
  it('sessions a week completes with the second session of the week of 9 Nov', () => {
    const g = goal({ type: 'sessions-per-week', target: 2, createdAt: melbourneInstant('2026-11-01', 9) });
    expect(achievedAt(g, fixture)).toBe(sessions.find((s) => s.id === 'S6')!.startedAt);
    expect(goalProgress({ ...g, target: 3 }, fixture, TODAY).text).toBe('2 / 3 this week');
  });
  it('goalUpdates lists only goals whose stored value is stale', () => {
    const done = goal({ id: 'a', type: 'first-send-of-colour', gradeBandId: 'p', achievedAt: entryAt('S5', 1) });
    const stale = goal({ id: 'b', type: 'first-send-of-colour', gradeBandId: 'p' });
    const undone = goal({ id: 'c', type: 'first-send-of-colour', gradeBandId: 'g', achievedAt: 123 });
    expect(goalUpdates([done, stale, undone], fixture)).toEqual([
      { id: 'b', achievedAt: entryAt('S5', 1) },
      { id: 'c', achievedAt: null },
    ]);
  });
});

describe('validateGoal', () => {
  it('rejects bad goals', () => {
    expect(() => validateGoal({ type: 'sends-of-colour', gradeBandId: null, target: 3, deadline: null }, TODAY)).toThrow('Pick a colour');
    expect(() => validateGoal({ type: 'sends-of-colour', gradeBandId: 'y', target: 0, deadline: null }, TODAY)).toThrow('Target');
    expect(() => validateGoal({ type: 'flash-rate', gradeBandId: 'y', target: 101, deadline: null }, TODAY)).toThrow('percentage');
    expect(() => validateGoal({ type: 'sessions-per-week', gradeBandId: null, target: 2, deadline: '2026-11-13' }, TODAY)).toThrow('passed');
  });
  it('normalises: first send has target 1; sessions a week has no colour', () => {
    expect(validateGoal({ type: 'first-send-of-colour', gradeBandId: 'g', target: 7, deadline: null }, TODAY).target).toBe(1);
    expect(validateGoal({ type: 'sessions-per-week', gradeBandId: 'g', target: 2, deadline: TODAY }, TODAY)).toEqual({
      type: 'sessions-per-week', gradeBandId: null, target: 2, deadline: TODAY,
    });
  });
});
