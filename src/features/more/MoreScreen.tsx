import { href } from '../../app/router';

export function MoreScreen() {
  return (
    <section className="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">More</h1>
      <ul className="list">
        <li><a className="menu-link" href={href('/sessions')}>Sessions</a></li>
        <li><a className="menu-link" href={href('/board')}>Board log</a></li>
        <li><a className="menu-link" href={href('/settings')}>Settings</a></li>
      </ul>
    </section>
  );
}
