import type { GradeBand } from '../db/types';
import { needsBorder, textOn } from '../domain/colour';

/** Grade chip: colour from data, always labelled, text colour picked by contrast. */
export function GradeChip({ band }: { band: Pick<GradeBand, 'name' | 'hex' | 'active'> }) {
  const border = needsBorder(band.hex, '#15171a') || needsBorder(band.hex, '#f4f2ee') ? 'var(--muted)' : 'transparent';
  return (
    <span
      className="grade-chip"
      style={{ background: band.hex, color: textOn(band.hex), borderColor: border, opacity: band.active ? 1 : 0.5 }}
    >
      {band.name}
    </span>
  );
}
