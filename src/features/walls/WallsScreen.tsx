import { repos } from '../../db';
import { useCurrentGym, useGradeBands, useWallSummaries } from '../../db/hooks';
import { melbourneDate } from '../../domain/dates';
import { countByBand } from '../../domain/walls';
import { href } from '../../app/router';
import { useNow } from '../today/useNow';
import { CountLine, SetAge } from './SetBits';

export function WallsScreen() {
  const current = useCurrentGym();
  const bands = useGradeBands();
  const walls = useWallSummaries(current?.gymId);
  const today = melbourneDate(useNow(60_000));
  if (!current || !bands || !walls) return null;

  return (
    <section className="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">Walls</h1>
      <div className="chips" role="group" aria-label="Gym" style={{ marginBottom: 16 }}>
        {current.gyms.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={g.id === current.gymId} onClick={() => void repos.settings.set('lastGymId', g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      {walls.length === 0 ? (
        <div className="empty">
          <p>No walls for this gym yet.</p>
          <a className="btn" href={href('/settings')}>Add a wall in Settings</a>
        </div>
      ) : (
        <ul className="list" aria-label="Walls">
          {walls.map(({ wall, current: set, problems }) => {
            const c = countByBand(problems);
            return (
              <li key={wall.id}>
                <a className="wall-row" href={href(`/walls/${encodeURIComponent(wall.id)}`)}>
                  <span className="wall-row-head">
                    <span className="name">{wall.name}</span>
                    {set && <SetAge setDate={set.setDate} today={today} />}
                  </span>
                  <CountLine label="Sent" counts={c.sent} bands={bands} />
                  <CountLine label="Projects" counts={c.project} bands={bands} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
