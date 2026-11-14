import { useEffect, useState } from 'react';
import { repos } from '../../db';
import { useBoardEntries, useCurrentGym, useOpenSession, useWallRecency, useWalls } from '../../db/hooks';
import type { ID } from '../../db/types';
import { angles, boardLabel, vGrades } from '../../domain/board';
import { byRecency } from '../../domain/walls';
import { href } from '../../app/router';
import { Stepper } from '../../ui/Stepper';
import { showToast } from '../../ui/toast';
import { BoardEntryRow } from './BoardEntryRow';

/** Board log. Kept apart from colour stats; shows in session history. */
export function BoardScreen() {
  const current = useCurrentGym();
  const gymId = current?.gymId;
  const walls = useWalls(gymId);
  const recency = useWallRecency();
  const open = useOpenSession();
  const entries = useBoardEntries(open?.gymId === gymId ? open?.id : undefined);

  const [pickedWall, setPickedWall] = useState<ID | null>(null);
  const [climbName, setClimbName] = useState('');
  const [angle, setAngle] = useState<number | null>(null);
  const [vGrade, setVGrade] = useState<number | null>(null);
  const [tries, setTries] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boards = walls && recency ? byRecency(walls.filter((w) => w.kind === 'board'), recency) : undefined;
  const wall = boards?.find((w) => w.id === pickedWall) ?? boards?.[0];

  // Prefill the angle with the last one used on this board.
  useEffect(() => {
    let live = true;
    if (wall) void repos.board.lastOn(wall.id).then((last) => live && setAngle(last?.angle ?? null));
    return () => { live = false; };
  }, [wall?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current || !boards) return null;
  const gym = current.gyms.find((g) => g.id === gymId);

  async function save(success: boolean) {
    if (!wall || busy) return;
    setBusy(true);
    try {
      const log = await repos.board.log({ wallId: wall.id, climbName, angle, vGrade, tries, success });
      showToast(`${wall.name} · ${boardLabel(log)}`, () => repos.board.remove(log.id));
      setClimbName('');
      setVGrade(null);
      setTries(1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen board" aria-labelledby="screen-title">
      <div className="row">
        <h1 id="screen-title" className="screen-title grow">Board log</h1>
        <a className="btn btn-small" href={href('/more')}>Done</a>
      </div>
      <p className="muted">Board climbs show in your sessions but never in colour stats.</p>

      <h2 className="label" id="board-h">Board{gym && <span className="muted"> · {gym.name}</span>}</h2>
      {boards.length ? (
        <div className="scroll-row" role="group" aria-labelledby="board-h">
          {boards.map((w) => (
            <button key={w.id} type="button" className="chip" aria-pressed={w.id === wall?.id} onClick={() => setPickedWall(w.id)}>{w.name}</button>
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>No boards at this gym.</p>
          <a className="btn" href={href('/settings')}>Add a board in Settings</a>
        </div>
      )}

      {wall && (
        <>
          <label className="label" htmlFor="board-name">Climb name</label>
          <input id="board-name" className="field" value={climbName} onChange={(e) => setClimbName(e.target.value)} autoComplete="off" placeholder="Optional" />

          <h2 className="label" id="grade-h">Grade</h2>
          <div className="scroll-row" role="group" aria-labelledby="grade-h">
            {vGrades().map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={vGrade === v} onClick={() => setVGrade(vGrade === v ? null : v)}>V{v}</button>
            ))}
          </div>

          <h2 className="label" id="angle-h">Angle</h2>
          <div className="scroll-row" role="group" aria-labelledby="angle-h">
            {angles().map((a) => (
              <button key={a} type="button" className="chip" aria-pressed={angle === a} onClick={() => setAngle(angle === a ? null : a)}>{a}°</button>
            ))}
          </div>

          <div className="row tries-row">
            <h2 className="label grow">Tries</h2>
            <Stepper label="Tries" value={tries} onChange={setTries} />
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          <div className="result-row" role="group" aria-label="Result">
            <button type="button" className="btn result-btn" disabled={busy} onClick={() => void save(false)}>Not yet</button>
            <button type="button" className="btn btn-primary result-btn" disabled={busy} onClick={() => void save(true)}>Sent</button>
          </div>
        </>
      )}

      {!!entries?.length && (
        <>
          <h2 className="label">This session</h2>
          <ul className="list" aria-label="Board climbs this session">
            {entries.map((r) => <BoardEntryRow key={r.log.id} row={r} canDelete />)}
          </ul>
        </>
      )}
    </section>
  );
}
