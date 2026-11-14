import { useEffect, useState } from 'react';
import { initDatabase, repos } from '../db';
import { parseHash, useHash, href, type RouteName } from './router';
import { TabBar } from './TabBar';
import { UpdateBanner } from '../ui/UpdateBanner';
import { Placeholder } from '../ui/Placeholder';
import { TodayScreen } from '../features/today/TodayScreen';
import { LogScreen } from '../features/log/LogScreen';
import { Toast } from '../ui/Toast';
import { dismissToast } from '../ui/toast';
import { WallsScreen } from '../features/walls/WallsScreen';
import { WallDetailScreen } from '../features/walls/WallDetailScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { GoalsScreen } from '../features/goals/GoalsScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { BoardScreen } from '../features/board/BoardScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

function Screen({ name, params }: { name: RouteName; params: Record<string, string> }) {
  switch (name) {
    case 'today':
      return <TodayScreen />;
    case 'log':
      return <LogScreen />;
    case 'walls':
      return <WallsScreen />;
    case 'wall':
      return <WallDetailScreen key={params.id} wallId={params.id ?? ''} />;
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

  // A session left open (phone pocketed, app resumed the next day) is closed when the app comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void initDatabase().then(() => repos.sessions.closeStale()).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    // A toast belongs to Today; it must never cover the next screen's buttons.
    if (route.name !== 'today') dismissToast();
    window.scrollTo(0, 0);
  }, [route.name, route.params.id]);

  return (
    <div className="app">
      {state === 'ready' && <Screen name={route.name} params={route.params} />}
      {state instanceof Error && (
        <Placeholder title="Storage unavailable">
          <p>This browser blocked on-device storage, so nothing can be saved. Open the app from the home screen, not a private tab.</p>
          <p className="muted">{state.message}</p>
        </Placeholder>
      )}
      <TabBar current={route.name} />
      <UpdateBanner />
      <Toast />
    </div>
  );
}
