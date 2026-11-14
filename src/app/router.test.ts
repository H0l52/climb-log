import { describe, expect, it } from 'vitest';
import { href, parseHash } from './router';

describe('parseHash', () => {
  it.each([
    ['', 'today'],
    ['#', 'today'],
    ['#/', 'today'],
    ['#/walls', 'walls'],
    ['#/walls/', 'walls'],
    ['#/progress', 'progress'],
    ['#/goals', 'goals'],
    ['#/more', 'more'],
    ['#/board', 'board'],
    ['#/sessions', 'sessions'],
    ['#/settings', 'settings'],
    ['#/log', 'log'],
    ['#/nope', 'notFound'],
    ['#/settings/x', 'notFound'],
  ])('%s → %s', (hash, name) => {
    expect(parseHash(hash).name).toBe(name);
  });

  it('reads the wall id', () => {
    expect(parseHash('#/walls/w%201')).toEqual({ name: 'wall', params: { id: 'w 1' } });
  });

  it('builds relative hash hrefs', () => {
    expect(href('/settings')).toBe('#/settings');
  });
});
