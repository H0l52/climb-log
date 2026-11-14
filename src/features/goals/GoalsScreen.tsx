import { useMemo, useState } from 'react';
import { repos } from '../../db';
import { useGoals, useGradeBands, useMetricInput } from '../../db/hooks';
import type { Goal, GoalType, ID } from '../../db/types';
import { formatDate, formatDateIn, melbourneDate, weekStart } from '../../domain/dates';
import { GOAL_TYPES, goalProgress, goalTitle } from '../../domain/goals';
import { firstSendsOfColour, weeklyStreak } from '../../domain/metrics';
import { chipStyle } from '../../ui/chipStyle';
import { GradeChip } from '../../ui/GradeChip';
import { StatTile } from '../../ui/StatTile';
import { Stepper } from '../../ui/Stepper';
import { showToast } from '../../ui/toast';
import { useNow } from '../today/useNow';

const DEFAULT_TARGET: Record<GoalType, number> = { 'first-send-of-colour': 1, 'sends-of-colour': 5, 'flash-rate': 50, 'sessions-per-week': 2 };

function NewGoalForm({ onDone, sentBands, today }: { onDone: () => void; sentBands: Set<ID>; today: string }) {
  const bands = useGradeBands();
  const [type, setType] = useState<GoalType>('first-send-of-colour');
  const [bandId, setBandId] = useState<ID | null>(null);
  const [target, setTarget] = useState(DEFAULT_TARGET['first-send-of-colour']);
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!bands) return null;
  const needsBand = type !== 'sessions-per-week';
  // A first-send goal only makes sense for a colour not sent yet.
  const offered = bands.filter((b) => b.active && !(type === 'first-send-of-colour' && sentBands.has(b.id)));

  const pickType = (t: GoalType) => {
    setType(t);
    setTarget(DEFAULT_TARGET[t]);
    setError(null);
    if (t === 'first-send-of-colour' && bandId && sentBands.has(bandId)) setBandId(null);
  };

  async function save() {
    try {
      await repos.goals.add({ type, gradeBandId: needsBand ? bandId : null, target, deadline: deadline || null });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <form className="sheet goal-form" aria-label="New goal" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 className="label">Goal</h2>
      <div className="chips" role="group" aria-label="Goal type">
        {GOAL_TYPES.map((g) => (
          <button key={g.type} type="button" className="chip" aria-pressed={type === g.type} onClick={() => pickType(g.type)}>{g.label}</button>
        ))}
      </div>
      {needsBand && (
        <>
          <h2 className="label">Colour</h2>
          {offered.length ? (
            <div className="chips" role="group" aria-label="Colour">
              {offered.map((b) => (
                <button key={b.id} type="button" className="grade-chip colour-btn colour-btn-small" style={chipStyle(b)} aria-pressed={bandId === b.id} onClick={() => setBandId(b.id)}>
                  {b.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Every colour has been sent.</p>
          )}
        </>
      )}
      {type !== 'first-send-of-colour' && (
        <div className="row tries-row">
          <h2 className="label grow">{type === 'flash-rate' ? 'Target %' : type === 'sends-of-colour' ? 'Sends' : 'Sessions a week'}</h2>
          {type === 'flash-rate' ? (
            <div className="stepper" role="group" aria-label="Target">
              <button type="button" className="btn" aria-label="Lower target" disabled={target <= 5} onClick={() => setTarget(target - 5)}>−</button>
              <output className="num" aria-live="polite">{target}%</output>
              <button type="button" className="btn" aria-label="Higher target" disabled={target >= 100} onClick={() => setTarget(target + 5)}>+</button>
            </div>
          ) : (
            <Stepper label="Target" value={target} onChange={setTarget} max={type === 'sessions-per-week' ? 7 : 99} />
          )}
        </div>
      )}
      <label className="row">
        <span className="grow">Deadline <span className="muted">(optional)</span></span>
        <input className="field" type="date" value={deadline} min={today} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={needsBand && !bandId}>Add goal</button>
      </div>
    </form>
  );
}

export function GoalsScreen() {
  const goals = useGoals();
  const bands = useGradeBands();
  const input = useMetricInput();
  const today = melbourneDate(useNow(60_000));
  const [adding, setAdding] = useState(false);

  const firsts = useMemo(() => (input ? firstSendsOfColour(input) : []), [input]);
  if (!goals || !bands || !input) return null;

  const band = (id: ID | null) => bands.find((b) => b.id === id);
  const title = (g: Goal) => goalTitle(g, band(g.gradeBandId)?.name ?? '');
  const sessionDates = (input.sessions ?? []).map((s) => s.date);
  const streak = weeklyStreak(sessionDates, today);
  const thisWeek = sessionDates.filter((d) => weekStart(d) === weekStart(today)).length;
  const rows = goals.map((g) => ({ goal: g, p: goalProgress(g, input, today, g.achievedAt) }));
  const open = rows.filter((r) => r.p.status !== 'done');
  const done = rows.filter((r) => r.p.status === 'done').sort((a, b) => b.goal.achievedAt! - a.goal.achievedAt!);

  async function remove(g: Goal) {
    const removed = await repos.goals.remove(g.id);
    showToast(`Goal removed · ${title(g)}`, () => repos.goals.restore(removed));
  }

  return (
    <section className="screen today" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">Goals</h1>
      <div className="stat-grid">
        <StatTile label="Week streak" value={String(streak)} />
        <StatTile label="Sessions this week" value={String(thisWeek)} />
      </div>

      <h2 className="label">Active</h2>
      {open.length ? (
        <ul className="list" aria-label="Active goals">
          {open.map(({ goal, p }) => {
            const b = band(goal.gradeBandId);
            return (
              <li key={goal.id} className="goal">
                <div className="goal-head">
                  {b && <GradeChip band={b} small />}
                  <span className="name">{title(goal)}</span>
                  <button type="button" className="btn btn-small" aria-label={`Remove goal: ${title(goal)}`} onClick={() => void remove(goal)}>Remove</button>
                </div>
                <div className="goal-bar" role="progressbar" aria-label={title(goal)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.fraction * 100)}>
                  <span style={{ width: `${p.fraction * 100}%` }} />
                </div>
                <div className="goal-meta">
                  <span className="num">{p.text}</span>
                  {goal.deadline && <span className={p.status === 'missed' ? 'error' : 'muted'}>{p.status === 'missed' ? 'Missed' : 'By'} {formatDate(goal.deadline)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <p className="muted">No goals yet. Add one to track it here.</p>
      )}

      {adding && <NewGoalForm onDone={() => setAdding(false)} sentBands={new Set(firsts.map((f) => f.bandId))} today={today} />}

      {done.length > 0 && (
        <>
          <h2 className="label">Achieved</h2>
          <ul className="timeline" aria-label="Achieved goals">
            {done.map(({ goal }) => {
              const b = band(goal.gradeBandId);
              return (
                <li key={goal.id}>
                  {b && <GradeChip band={b} small />}
                  <span className="grow">{title(goal)}</span>
                  <span className="muted">{formatDateIn(melbourneDate(goal.achievedAt!), today)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="label">Achievements</h2>
      {firsts.length ? (
        <ul className="timeline" aria-label="Achievements">
          {[...firsts].reverse().map((f) => {
            const b = band(f.bandId);
            return (
              <li key={f.bandId}>
                {b && <GradeChip band={b} small />}
                <span className="grow">First send{f.flash ? ' · flash' : ''}</span>
                <span className="muted">{formatDateIn(f.date, today)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Your first send of each colour shows here.</p>
      )}

      {!adding && (
        <div className="action-bar action-bar-single">
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>New goal</button>
        </div>
      )}
    </section>
  );
}
