import { useState } from 'react';
import { repos } from '../../db';
import { useGradeBands, useWallDetail } from '../../db/hooks';
import type { GradeBand, ID } from '../../db/types';
import type { ProblemRow, SetView } from '../../db/wallViews';
import { formatDate, melbourneDate } from '../../domain/dates';
import { defaultResetDate } from '../../domain/resets';
import { countByBand } from '../../domain/walls';
import { href } from '../../app/router';
import { GradeChip } from '../../ui/GradeChip';
import { Placeholder } from '../../ui/Placeholder';
import { showToast } from '../../ui/toast';
import { plural } from '../log/labels';
import { useNow } from '../today/useNow';
import { ResetSheet } from './ResetSheet';
import { CountLine, SetAge } from './SetBits';
import { PhotoThumb } from '../photos/PhotoThumb';

const STATUS_LABEL = { project: 'Project', sent: 'Sent', expired: 'Expired' } as const;

function Problems({ rows, bands, label }: { rows: ProblemRow[]; bands: GradeBand[]; label: string }) {
  return (
    <ul className="list" aria-label={label}>
      {rows.map(({ problem, tries }) => {
        const b = bands.find((x) => x.id === problem.gradeBandId);
        return (
          <li key={problem.id} className="list-row">
            <PhotoThumb photoId={problem.photoId} label={`${b?.name ?? ''} ${problem.nickname ?? STATUS_LABEL[problem.status].toLowerCase()}`.trim()} />
            {b && <GradeChip band={b} small />}
            <span className="name">{problem.nickname ?? STATUS_LABEL[problem.status]}</span>
            <span className="muted">{problem.nickname ? `${STATUS_LABEL[problem.status]} · ` : ''}{plural(tries, 'try', 'tries')}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PastSet({ view, bands }: { view: SetView; bands: GradeBand[] }) {
  const c = countByBand(view.problems.map((r) => r.problem));
  const range = `${formatDate(view.set.setDate)} – ${formatDate(view.set.retiredDate!)}`;
  return (
    <li>
      <details className="past-set">
        <summary>
          <span className="name">{range}</span>
          <span className="muted">{plural(view.problems.length, 'climb')}</span>
        </summary>
        <CountLine label="Sent" counts={c.sent} bands={bands} />
        <CountLine label="Expired" counts={c.expired} bands={bands} />
        {view.problems.length ? <Problems rows={view.problems} bands={bands} label={`Climbs ${range}`} /> : <p className="muted">Nothing logged on this set.</p>}
      </details>
    </li>
  );
}

export function WallDetailScreen({ wallId }: { wallId: ID }) {
  const detail = useWallDetail(wallId);
  const bands = useGradeBands();
  const today = melbourneDate(useNow(60_000));
  const [sheet, setSheet] = useState(false);

  if (detail === null) {
    return (
      <Placeholder title="Wall not found">
        <p>That wall does not exist.</p>
        <a className="btn" href={href('/walls')}>Go to Walls</a>
      </Placeholder>
    );
  }
  if (!detail || !bands) return null;
  const { wall, gym, current, past, undoable } = detail;
  const c = countByBand(current?.problems.map((r) => r.problem) ?? []);
  const canReset = wall.active && wall.kind === 'boulder' && !!current;
  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : String(e));

  return (
    <section className="screen wall-detail" aria-labelledby="screen-title">
      <a className="back-link" href={href('/walls')}>‹ Walls</a>
      <h1 id="screen-title" className="screen-title">{wall.name}</h1>
      <p className="wall-meta">
        {gym && <span className="muted">{gym.name}</span>}
        {current && <SetAge setDate={current.set.setDate} today={today} />}
      </p>
      {!wall.active && <p className="muted">{wall.mergedIntoId ? 'Merged into another wall.' : 'Retired. Restore it in Settings.'} History is kept.</p>}
      {wall.kind === 'board' && <p className="muted">Board wall: no sets or resets.</p>}

      {undoable && (
        <div className="undo-line" role="status">
          <span className="grow">Reset {formatDate(undoable.date)}{undoable.changed.length ? ` · ${plural(undoable.changed.length, 'project')} expired` : ''}</span>
          <button type="button" className="btn btn-small" onClick={() => void repos.resets.undo(wall.id).then(() => showToast('Reset undone'), fail)}>
            Undo reset
          </button>
        </div>
      )}

      {current && (
        <>
          <h2 className="label">Current set <span className="muted">· since {formatDate(current.set.setDate)}</span></h2>
          <CountLine label="Sent" counts={c.sent} bands={bands} />
          <CountLine label="Projects" counts={c.project} bands={bands} />
          {current.problems.length ? (
            <Problems rows={current.problems} bands={bands} label="Current set" />
          ) : (
            <p className="muted">Nothing logged on this set yet.</p>
          )}
        </>
      )}

      {past.length > 0 && (
        <details className="more-detail" style={{ marginTop: 24 }}>
          <summary>Past sets ({past.length})</summary>
          <ul className="list" aria-label="Past sets">
            {past.map((v) => <PastSet key={v.set.id} view={v} bands={bands} />)}
          </ul>
        </details>
      )}

      <a className="back-link" href={href('/settings')}>Rename, retire or merge in Settings ›</a>

      {canReset && (
        <div className="action-bar action-bar-single">
          {sheet ? (
            <ResetSheet
              wall={wall}
              current={current.set}
              defaultDate={defaultResetDate(gym?.setDays ?? [], today, current.set.setDate)}
              today={today}
              projects={current.problems.filter((r) => r.problem.status === 'project').length}
              onClose={() => setSheet(false)}
            />
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setSheet(true)}>Mark as reset</button>
          )}
        </div>
      )}
    </section>
  );
}
