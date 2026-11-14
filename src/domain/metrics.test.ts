import { describe, expect, it } from 'vitest';
import type { Attempt, Problem } from '../db/types';
import { flashRateByBand, flashesByBand, sendRateByBand, sendsByBand, sessionScores } from './metrics';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 0, 0); // 1 Nov 11:00 Melbourne
const p = (id: string, band: string, status: Problem['status'] = 'sent'): Problem => ({
  id, wallSetId: 's', gradeBandId: band, nickname: null, photoId: null, styleTags: [], status, createdAt: T0,
});
const a = (id: string, problemId: string, result: Attempt['result'], at: number, sessionId = 's1', tries = 1): Attempt => ({
  id, problemId, sessionId, tries, result, felt: null, notes: null, createdAt: at,
});

const bands = [{ id: 'y', order: 1 }, { id: 'b', order: 2 }, { id: 'p', order: 3 }];
const input = {
  bands,
  problems: [p('1', 'y'), p('2', 'y'), p('3', 'b'), p('4', 'b', 'expired'), p('5', 'p', 'project')],
  attempts: [
    a('a1', '1', 'flash', T0),
    a('a2', '2', 'fail', T0 + 1, 's1', 3),
    a('a3', '2', 'send', T0 + 10 * DAY, 's2'),
    a('a4', '3', 'send', T0 + 2, 's1', 2),
    a('a5', '3', 'send', T0 + 10 * DAY + 1, 's2'), // repeat, not a new send
    a('a6', '4', 'fail', T0 + 3),
    a('a7', '5', 'fail', T0 + 10 * DAY + 2, 's2'),
  ],
};

describe('metrics (stubs)', () => {
  it('counts each problem\'s first success once, in its window', () => {
    expect(sendsByBand(input)).toEqual({ y: 2, b: 1 });
    expect(sendsByBand(input, { from: '2026-11-01', to: '2026-11-07' })).toEqual({ y: 1, b: 1 });
    expect(flashesByBand(input)).toEqual({ y: 1 });
  });
  it('flash rate is null with no sends', () => {
    expect(flashRateByBand(input)).toEqual({ y: 0.5, b: 0, p: null });
  });
  it('send rate counts problems first attempted in the window, whatever their status', () => {
    expect(sendRateByBand(input)).toEqual({ y: 1, b: 0.5, p: 0 });
    expect(sendRateByBand(input, { from: '2026-11-08', to: '2026-11-30' })).toEqual({ y: null, b: null, p: 0 });
  });
  it('session score weights new sends by 2^(order-1)', () => {
    expect(sessionScores(input)).toEqual({ s1: 1 + 2, s2: 1 });
  });
  it('ignores Problem.status entirely', () => {
    const flipped = { ...input, problems: input.problems.map((x) => ({ ...x, status: 'expired' as const })) };
    for (const f of [sendsByBand, flashesByBand, flashRateByBand, sendRateByBand, sessionScores]) expect(f(flipped)).toEqual(f(input));
  });
});
