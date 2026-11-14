import { Placeholder } from '../../ui/Placeholder';
import { href } from '../../app/router';

export function TodayScreen() {
  return (
    <Placeholder title="Today">
      <p>Session logging arrives in the next update.</p>
      <p className="muted">Check your gyms, walls and colours are right first.</p>
      <a className="btn btn-primary" href={href('/settings')}>Open Settings</a>
    </Placeholder>
  );
}
