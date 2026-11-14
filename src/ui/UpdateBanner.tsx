import { useRegisterSW } from 'virtual:pwa-register/react';

/** Non-blocking "Reload to update" banner. Never reloads on its own. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="banner" role="status">
      <span className="grow">New version ready</span>
      <button type="button" className="btn btn-primary btn-small" onClick={() => void updateServiceWorker(true)}>
        Reload to update
      </button>
      <button type="button" className="btn btn-small" aria-label="Dismiss update notice" onClick={() => setNeedRefresh(false)}>
        ✕
      </button>
    </div>
  );
}
