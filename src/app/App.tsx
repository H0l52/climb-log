import { useEffect, useState } from 'react';
import { initDatabase } from '../db';
import { parseHash, useHash, href, type RouteName } from './router';
import { TabBar } from './TabBar';
import { UpdateBanner } from '../ui/UpdateBanner';
import { Placeholder } from '../ui/Placeholder';
import { TodayScreen } from '../features/today/TodayScreen';
import { WallsScreen } from '../features/walls/WallsScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { GoalsScreen } from '../features/goals/GoalsScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { BoardScreen } from '../features/board/BoardScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

function Screen({ name }: { name: RouteName }) {
  switch (name) {
    case 'today':
    case 'log':
      return <TodayScreen />;
    case 'walls':
    case 'wall':
      return <WallsScreen />;
    case 'progress':
      return <ProgressScreen />;
    case 'goals':
      return <GoalsScreen />;
    case 'more':
      return <MoreScreen />;
    case 'board':
      return <BoardScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'notFound':
      return (
        <Placeholder title="Not found">
          <p>That page does not exist.</p>
          <a className="btn btn-primary" href={href('/')}>Go to Today</a>
        </Placeholder>
      );
  }
}

export function App() {
  const route = parseHash(useHash());
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');

  useEffect(() => {
    initDatabase().then(
      () => setState('ready'),
      (e: unknown) => setState(e instanceof Error ? e : new Error(String(e))),
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  return (
    <div className="app">
      {state === 'ready' && <Screen name={route.name} />}
      {state instanceof Error && (
        <Placeholder title="Storage unavailable">
          <p>This browser blocked on-device storage, so nothing can be saved. Open the app from the home screen, not a private tab.</p>
          <p className="muted">{state.message}</p>
        </Placeholder>
      )}
      <TabBar current={route.name} />
      <UpdateBanner />
    </div>
  );
}
