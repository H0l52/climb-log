import { useState } from 'react';
import { useBoardEntries, useGradeBands, useSessionEntries, useSessionHistory } from '../../db/hooks';
import type { GradeBand } from '../../db/types';
import type { SessionSummary } from '../../db/history';
import { formatDate, formatTime } from '../../domain/dates';
import { href } from '../../app/router';
import { GradeChip } from '../../ui/GradeChip';
import { plural, resultLabel } from '../log/labels';
import { BoardEntryRow } from '../board/BoardEntryRow';
import { PhotoThumb } from '../photos/PhotoThumb';

/** Entries of one session, loaded only when it is opened. Read-only: corrections happen while a session is open. */
function SessionEntries({ sessionId, bands }: { sessionId: string; bands: GradeBand[] }) {
  const entries = useSessionEntries(sessionId);
  const board = useBoardEntries(sessionId);
  if (!entries || !board) return null;
  if (!entries.length && !board.length) return <p className="muted">Nothing logged in this session.</p>;
  return (
    <ul className="list" aria-label="Entries">
      {entries.map(({ attempt, problem, wall }) => {
        const b = bands.find((x) => x.id === problem.gradeBandId);
        return (
          <li key={attempt.id} className="list-row">
            <PhotoThumb photoId={problem.photoId} label={`${b?.name ?? ''} on ${wall?.name ?? 'unknown wall'}`} />
            {b && <GradeChip band={b} small />}
            <span className="name">
              {wall?.name ?? 'Unknown wall'}
              {problem.nickname && <span className="muted"> · {problem.nickname}</span>}
            </span>
            <span className={attempt.result === 'fail' ? 'muted' : undefined}>{resultLabel(attempt)}</span>
          </li>
        );
      })}
      {board.map((r) => <BoardEntryRow key={r.log.id} row={r} />)}
    </ul>
  );
}

function SessionItem({ item, bands }: { item: SessionSummary; bands: GradeBand[] }) {
  const [open, setOpen] = useState(false);
  const { session, gym, climbs, board } = item;
  const counts = [plural(climbs, 'climb'), board ? `${board} board` : null].filter(Boolean).join(' · ');
  return (
    <li>
      <details className="past-set" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>
          <span className="name">
            {formatDate(session.date)}
            <span className="muted"> · {gym?.name ?? 'Unknown gym'} · {formatTime(session.startedAt)}{session.endedAt === null ? ' · open' : ''}</span>
          </span>
          <span className="muted">{counts}</span>
        </summary>
        {open && <SessionEntries sessionId={session.id} bands={bands} />}
      </details>
    </li>
  );
}

/** Session history, newest first: boulder climbs and board climbs together. */
export function SessionsScreen() {
  const history = useSessionHistory();
  const bands = useGradeBands();
  if (!history || !bands) return null;
  return (
    <section className="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">Sessions</h1>
      {history.length ? (
        <ul className="list" aria-label="Sessions">
          {history.map((item) => <SessionItem key={item.session.id} item={item} bands={bands} />)}
        </ul>
      ) : (
        <div className="empty">
          <p>No sessions yet.</p>
          <a className="btn btn-primary" href={href('/log')}>Log a climb</a>
        </div>
      )}
    </section>
  );
}
