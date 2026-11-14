import { useState } from 'react';
import { repos, styleTagOptions } from '../../db';
import { useCurrentGym, useGradeBands, useProjects, useWallRecency, useWalls } from '../../db/hooks';
import type { Felt, ID } from '../../db/types';
import { canFlash } from '../../domain/logging';
import { byRecency, cleanName } from '../../domain/walls';
import { href, navigate } from '../../app/router';
import { chipStyle } from '../../ui/chipStyle';
import { GradeChip } from '../../ui/GradeChip';
import { Stepper } from '../../ui/Stepper';
import { showToast } from '../../ui/toast';
import { plural, resultLabel } from './labels';
import type { PhotoInput } from '../../db/photos';
import { PhotoPicker } from '../photos/PhotoPicker';
import { PhotoThumb } from '../photos/PhotoThumb';

const FELT: readonly Felt[] = ['easy', 'fair', 'hard'];

export function LogScreen() {
  const current = useCurrentGym();
  const gymId = current?.gymId;
  const walls = useWalls(gymId);
  const recency = useWallRecency();
  const bands = useGradeBands();

  const [pickedWall, setPickedWall] = useState<ID | null>(null);
  const [adding, setAdding] = useState(false);
  const [newWall, setNewWall] = useState('');
  const [projectId, setProjectId] = useState<ID | null>(null);
  const [bandId, setBandId] = useState<ID | null>(null);
  const [tries, setTries] = useState(1);
  const [nickname, setNickname] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [felt, setFelt] = useState<Felt | null>(null);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = walls && recency ? byRecency(walls.filter((w) => w.kind === 'boulder'), recency) : undefined;
  const wall = ordered?.find((w) => w.id === pickedWall) ?? ordered?.[0];
  const projects = useProjects(wall?.id);

  if (!current || !ordered || !bands) return null;
  const gym = current.gyms.find((g) => g.id === gymId);
  const activeBands = bands.filter((b) => b.active);
  const project = projects?.find((p) => p.problem.id === projectId);
  const band = bands.find((b) => b.id === (project ? project.problem.gradeBandId : bandId));
  const flash = !project && canFlash(0, tries);
  const ready = !!wall && !!band && !busy;

  const pickWall = (id: ID) => {
    setPickedWall(id);
    setProjectId(null);
    setAdding(false);
  };

  async function addWall() {
    const name = cleanName(newWall);
    if (!name || !gymId) return;
    try {
      const existing = ordered?.find((w) => w.name.toLowerCase() === name.toLowerCase());
      pickWall((existing ?? (await repos.walls.add({ gymId, name, kind: 'boulder' }))).id);
      setNewWall('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function save(success: boolean) {
    if (!wall || !band || busy) return;
    setBusy(true);
    try {
      const details = { tries, success, felt, notes, photo };
      const { attempt } = project
        ? await repos.logging.logAgain({ problemId: project.problem.id, ...details })
        : await repos.logging.logNew({ wallId: wall.id, gradeBandId: band.id, nickname, styleTags: tags, ...details });
      showToast(`${band.name} · ${resultLabel(attempt)}`, () => repos.logging.deleteEntry(attempt.id));
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <section className="screen log" aria-labelledby="screen-title">
      <div className="row">
        <h1 id="screen-title" className="screen-title grow">Log climb</h1>
        <a className="btn btn-small" href={href('/')}>Cancel</a>
      </div>

      <h2 className="label" id="wall-h">Wall{gym && <span className="muted"> · {gym.name}</span>}</h2>
      <div className="scroll-row" role="group" aria-labelledby="wall-h">
        {ordered.map((w) => (
          <button key={w.id} type="button" className="chip" aria-pressed={w.id === wall?.id} onClick={() => pickWall(w.id)}>
            {w.name}
          </button>
        ))}
        <button type="button" className="chip" aria-expanded={adding} onClick={() => setAdding(!adding)}>+ New wall</button>
      </div>
      {adding && (
        <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); void addWall(); }}>
          <label className="visually-hidden" htmlFor="log-new-wall">New wall name</label>
          <input id="log-new-wall" className="field grow" placeholder="Wall name" value={newWall} onChange={(e) => setNewWall(e.target.value)} autoComplete="off" autoFocus />
          <button type="submit" className="btn btn-primary" disabled={!newWall.trim()}>Add</button>
        </form>
      )}
      {ordered.length === 0 && !adding && <p className="muted">No walls for this gym yet. Add the first one.</p>}

      {!!projects?.length && (
        <>
          <h2 className="label" id="projects-h">Projects on this wall</h2>
          <ul className="list" aria-labelledby="projects-h">
            {projects.map(({ problem, tries: soFar }) => {
              const b = bands.find((x) => x.id === problem.gradeBandId);
              const on = problem.id === projectId;
              return (
                <li key={problem.id} className="project-item">
                  <PhotoThumb photoId={problem.photoId} label={`${b?.name ?? ''} ${problem.nickname ?? 'project'}`.trim()} />
                  <button type="button" className="project-row" aria-pressed={on} onClick={() => setProjectId(on ? null : problem.id)}>
                    {b && <GradeChip band={b} small />}
                    <span className="name">{problem.nickname ?? 'Project'}</span>
                    <span className="muted">{plural(soFar, 'try', 'tries')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!project && (
        <>
          <h2 className="label" id="colour-h">Colour</h2>
          <div className="colour-grid" role="group" aria-labelledby="colour-h">
            {activeBands.map((b) => (
              <button key={b.id} type="button" className="colour-btn" style={chipStyle(b)} aria-pressed={b.id === bandId} onClick={() => setBandId(b.id)}>
                {b.name}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="row tries-row">
        <h2 className="label grow">Tries{project && <span className="muted"> this time</span>}</h2>
        <Stepper label="Tries" value={tries} onChange={setTries} />
      </div>

      <details className="more-detail">
        <summary>More detail</summary>
        <div className="stack">
          <PhotoPicker value={photo} onChange={setPhoto} replacing={!!project?.problem.photoId} />
          {!project && (
            <>
              <label className="muted" htmlFor="log-nickname">Nickname</label>
              <input id="log-nickname" className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="off" placeholder="To tell it apart later" />
              <span className="muted" id="style-h">Style</span>
              <div className="chips" role="group" aria-labelledby="style-h">
                {styleTagOptions.map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="muted" id="felt-h">Felt</span>
          <div className="chips" role="group" aria-labelledby="felt-h">
            {FELT.map((f) => (
              <button key={f} type="button" className="chip" aria-pressed={felt === f} onClick={() => setFelt(felt === f ? null : f)}>{f}</button>
            ))}
          </div>
          <label className="muted" htmlFor="log-note">Note</label>
          <input id="log-note" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} autoComplete="off" />
        </div>
      </details>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="result-row" role="group" aria-label="Result">
        <button type="button" className="btn result-btn" disabled={!ready} onClick={() => void save(false)}>Not yet</button>
        <button type="button" className="btn btn-primary result-btn" disabled={!ready} onClick={() => void save(true)}>{flash ? 'Flash' : 'Sent'}</button>
      </div>
      {!band && <p className="muted hint">Pick a colour, then the result saves the climb.</p>}
    </section>
  );
}
