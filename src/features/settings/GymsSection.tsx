import { repos } from '../../db';
import { useGyms } from '../../db/hooks';
import { WEEKDAY_SHORT } from '../../domain/dates';

export function GymsSection() {
  const gyms = useGyms();
  if (!gyms) return null;
  return (
    <section className="section" aria-labelledby="gyms-h">
      <h2 id="gyms-h">Gyms and set days</h2>
      <ul className="list">
        {gyms.map((gym) => (
          <li key={gym.id} className="stack">
            <div className="list-row"><span className="name">{gym.name}</span></div>
            <div className="chips" role="group" aria-label={`Set days at ${gym.name}`}>
              {WEEKDAY_SHORT.map((label, i) => {
                const day = i + 1;
                const on = gym.setDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => void repos.gyms.setSetDays(gym.id, on ? gym.setDays.filter((d) => d !== day) : [...gym.setDays, day])}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
