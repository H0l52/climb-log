import { useRef, useState } from 'react';
import { repos } from '../../db';
import type { Entry } from '../../db/logging';
import type { GradeBand } from '../../db/types';
import { isSuccess } from '../../domain/logging';
import { chipStyle } from '../../ui/chipStyle';
import { GradeChip } from '../../ui/GradeChip';
import { Stepper } from '../../ui/Stepper';
import { showToast } from '../../ui/toast';
import { resultLabel } from '../log/labels';

const SWIPE_DELETE_PX = 96;

/** One session entry: tap to edit inline, swipe left (or Delete) to remove with Undo. */
export function EntryRow({ entry, bands }: { entry: Entry; bands: GradeBand[] }) {
  const { attempt, problem, wall } = entry;
  const band = bands.find((b) => b.id === problem.gradeBandId);
  const [open, setOpen] = useState(false);
  const [tries, setTries] = useState(attempt.tries);
  const [success, setSuccess] = useState(isSuccess(attempt.result));
  const [bandId, setBandId] = useState(problem.gradeBandId);
  const [error, setError] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  const name = `${band?.name ?? 'Climb'} on ${wall?.name ?? 'unknown wall'}`;
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const remove = () =>
    repos.logging.deleteEntry(attempt.id).then((deleted) => showToast('Entry deleted', () => repos.logging.restoreEntry(deleted)), fail);

  const toggle = () => {
    setTries(attempt.tries);
    setSuccess(isSuccess(attempt.result));
    setBandId(problem.gradeBandId);
    setError(null);
    setOpen(!open);
  };

  return (
    <li>
      <button
        type="button"
        className="entry-row"
        aria-expanded={open}
        aria-label={`Edit ${name}, ${resultLabel(attempt)}`}
        style={dx ? { transform: `translateX(${dx}px)`, opacity: dx < -SWIPE_DELETE_PX ? 0.4 : 1 } : undefined}
        onClick={toggle}
        onTouchStart={(e) => { const t = e.touches[0]!; start.current = { x: t.clientX, y: t.clientY }; }}
        onTouchMove={(e) => {
          const t = e.touches[0]!;
          const s = start.current;
          if (!s) return;
          const x = t.clientX - s.x;
          if (Math.abs(x) > Math.abs(t.clientY - s.y) && x < 0) setDx(x);
        }}
        onTouchEnd={() => {
          if (dx < -SWIPE_DELETE_PX) void remove();
          setDx(0);
          start.current = null;
        }}
        onTouchCancel={() => { setDx(0); start.current = null; }}
      >
        {band && <GradeChip band={band} small />}
        <span className="name">
          {wall?.name ?? 'Unknown wall'}
          {problem.nickname && <span className="muted"> · {problem.nickname}</span>}
        </span>
        <span className={attempt.result === 'fail' ? 'muted' : undefined}>{resultLabel(attempt)}</span>
      </button>
      {open && (
        <div className="edit-panel stack">
          <div className="chips" role="group" aria-label="Colour">
            {bands.filter((b) => b.active || b.id === bandId).map((b) => (
              <button key={b.id} type="button" className="colour-btn colour-btn-small" style={chipStyle(b)} aria-pressed={b.id === bandId} onClick={() => setBandId(b.id)}>
                {b.name}
              </button>
            ))}
          </div>
          <div className="row">
            <span className="grow muted">Tries</span>
            <Stepper label="Tries" value={tries} onChange={setTries} />
          </div>
          <div className="chips" role="group" aria-label="Result">
            <button type="button" className="chip" aria-pressed={success} onClick={() => setSuccess(true)}>Sent</button>
            <button type="button" className="chip" aria-pressed={!success} onClick={() => setSuccess(false)}>Not yet</button>
          </div>
          <div className="row">
            <button type="button" className="btn btn-danger" aria-label={`Delete ${name}`} onClick={() => void remove()}>Delete</button>
            <span className="grow" />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void repos.logging.updateEntry(attempt.id, { tries, success, gradeBandId: bandId }).then(() => setOpen(false), fail)}
            >
              Save
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
    </li>
  );
}
