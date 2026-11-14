import { useMemo, useState } from 'react';
import { useGradeBands, useGyms, useMetricInput } from '../../db/hooks';
import type { ID } from '../../db/types';
import { melbourneDate } from '../../domain/dates';
import { RANGES, formatDelta, formatRate, progressView, type RangeKey } from '../../domain/progress';
import { RANGE_PHRASE, flashSummary, pyramidSummary, scoreSummary, sendsSummary, styleSummary } from '../../domain/progressText';
import { href } from '../../app/router';
import { StatTile } from '../../ui/StatTile';
import { useNow } from '../today/useNow';
import { ChartCard, FlashTrend, Pyramid, ScoreBars, StackedSends, StyleBars } from './charts';

const KEEP_LOGGING = 'Keep logging: a trend appears after sessions in 3 different periods.';

export function ProgressScreen() {
  const input = useMetricInput();
  const bands = useGradeBands();
  const gyms = useGyms();
  const today = melbourneDate(useNow(60_000));
  const [gymId, setGymId] = useState<ID | null>(null);
  const [range, setRange] = useState<RangeKey>('6w');

  const view = useMemo(() => (input ? progressView(input, { gymId, range, today }) : undefined), [input, gymId, range, today]);
  if (!view || !bands || !gyms) return null;

  const names = Object.fromEntries(bands.map((b) => [b.id, b.name]));
  const wg = bands.find((b) => b.id === view.tiles.workingGrade);
  const prevPhrase = range === '6w' ? 'vs previous 6 weeks' : range === '3m' ? 'vs previous 3 months' : 'vs previous year';
  const few = view.activeBuckets < 3;

  return (
    <section className="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">Progress</h1>
      <div className="chips" role="group" aria-label="Gym filter">
        <button type="button" className="chip" aria-pressed={gymId === null} onClick={() => setGymId(null)}>All gyms</button>
        {gyms.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={gymId === g.id} onClick={() => setGymId(g.id)}>{g.name}</button>
        ))}
      </div>
      <div className="chips filter-row" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r.key} type="button" className="chip" aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

      {view.empty ? (
        <div className="empty">
          <p>No climbs logged yet.</p>
          <a className="btn btn-primary" href={href('/log')}>Log a climb</a>
        </div>
      ) : (
        <>
          <div className="stat-grid" data-testid="tiles">
            <StatTile label="Working grade" value={wg?.name ?? '–'}>
              {wg && <span className="stat-swatch" style={{ background: wg.hex }} aria-hidden="true" />}
            </StatTile>
            <StatTile label={`Sends ${RANGE_PHRASE[range]}`} value={String(view.tiles.sends)}
              delta={view.tiles.sendsDelta === null ? undefined : `${formatDelta(view.tiles.sendsDelta)} ${prevPhrase}`} />
            <StatTile label="Flash rate" value={formatRate(view.tiles.flashRate)}
              delta={view.tiles.flashRateDelta === null ? undefined : `${formatDelta(view.tiles.flashRateDelta, ' pts')} ${prevPhrase}`} />
            <StatTile label="Week streak" value={String(view.tiles.streak)} />
          </div>
          {!wg && <p className="muted hint">Working grade needs 4 climbs at a colour in the last 6 weeks, half of them sent.</p>}

          <ChartCard title="Sends per colour" summary={sendsSummary(view, range)}>
            <StackedSends buckets={view.buckets} kind={view.kind} data={view.sendsPerBucket} bands={bands} />
          </ChartCard>
          <ChartCard title="Grade pyramid" summary={pyramidSummary(view, names)}>
            <Pyramid counts={view.pyramid} bands={bands} />
          </ChartCard>
          <ChartCard title="Flash rate" summary={flashSummary(view, names, range)} note={few || !view.sentBands.length ? KEEP_LOGGING : undefined}>
            <FlashTrend buckets={view.buckets} kind={view.kind} series={view.flashTrend} shown={view.trendBands} all={view.sentBands} bands={bands} />
          </ChartCard>
          <ChartCard title="Style" summary={styleSummary(view)} note={view.styles.length ? undefined : 'Tag climbs with a style when logging to see where you are weakest.'}>
            <StyleBars rows={view.styles} />
          </ChartCard>
          <ChartCard title="Session score" summary={scoreSummary(view, range)} note={few ? KEEP_LOGGING : undefined}>
            <ScoreBars buckets={view.buckets} kind={view.kind} scores={view.scores} />
          </ChartCard>
        </>
      )}
    </section>
  );
}
