import { useSyncExternalStore } from 'react';

export type RouteName = 'today' | 'log' | 'walls' | 'wall' | 'progress' | 'goals' | 'more' | 'board' | 'sessions' | 'settings' | 'notFound';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

/** Parse a location hash such as '#/walls/abc'. Pure; tested. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'today', params: {} };
  const [head, id, ...rest] = parts;
  if (rest.length) return { name: 'notFound', params: {} };
  switch (head) {
    case 'walls':
      return id ? { name: 'wall', params: { id: decodeURIComponent(id) } } : { name: 'walls', params: {} };
    case 'log':
    case 'progress':
    case 'goals':
    case 'more':
    case 'board':
    case 'sessions':
    case 'settings':
      return id ? { name: 'notFound', params: {} } : { name: head, params: {} };
    default:
      return { name: 'notFound', params: {} };
  }
}

/** Hash href. Hash links are relative to the current document, so they respect the base path. */
export const href = (path: string) => `#${path}`;

/** Go to a route from code (after a save). */
export function navigate(path: string): void {
  window.location.hash = href(path);
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}
