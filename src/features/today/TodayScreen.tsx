import { repos } from '../../db';
import { useBoardEntries, useCurrentGym, useGradeBands, useLastSession, useOpenSession, useSessionDates, useSessionEntries } from '../../db/hooks';
import { BoardEntryRow } from '../board/BoardEntryRow';
import { BackupBanner } from '../backup/BackupBanner';
import { weeklyStreak } from '../../domain/metrics';
import type { Entry } from '../../db/logging';
import type { GradeBand } from '../../db/types';
import { formatDate, formatTime, melbourneDate } from '../../domain/dates';
import { formatElapsed, sessionTally } from '../../domain/sessions';
import { href } from '../../app/router';
import { GradeChip } from '../../ui/GradeChip';
import { showToast } from '../../ui/toast';
import { plural } from '../log/labels';
import { EntryRow } from './EntryRow';
import { useNow } from './useNow';
import { WallStrip } from './WallStrip';

function Tally({ entries, bands }: { entries: Entry[]; bands: GradeBand[] }) {
  const t = sessionTally(entries.map((e) => ({ gradeBandId: e.problem.gradeBandId, result: e.attempt.result, newSend: e.newSend })));
  return (
    <div className="tally" data-testid="tally">
      <dl className="tally-nums">
        <div><dd className="num">{t.sends}</dd><dt>{t.sends === 1 ? 'send' : 'sends'}</dt></div>
        <div><dd className="num">{t.flashes}</dd><dt>{t.flashes === 1 ? 'flash' : 'flashes'}</dt></div>
        <div><dd className="num">{t.notYet}</dd><dt>not yet</dt></div>
      </dl>
      {t.sends > 0 && (
        <div className="chips" aria-label="Sends by colour">
          {bands.filter((b) => t.sendsByBand[b.id]).map((b) => <GradeChip key={b.id} band={b} small count={t.sendsByBand[b.id]} />)}
        </div>
      )}
    </div>
  );
}

export function TodayScreen() {
  const current = useCurrentGym();
  const bands = useGradeBands();
  const open = useOpenSession();
  const entries = useSessionEntries(open?.id);
  const board = useBoardEntries(open?.id);
  const last = useLastSession(current?.gymId);
  const now = useNow();
  const sessionDates = useSessionDates();

  if (!current || !bands || open === undefined) return null;
  const { gyms, gymId } = current;
  const gymName = (id: string) => gyms.find((g) => g.id === id)?.name ?? 'another gym';
  const here = open && open.gymId === gymId ? open : null;
  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : String(e));

  return (
    <section className="screen today" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">Today</h1>
      <div className="chips" role="group" aria-label="Gym">
        {gyms.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={g.id === gymId} onClick={() => void repos.settings.set('lastGymId', g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <WallStrip gymId={gymId} today={melbourneDate(now)} />
      <BackupBanner now={now} />

      {here ? (
        <>
          <p className="session-line">
            <span className="num">{formatElapsed(now - here.startedAt)}</span>
            <span className="muted"> · started {formatTime(here.startedAt)}</span>
          </p>
          <Tally entries={entries ?? []} bands={bands} />
          {entries?.length === 0 && !board?.length && <p className="muted">Nothing logged yet. Log your first climb.</p>}
          {!!entries?.length && (
            <ul className="list" aria-label="This session">
              {entries.map((e) => <EntryRow key={e.attempt.id} entry={e} bands={bands} />)}
            </ul>
          )}
          {!!board?.length && (
            <ul className="list board-list" aria-label="Board this session">
              {board.map((r) => <BoardEntryRow key={r.log.id} row={r} />)}
            </ul>
          )}
        </>
      ) : (
        <>
          {!!sessionDates?.length && (
            <p className="streak-line" data-testid="streak">
              <span className="num">{weeklyStreak(sessionDates, melbourneDate(now))}</span>
              <span className="muted"> week streak</span>
            </p>
          )}
          {open && <p className="muted">Session open at {gymName(open.gymId)}. Starting here ends it.</p>}
          {last ? (
            <div className="last-session">
              <h2 className="label">Last session <span className="muted">· {formatDate(last.session.date)} · {plural(last.entries.length, 'climb')}</span></h2>
              <Tally entries={last.entries} bands={bands} />
            </div>
          ) : (
            !open && <p className="empty-line">No sessions here yet. Start one, or log your first climb.</p>
          )}
        </>
      )}

      <div className="action-bar">
        {here ? (
          <button type="button" className="btn" onClick={() => void repos.sessions.end(here.id).catch(fail)}>End session</button>
        ) : (
          <button type="button" className="btn" disabled={!gymId} onClick={() => gymId && void repos.sessions.start(gymId).catch(fail)}>Start session</button>
        )}
        <a className="btn btn-primary btn-log" href={href('/log')}>Log climb</a>
      </div>
    </section>
  );
}
