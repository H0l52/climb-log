---
name: pwa-ios
description: Use before touching the web app manifest, service worker, vite-plugin-pwa config, GitHub Pages base path, install prompt, storage persistence, camera capture or image downscaling in climb-log. Covers iPhone Safari home-screen quirks and the deploy path.
---

# climb-log on iPhone and GitHub Pages

Target: installed to the home screen from `https://h0l52.github.io/climb-log/`, used offline.

## Base path

- Vite `base: '/climb-log/'`. Use `import.meta.env.BASE_URL` for any URL built in code.
- Manifest `start_url` and `scope`: `/climb-log/`. Icon paths relative.
- Hash routing only. GitHub Pages has no SPA rewrites, so path routes 404 on reload.
- Test with `npm run build && npx vite preview`, which serves under the base path. The dev server hides base-path bugs.
- User data is tied to the origin and path. Renaming the repo or adding a custom domain gives an empty app: warn the owner to export first.

## Manifest and iOS meta

- `display: standalone`, `orientation: portrait`, theme and background colours matching the dark theme.
- Icons: 192 and 512 PNG plus a maskable 512; also `<link rel="apple-touch-icon">` at 180 px (iOS ignores manifest icons in places).
- `<meta name="apple-mobile-web-app-capable" content="yes">` and a status bar style that suits the dark theme.
- Viewport: `viewport-fit=cover`; pad with `env(safe-area-inset-*)`.

## Install

- iOS never fires `beforeinstallprompt`. Detect "not standalone" (`navigator.standalone` / `display-mode` media query) and show a one-time explainer: Share → Add to Home Screen.
- Being installed matters for data safety (below), so the explainer says so.

## Storage safety

- Safari may evict script-writable storage for sites not used for 7 days; home-screen web apps are treated differently. Do not rely on either: 
  1. call `navigator.storage.persist()` on first launch and store the result;
  2. show persistence status and usage (`navigator.storage.estimate()`) in Settings;
  3. keep the 30-day backup reminder.
- Never tell the user their data is "safe" or "permanent". Say where it is and when it was last backed up.

## Service worker

- vite-plugin-pwa, `registerType: 'prompt'`. Precache the whole build; there are no runtime network calls.
- On a waiting worker, show a non-blocking "Reload to update" banner. Do not auto-reload mid-session.
- No push notifications, background sync or periodic sync: do not design features that need them.

## Camera and photos

- `<input type="file" accept="image/*" capture="environment">` opens the camera; without `capture` the user gets the library choice too. Offer both.
- Downscale before storing: decode, draw to a canvas at max 1280 px long edge, `toBlob('image/jpeg', 0.7)`; make a 160 px thumbnail the same way. Respect EXIF orientation (`createImageBitmap(file, { imageOrientation: 'from-image' })`).
- iPhone photos may arrive as HEIC; decoding via the browser handles it, and the stored result is always JPEG.
- Do image work outside any IndexedDB transaction.
- Revoke object URLs after use.

## Export and import on iOS

- Prefer `navigator.share({ files })` when `navigator.canShare` allows it (lets the owner save to Files); fall back to a download link.
- Import through a file input accepting `.zip` and `.json`.

## Layout quirks

- Use `100dvh`. Inputs at ≥ 16 px to prevent zoom. Disable double-tap zoom on controls with `touch-action: manipulation`.
- Overscroll bounce can reveal the background: set it on `html` to match the theme.

## Human checks

You cannot verify install, offline launch, camera or share sheet from here. List them under "Needs human check" in `docs/progress.md` with exact steps.
