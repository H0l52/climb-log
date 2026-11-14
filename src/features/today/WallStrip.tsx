import { useWallSummaries } from '../../db/hooks';
import type { ID } from '../../db/types';
import { href } from '../../app/router';
import { FreshBadge } from '../walls/SetBits';
import { daysSinceSet } from '../../domain/resets';

/** Today's strip of walls: days since set, "Fresh" for the last 7 days. Freshest first. */
export function WallStrip({ gymId, today }: { gymId: ID | undefined; today: string }) {
  const walls = useWallSummaries(gymId);
  const withSets = (walls ?? []).flatMap((w) => (w.current ? [{ wall: w.wall, setDate: w.current.setDate }] : []));
  if (!withSets.length) return null;
  const sorted = [...withSets].sort((a, b) => b.setDate.localeCompare(a.setDate) || a.wall.name.localeCompare(b.wall.name));
  return (
    <nav className="scroll-row wall-strip" aria-label="Walls by days since set">
      {sorted.map(({ wall, setDate }) => {
        const d = daysSinceSet(setDate, today);
        return (
          <a key={wall.id} className="wall-tile" href={href(`/walls/${encodeURIComponent(wall.id)}`)}>
            <span className="wall-tile-name">{wall.name}</span>
            <span className="wall-tile-age">
              <span><span className="num">{d}</span><span className="muted"> {d === 1 ? 'day' : 'days'}</span></span>
              <FreshBadge setDate={setDate} today={today} />
            </span>
          </a>
        );
      })}
    </nav>
  );
}
