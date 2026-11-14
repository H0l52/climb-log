import { repos } from '../../db';
import type { BoardRow } from '../../db/board';
import { boardLabel } from '../../domain/board';
import { showToast } from '../../ui/toast';

/** One board climb: wall, name, grade · angle · result. Optional Delete with Undo. */
export function BoardEntryRow({ row, canDelete = false }: { row: BoardRow; canDelete?: boolean }) {
  const { log, wall } = row;
  const name = log.climbName ?? 'Board climb';
  const remove = () =>
    repos.board.remove(log.id).then(
      (removed) => showToast('Board climb deleted', () => repos.board.restore(removed)),
      (e: unknown) => showToast(e instanceof Error ? e.message : String(e)),
    );
  return (
    <li className="list-row board-row">
      <span className="badge">Board</span>
      <span className="name">
        {wall?.name ?? 'Unknown board'}
        <span className="muted"> · {name}</span>
      </span>
      <span className={log.result === 'fail' ? 'muted' : undefined}>{boardLabel(log)}</span>
      {canDelete && (
        <button type="button" className="btn btn-small btn-danger" aria-label={`Delete ${name} on ${wall?.name ?? 'board'}`} onClick={() => void remove()}>
          ✕
        </button>
      )}
    </li>
  );
}
