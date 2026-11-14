import type { BoardLog, EpochMs, ID } from '../db/types';
import { cleanName } from './walls';

/** V grades offered on the board screen (display scale, not grade bands). */
export const V_GRADE_MIN = 0;
export const V_GRADE_MAX = 16;
/** Board angles in degrees. */
export const ANGLE_MIN = 0;
export const ANGLE_MAX = 70;
export const ANGLE_STEP = 5;

export const vGrades = (): number[] => Array.from({ length: V_GRADE_MAX - V_GRADE_MIN + 1 }, (_, i) => V_GRADE_MIN + i);
export const angles = (): number[] => Array.from({ length: (ANGLE_MAX - ANGLE_MIN) / ANGLE_STEP + 1 }, (_, i) => ANGLE_MIN + i * ANGLE_STEP);

export interface BoardInput {
  climbName?: string | null;
  angle?: number | null;
  vGrade?: number | null;
  tries: number;
  success: boolean;
}

/** Validate and normalise a board entry. Throws with a user-facing message. */
export function newBoardLog(input: BoardInput, ids: { id: ID; sessionId: ID; wallId: ID; now: EpochMs }): BoardLog {
  if (!Number.isInteger(input.tries) || input.tries < 1) throw new Error('Tries must be at least 1');
  const angle = input.angle ?? null;
  if (angle !== null && (!Number.isInteger(angle) || angle < ANGLE_MIN || angle > ANGLE_MAX)) throw new Error(`Angle must be ${ANGLE_MIN}–${ANGLE_MAX}°`);
  const vGrade = input.vGrade ?? null;
  if (vGrade !== null && (!Number.isInteger(vGrade) || vGrade < V_GRADE_MIN || vGrade > V_GRADE_MAX)) throw new Error(`Grade must be V${V_GRADE_MIN}–V${V_GRADE_MAX}`);
  return {
    id: ids.id,
    sessionId: ids.sessionId,
    wallId: ids.wallId,
    climbName: cleanName(input.climbName ?? '') || null,
    angle,
    vGrade,
    tries: input.tries,
    result: input.success ? 'send' : 'fail',
    createdAt: ids.now,
  };
}

/** 'V5 · 40° · Sent · 3 tries'. */
export function boardLabel(log: Pick<BoardLog, 'vGrade' | 'angle' | 'result' | 'tries'>): string {
  const parts: string[] = [];
  if (log.vGrade !== null) parts.push(`V${log.vGrade}`);
  if (log.angle !== null) parts.push(`${log.angle}°`);
  parts.push(log.result === 'send' ? 'Sent' : 'Not yet');
  if (log.tries !== 1) parts.push(`${log.tries} tries`);
  return parts.join(' · ');
}
