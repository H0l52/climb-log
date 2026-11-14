import { describe, expect, it } from 'vitest';
import { angles, boardLabel, newBoardLog, vGrades } from './board';

const ids = { id: 'b1', sessionId: 's1', wallId: 'w1', now: 5 };

describe('board entries', () => {
  it('normalises input', () => {
    expect(newBoardLog({ climbName: '  Big   pinch ', angle: 40, vGrade: 5, tries: 3, success: true }, ids)).toEqual({
      id: 'b1', sessionId: 's1', wallId: 'w1', climbName: 'Big pinch', angle: 40, vGrade: 5, tries: 3, result: 'send', createdAt: 5,
    });
    expect(newBoardLog({ climbName: '  ', tries: 1, success: false }, ids)).toMatchObject({ climbName: null, angle: null, vGrade: null, result: 'fail' });
  });
  it('rejects bad tries, angle and grade', () => {
    expect(() => newBoardLog({ tries: 0, success: true }, ids)).toThrow(/Tries/);
    expect(() => newBoardLog({ tries: 1, angle: 75, success: true }, ids)).toThrow(/Angle/);
    expect(() => newBoardLog({ tries: 1, vGrade: -1, success: true }, ids)).toThrow(/Grade/);
  });
  it('labels entries compactly', () => {
    expect(boardLabel({ vGrade: 5, angle: 40, result: 'send', tries: 1 })).toBe('V5 · 40° · Sent');
    expect(boardLabel({ vGrade: null, angle: null, result: 'fail', tries: 4 })).toBe('Not yet · 4 tries');
  });
  it('offers V0–V16 and 0–70° in 5° steps', () => {
    expect(vGrades()).toHaveLength(17);
    expect(angles()).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
  });
});
