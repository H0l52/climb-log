import type { ClimbDB } from './schema';
import type { Gym, Session } from './types';

export interface SessionSummary {
  session: Session;
  gym: Gym | undefined;
  climbs: number; // boulder entries
  board: number; // board entries
}

/** Every session, newest first, with entry counts. Entries load per session when opened. */
export async function sessionHistory(db: ClimbDB): Promise<SessionSummary[]> {
  const [sessions, gyms, attemptSessions, boardSessions] = await Promise.all([
    db.sessions.toArray(),
    db.gyms.toArray(),
    db.attempts.toArray().then((a) => a.map((x) => x.sessionId)),
    db.boardLogs.toArray().then((b) => b.map((x) => x.sessionId)),
  ]);
  const count = (ids: string[]) => ids.reduce<Record<string, number>>((m, id) => ((m[id] = (m[id] ?? 0) + 1), m), {});
  const climbs = count(attemptSessions);
  const board = count(boardSessions);
  return sessions
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((session) => ({ session, gym: gyms.find((g) => g.id === session.gymId), climbs: climbs[session.id] ?? 0, board: board[session.id] ?? 0 }));
}
