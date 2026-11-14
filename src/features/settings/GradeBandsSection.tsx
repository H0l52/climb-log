import { useState } from 'react';
import { repos } from '../../db';
import { useGradeBands } from '../../db/hooks';
import type { GradeBand } from '../../db/types';
import { GradeChip } from '../../ui/GradeChip';
import { useAction } from './useAction';

function BandRow({ band, isFirst, isLast }: { band: GradeBand; isFirst: boolean; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(band.name);
  const { error, run } = useAction();

  return (
    <li>
      <div className="list-row">
        <span className="name"><GradeChip band={band} /></span>
        {!band.active && <span className="muted">Retired</span>}
        <button type="button" className="btn btn-small" aria-label={`Move ${band.name} easier`} disabled={isFirst}
          onClick={() => void run(() => repos.gradeBands.move(band.id, -1))}>↑</button>
        <button type="button" className="btn btn-small" aria-label={`Move ${band.name} harder`} disabled={isLast}
          onClick={() => void run(() => repos.gradeBands.move(band.id, 1))}>↓</button>
        <button type="button" className="btn btn-small" aria-expanded={open} aria-label={`Edit ${band.name}`}
          onClick={() => { setName(band.name); setOpen(!open); }}>{open ? 'Done' : 'Edit'}</button>
      </div>
      {open && (
        <div className="edit-panel stack">
          <form className="row" onSubmit={(e) => { e.preventDefault(); void run(() => repos.gradeBands.rename(band.id, name)); }}>
            <label className="visually-hidden" htmlFor={`band-name-${band.id}`}>Colour name</label>
            <input id={`band-name-${band.id}`} className="field grow" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            <button type="submit" className="btn" disabled={name.trim() === band.name || !name.trim()}>Rename</button>
          </form>
          <div className="row">
            <label htmlFor={`band-hex-${band.id}`} className="grow">Chip colour <span className="muted">{band.hex}</span></label>
            <input id={`band-hex-${band.id}`} type="color" className="swatch" value={band.hex.toLowerCase()}
              onChange={(e) => void run(() => repos.gradeBands.recolour(band.id, e.target.value))} />
          </div>
          <div className="row">
            {band.active ? (
              <button type="button" className="btn btn-danger" onClick={() => void run(() => repos.gradeBands.setActive(band.id, false))}>Retire colour</button>
            ) : (
              <button type="button" className="btn" onClick={() => void run(() => repos.gradeBands.setActive(band.id, true))}>Restore colour</button>
            )}
            <span className="muted">History is kept.</span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
      {!open && error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}

function AddBand() {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#888888');
  const { error, run } = useAction();
  return (
    <form className="stack" style={{ marginTop: 16 }} aria-label="Add colour"
      onSubmit={async (e) => { e.preventDefault(); if (await run(() => repos.gradeBands.add({ name, hex }))) setName(''); }}>
      <label htmlFor="new-band-name" className="muted">New colour (added as the hardest)</label>
      <div className="row">
        <input id="new-band-name" className="field grow" placeholder="Colour name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <label className="visually-hidden" htmlFor="new-band-hex">Chip colour</label>
        <input id="new-band-hex" type="color" className="swatch" value={hex} onChange={(e) => setHex(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Add colour</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

export function GradeBandsSection() {
  const bands = useGradeBands();
  if (!bands) return null;
  return (
    <section className="section" aria-labelledby="bands-h">
      <h2 id="bands-h">Grade colours</h2>
      <p className="muted" style={{ marginTop: 0 }}>Easiest at the top.</p>
      <ul className="list" aria-label="Grade colours">
        {bands.map((b, i) => <BandRow key={b.id} band={b} isFirst={i === 0} isLast={i === bands.length - 1} />)}
      </ul>
      <AddBand />
    </section>
  );
}
