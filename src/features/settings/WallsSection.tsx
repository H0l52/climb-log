import { useState } from 'react';
import { repos } from '../../db';
import { useGyms, useSetting, useWalls } from '../../db/hooks';
import type { Wall, WallKind } from '../../db/types';
import { activeWalls } from '../../domain/walls';
import { useAction } from './useAction';

const KIND_LABEL: Record<WallKind, string> = { boulder: 'Boulder', board: 'Board' };

function WallRow({ wall, others }: { wall: Wall; others: Wall[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(wall.name);
  const [target, setTarget] = useState('');
  const { error, run } = useAction();
  const targetWall = others.find((w) => w.id === target);

  return (
    <li>
      <div className="list-row">
        <span className="name">{wall.name}</span>
        <span className="muted">{KIND_LABEL[wall.kind]}</span>
        <button
          type="button"
          className="btn btn-small"
          aria-expanded={open}
          aria-label={`Edit ${wall.name}`}
          onClick={() => { setName(wall.name); setOpen(!open); }}
        >
          {open ? 'Done' : 'Edit'}
        </button>
      </div>
      {open && (
        <div className="edit-panel stack">
          <form
            className="row"
            onSubmit={(e) => { e.preventDefault(); void run(() => repos.walls.rename(wall.id, name)); }}
          >
            <label className="visually-hidden" htmlFor={`wall-name-${wall.id}`}>Wall name</label>
            <input id={`wall-name-${wall.id}`} className="field grow" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            <button type="submit" className="btn" disabled={name.trim() === wall.name || !name.trim()}>Rename</button>
          </form>
          <div className="row">
            <label className="visually-hidden" htmlFor={`merge-${wall.id}`}>Merge into</label>
            <select id={`merge-${wall.id}`} className="field grow" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Merge into…</option>
              {others.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button
              type="button"
              className="btn"
              disabled={!targetWall}
              onClick={() => {
                if (!targetWall) return;
                const ok = window.confirm(`Merge ${wall.name} into ${targetWall.name}? Its sets and history move to ${targetWall.name}. This cannot be undone.`);
                if (ok) void run(() => repos.walls.merge(wall.id, targetWall.id));
              }}
            >
              Merge
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn btn-danger" onClick={() => void run(() => repos.walls.setActive(wall.id, false))}>
              Retire wall
            </button>
            <span className="muted">Hidden from pickers. History is kept.</span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
    </li>
  );
}

function AddWall({ gymId }: { gymId: string }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WallKind>('boulder');
  const { error, run } = useAction();
  return (
    <form
      className="stack"
      style={{ marginTop: 16 }}
      aria-label="Add wall"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => repos.walls.add({ gymId, name, kind }))) setName('');
      }}
    >
      <label htmlFor="new-wall-name" className="muted">New wall</label>
      <div className="row">
        <input id="new-wall-name" className="field grow" placeholder="Wall name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="row">
        <div className="chips grow" role="group" aria-label="Wall type">
          {(['boulder', 'board'] as const).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Add wall</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

export function WallsSection() {
  const gyms = useGyms();
  const lastGymId = useSetting<string>('lastGymId');
  const [picked, setPicked] = useState<string | null>(null);
  const gymId = picked ?? (gyms?.some((g) => g.id === lastGymId) ? lastGymId : gyms?.[0]?.id);
  const walls = useWalls(gymId);
  const { run } = useAction();
  if (!gyms || !walls || !gymId) return null;

  const active = activeWalls(walls);
  const retired = walls.filter((w) => !w.active).sort((a, b) => a.name.localeCompare(b.name));
  const nameOf = (id: string | null) => walls.find((w) => w.id === id)?.name ?? '';

  return (
    <section className="section" aria-labelledby="walls-h">
      <h2 id="walls-h">Walls</h2>
      <div className="chips" role="group" aria-label="Gym" style={{ marginBottom: 12 }}>
        {gyms.map((g) => (
          <button
            key={g.id}
            type="button"
            className="chip"
            aria-pressed={g.id === gymId}
            onClick={() => { setPicked(g.id); void repos.settings.set('lastGymId', g.id); }}
          >
            {g.name}
          </button>
        ))}
      </div>
      {active.length === 0 ? (
        <p className="muted">No walls for this gym yet. Add the first one below.</p>
      ) : (
        <ul className="list" aria-label="Active walls">
          {active.map((w) => (
            <WallRow key={w.id} wall={w} others={active.filter((o) => o.id !== w.id)} />
          ))}
        </ul>
      )}
      <AddWall gymId={gymId} />
      {retired.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary className="list-row muted">Retired and merged ({retired.length})</summary>
          <ul className="list" aria-label="Retired walls">
            {retired.map((w) => (
              <li key={w.id} className="list-row">
                <span className="name">{w.name}</span>
                {w.mergedIntoId ? (
                  <span className="muted">Merged into {nameOf(w.mergedIntoId)}</span>
                ) : (
                  <button type="button" className="btn btn-small" onClick={() => void run(() => repos.walls.setActive(w.id, true))}>
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
