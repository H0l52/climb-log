import { useId, useState, type ReactNode } from 'react';
import type { GradeBand, ID } from '../../db/types';
import type { StyleRow } from '../../domain/metrics';
import { formatRate, type Bucket, type BucketKind } from '../../domain/progress';
import { GradeChip } from '../../ui/GradeChip';

/**
 * Progress charts (charts skill). Marks are HTML boxes or SVG paths; every text label is HTML so it
 * stays at least 12 px at any width. Grade colours come from the data and every mark has a 1 px
 * neutral outline so white and black bands stay visible on both themes. Tapping a bucket shows its
 * values in a fixed readout below the chart.
 */

const total = (m: Record<ID, number>) => Object.values(m).reduce((a, b) => a + b, 0);
const bucketName = (b: Bucket, kind: BucketKind) => (kind === 'week' ? `Week of ${b.label}` : b.label);

/** Sparse x labels: about six across 390 px. */
function XLabels({ buckets }: { buckets: Bucket[] }) {
  const every = Math.ceil(buckets.length / 6);
  return (
    <div className="chart-x" aria-hidden="true">
      {buckets.map((b, i) => <span key={b.from}>{(buckets.length - 1 - i) % every === 0 ? b.label : ''}</span>)}
    </div>
  );
}

/** Up to 3 y ticks (0, mid, max) as gridlines with labels. */
function YGrid({ max, format = String }: { max: number; format?: (n: number) => string }) {
  const ticks = max > 1 ? [max, Math.round(max / 2), 0] : [max, 0];
  return (
    <div className="chart-grid" aria-hidden="true">
      {[...new Set(ticks)].map((t) => (
        <span key={t} style={{ bottom: `${max ? (t / max) * 100 : 0}%` }}><i>{format(t)}</i></span>
      ))}
    </div>
  );
}

