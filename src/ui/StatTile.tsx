import type { ReactNode } from 'react';

/** Headline number: one big value, a label and an optional small delta. */
export function StatTile({ label, value, delta, children }: { label: string; value: string; delta?: string; children?: ReactNode }) {
  return (
    <div className="stat-tile" role="group" aria-label={label}>
      <span className="stat-value num" data-testid="value">{value}</span>
      {children}
      <span className="stat-label">{label}</span>
      {delta ? <span className="stat-delta muted" data-testid="delta">{delta}</span> : null}
    </div>
  );
}
