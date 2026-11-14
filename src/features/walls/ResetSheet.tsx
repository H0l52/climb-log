import { useState } from 'react';
import { repos } from '../../db';
import type { ISODate, Wall, WallSet } from '../../db/types';
import { formatDate } from '../../domain/dates';
import { resetDateError } from '../../domain/resets';
import { showToast } from '../../ui/toast';
import { plural } from '../log/labels';

/** "Mark as reset": default date, date picker limited to the current set's date … today. */
export function ResetSheet({ wall, current, defaultDate, today, projects, onClose }: {
  wall: Wall;
  current: WallSet;
  defaultDate: ISODate;
  today: ISODate;
  projects: number;
  onClose: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = resetDateError(date, today, current.setDate);

  async function save() {
    if (invalid || busy) return;
    setBusy(true);
    try {
      await repos.resets.mark(wall.id, date);
      showToast(`${wall.name} reset · ${formatDate(date)}`, () => repos.resets.undo(wall.id));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <form
      className="sheet stack"
      aria-labelledby="reset-h"
      onSubmit={(e) => { e.preventDefault(); void save(); }}
    >
      <h2 id="reset-h" className="label" style={{ marginTop: 0 }}>Mark as reset</h2>
      <label className="row" htmlFor="reset-date">
        <span className="grow">Reset on</span>
        <input
          id="reset-date"
          className="field"
          type="date"
          value={date}
          min={current.setDate}
          max={today}
          required
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <p className="muted" style={{ margin: 0 }}>
        {projects ? `${plural(projects, 'project')} will expire.` : 'No projects to expire.'} Sent climbs stay sent. History is kept.
      </p>
      {(error ?? (date && invalid)) && <p className="error" role="alert">{error ?? invalid}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!!invalid || busy}>Mark as reset</button>
      </div>
    </form>
  );
}
