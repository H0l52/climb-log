import { Placeholder } from '../../ui/Placeholder';
import { href } from '../../app/router';

export function WallsScreen() {
  return (
    <Placeholder title="Walls">
      <p>Wall sets and resets arrive in a later update.</p>
      <a className="btn" href={href('/settings')}>Edit walls in Settings</a>
    </Placeholder>
  );
}
