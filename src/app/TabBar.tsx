import type { RouteName } from './router';
import { href } from './router';
import { IconGoals, IconMore, IconProgress, IconToday, IconWalls } from '../ui/icons';

const TABS = [
  { label: 'Today', path: '/', Icon: IconToday, routes: ['today', 'log'] },
  { label: 'Walls', path: '/walls', Icon: IconWalls, routes: ['walls', 'wall'] },
  { label: 'Progress', path: '/progress', Icon: IconProgress, routes: ['progress'] },
  { label: 'Goals', path: '/goals', Icon: IconGoals, routes: ['goals'] },
  { label: 'More', path: '/more', Icon: IconMore, routes: ['more', 'board', 'sessions', 'settings'] },
] as const satisfies ReadonlyArray<{ routes: readonly RouteName[] } & Record<string, unknown>>;

export function TabBar({ current }: { current: RouteName }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ label, path, Icon, routes }) => (
        <a key={path} href={href(path)} aria-current={(routes as readonly RouteName[]).includes(current) ? 'page' : undefined}>
          <Icon />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
