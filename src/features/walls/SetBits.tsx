import type { GradeBand, ID, ISODate } from '../../db/types';
import { isFresh, setAgeLabel } from '../../domain/resets';
import { total } from '../../domain/walls';
import { GradeChip } from '../../ui/GradeChip';

/** Neutral "Fresh" tag: only grade colours are saturated. */
export function FreshBadge({ setDate, today }: { setDate: ISODate; today: ISODate }) {
  return isFresh(setDate, today) ? <span className="badge">Fresh</span> : null;
}

export function SetAge({ setDate, today }: { setDate: ISODate; today: ISODate }) {
  return (
    <span className="set-age">
      <span className="muted">{setAgeLabel(setDate, today)}</span>
      <FreshBadge setDate={setDate} today={today} />
    </span>
  );
}

/** One labelled line of colour chips with counts, e.g. "Sent [Yellow 2] [Blue 1]". Nothing when empty. */
export function CountLine({ label, counts, bands }: { label: string; counts: Record<ID, number>; bands: GradeBand[] }) {
  const n = total(counts);
  if (!n) return null;
  return (
    <div className="count-line" aria-label={`${label}: ${n}`}>
      <span className="count-label muted">{label} <span className="num">{n}</span></span>
      {bands.filter((b) => counts[b.id]).map((b) => <GradeChip key={b.id} band={b} small count={counts[b.id]} />)}
    </div>
  );
}
