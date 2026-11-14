/**
 * iOS home-screen launch bug: with viewport-fit=cover and a translucent status bar, WebKit can
 * start the app with a layout viewport shorter than the screen (by about the status bar height)
 * and only corrects it after the page scrolls. `position: fixed; bottom: 0` then floats the tab
 * bar up on screens too short to scroll. We measure the real height and, in standalone mode,
 * anchor bottom chrome from the top using it (see `.tabbar` in base.css).
 */

export interface ViewportInput {
  standalone: boolean;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
}

/** Height in CSS px that the app actually occupies. Pure; tested. */
export function appHeight({ standalone, innerWidth, innerHeight, screenWidth, screenHeight }: ViewportInput): number {
  // In a browser tab, toolbars take space, so trust the window. In landscape the screen's
  // long edge is the width, so the fix does not apply either.
  if (!standalone || innerWidth > innerHeight) return innerHeight;
  // The installed app covers the whole screen in portrait: its height is the screen's long edge.
  // Never go below what the browser reports.
  return Math.max(innerHeight, Math.max(screenWidth, screenHeight));
}

export function isStandalone(win: Window = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Keep `--app-height` and `data-standalone` on <html> current. Returns a cleanup function. */
export function installViewportFix(win: Window = window): () => void {
  const root = win.document.documentElement;
  const update = () => {
    const standalone = isStandalone(win);
    root.toggleAttribute('data-standalone', standalone);
    const h = appHeight({
      standalone,
      innerWidth: win.innerWidth,
      innerHeight: win.innerHeight,
      screenWidth: win.screen.width,
      screenHeight: win.screen.height,
    });
    root.style.setProperty('--app-height', `${h}px`);
  };
  update();
  // iOS settles the viewport late after launch and after returning from the app switcher.
  const timers = [50, 300, 1000].map((ms) => win.setTimeout(update, ms));
  const events = ['resize', 'orientationchange', 'pageshow'] as const;
  events.forEach((e) => win.addEventListener(e, update));
  win.visualViewport?.addEventListener('resize', update);
  const onVisible = () => win.document.visibilityState === 'visible' && update();
  win.document.addEventListener('visibilitychange', onVisible);
  return () => {
    timers.forEach((t) => win.clearTimeout(t));
    events.forEach((e) => win.removeEventListener(e, update));
    win.visualViewport?.removeEventListener('resize', update);
    win.document.removeEventListener('visibilitychange', onVisible);
  };
}