export function ChartCard({ title, summary, children, note }: { title: string; summary: string; children?: ReactNode; note?: string }) {
  const id = useId();
  return (
    <figure className="chart-card" aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`}>
      <h2 id={`${id}-t`} className="label">{title}</h2>
      {note ? <p className="muted chart-note">{note}</p> : children}
      <figcaption id={`${id}-s`} className="chart-summary">{summary}</figcaption>
    </figure>
  );
}

function useSelected(n: number) {
  const [picked, setPicked] = useState<number | null>(null);
  return [picked !== null && picked < n ? picked : n - 1, setPicked] as const;
}

/** Sends per colour per bucket: stacked bars, easiest at the bottom. */
export function StackedSends({ buckets, kind, data, bands }: { buckets: Bucket[]; kind: BucketKind; data: Record<ID, number>[]; bands: GradeBand[] }) {
  const [sel, setSel] = useSelected(buckets.length);
  const max = Math.max(1, ...data.map(total));
  const at = data[sel] ?? {};
  return (
    <>
      <div className="chart-plot">
        <YGrid max={max} />
        <div className="chart-bars" role="group" aria-label="Sends by period">
          {buckets.map((b, i) => {
            const d = data[i]!;
            const n = total(d);
            const parts = bands.filter((x) => d[x.id]).map((x) => `${x.name} ${d[x.id]}`).join(', ');
            return (
              <button key={b.from} type="button" className="chart-col" aria-pressed={i === sel} onClick={() => setSel(i)}
                aria-label={`${bucketName(b, kind)}: ${n} ${n === 1 ? 'send' : 'sends'}${parts ? ` (${parts})` : ''}`}>
                <span className="stack" style={{ height: `${(n / max) * 100}%` }}>
                  {bands.filter((x) => d[x.id]).map((x) => (
                    <span key={x.id} className="mark" style={{ background: x.hex, flexGrow: d[x.id] }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <XLabels buckets={buckets} />
      <div className="chart-readout" aria-live="polite">
        <strong>{bucketName(buckets[sel]!, kind)}</strong> · <span className="num">{total(at)}</span> {total(at) === 1 ? 'send' : 'sends'}
        <div className="chips">
          {bands.filter((x) => at[x.id]).map((x) => <GradeChip key={x.id} band={x} small count={at[x.id]} />)}
        </div>
      </div>
    </>
  );
}

/** Grade pyramid: one row per colour, hardest at the top, value in text. */
export function Pyramid({ counts, bands }: { counts: Record<ID, number>; bands: GradeBand[] }) {
  const rows = [...bands].filter((b) => b.active || counts[b.id]).reverse();
  const max = Math.max(1, ...rows.map((b) => counts[b.id] ?? 0));
  return (
    <ul className="hbars" aria-label="Sends by colour">
      {rows.map((b) => (
        <li key={b.id}>
          <span className="hbar-label">{b.name}</span>
          <span className="hbar-track"><span className="mark" style={{ background: b.hex, width: `${((counts[b.id] ?? 0) / max) * 100}%` }} /></span>
          <span className="num hbar-value">{counts[b.id] ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

/** Flash rate per colour over time. Gaps where a colour had no sends; at most 3 lines unless "All colours". */
export function FlashTrend({ buckets, kind, series, shown, all, bands }: {
  buckets: Bucket[]; kind: BucketKind; series: Record<ID, (number | null)[]>; shown: ID[]; all: ID[]; bands: GradeBand[];
}) {
  const [sel, setSel] = useSelected(buckets.length);
  const [showAll, setShowAll] = useState(false);
  const ids = showAll ? all : shown;
  const lines = bands.filter((b) => ids.includes(b.id));
  const n = buckets.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (r: number) => 100 - r * 100;
  const path = (vals: (number | null)[]) =>
    vals.map((v, i) => (v === null ? '' : `${i > 0 && vals[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`)).join(' ');
  return (
    <>
      <div className="chart-plot">
        <YGrid max={1} format={(t) => `${t * 100}%`} />
        <svg className="chart-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.map((b) => <path key={`u${b.id}`} d={path(series[b.id]!)} className="line-under" />)}
          {lines.map((b) => <path key={b.id} d={path(series[b.id]!)} className="line" style={{ stroke: b.hex }} />)}
        </svg>
        <div className="chart-dots" aria-hidden="true">
          {lines.flatMap((b) => series[b.id]!.map((v, i) => (v === null ? null : (
            <span key={`${b.id}-${i}`} className="dot" style={{ left: `${x(i)}%`, bottom: `${v * 100}%`, background: b.hex }} />
          ))))}
        </div>
        <div className="chart-bars chart-hit" role="group" aria-label="Flash rate by period">
          {buckets.map((bk, i) => (
            <button key={bk.from} type="button" className="chart-col" aria-pressed={i === sel} onClick={() => setSel(i)}
              aria-label={`${bucketName(bk, kind)}: ${lines.map((b) => `${b.name} ${formatRate(series[b.id]![i])}`).join(', ')}`} />
          ))}
        </div>
      </div>
      <XLabels buckets={buckets} />
      <div className="chart-readout" aria-live="polite">
        <strong>{bucketName(buckets[sel]!, kind)}</strong>
        <div className="chips">
          {lines.map((b) => (
            <span key={b.id} className="readout-item"><GradeChip band={b} small /> <span className="num">{formatRate(series[b.id]![sel])}</span></span>
          ))}
        </div>
      </div>
      {all.length > shown.length && (
        <button type="button" className="chip chart-toggle" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>All colours</button>
      )}
    </>
  );
}

/** Send rate by style tag, weakest first. Neutral ink: tags are not grades. */
export function StyleBars({ rows }: { rows: StyleRow[] }) {
  return (
    <ul className="hbars hbars-ink" aria-label="Send rate by style">
      {rows.map((r) => (
        <li key={r.tag}>
          <span className="hbar-label">{r.tag}</span>
          <span className="hbar-track"><span className="mark" style={{ width: `${r.rate * 100}%` }} /></span>
          <span className="hbar-value"><span className="num">{formatRate(r.rate)}</span> <span className="muted">{r.sent}/{r.attempted}</span></span>
        </li>
      ))}
    </ul>
  );
}

/** Points from new sends per bucket, neutral ink bars. */
export function ScoreBars({ buckets, kind, scores }: { buckets: Bucket[]; kind: BucketKind; scores: number[] }) {
  const [sel, setSel] = useSelected(buckets.length);
  const max = Math.max(1, ...scores);
  return (
    <>
      <div className="chart-plot">
        <YGrid max={max} />
        <div className="chart-bars" role="group" aria-label="Points by period">
          {buckets.map((b, i) => (
            <button key={b.from} type="button" className="chart-col" aria-pressed={i === sel} onClick={() => setSel(i)}
              aria-label={`${bucketName(b, kind)}: ${scores[i]} points`}>
              <span className="stack" style={{ height: `${(scores[i]! / max) * 100}%` }}><span className="mark mark-ink" /></span>
            </button>
          ))}
        </div>
      </div>
      <XLabels buckets={buckets} />
      <div className="chart-readout" aria-live="polite">
        <strong>{bucketName(buckets[sel]!, kind)}</strong> · <span className="num">{scores[sel]}</span> points
      </div>
    </>
  );
}
