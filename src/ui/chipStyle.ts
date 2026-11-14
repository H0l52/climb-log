import type { CSSProperties } from 'react';
import type { GradeBand } from '../db/types';
import { needsBorder, textOn } from '../domain/colour';

/** Inline colours for a grade chip: from data, text picked by contrast, bordered when it would blend into either theme. */
export function chipStyle(band: Pick<GradeBand, 'hex'>): CSSProperties {
  const border = needsBorder(band.hex, '#15171a') || needsBorder(band.hex, '#f4f2ee') ? 'var(--muted)' : 'transparent';
  return { background: band.hex, color: textOn(band.hex), borderColor: border };
}
