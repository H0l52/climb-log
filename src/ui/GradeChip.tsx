import type { GradeBand } from '../db/types';
import { chipStyle } from './chipStyle';

/** Grade chip: colour from data, always labelled, text colour picked by contrast. */
export function GradeChip({ band, small, count }: { band: Pick<GradeBand, 'name' | 'hex' | 'active'>; small?: boolean; count?: number }) {
  return (
    <span className={small ? 'grade-chip grade-chip-small' : 'grade-chip'} style={{ ...chipStyle(band), opacity: band.active ? 1 : 0.5 }}>
      {band.name}
      {count !== undefined && <span className="num"> {count}</span>}
    </span>
  );
}
