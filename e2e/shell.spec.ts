import { expect, test, type Page, type Request } from '@playwright/test';

const BASE = '/climb-log/';

/** Every same-origin request must stay under the base path. */
function trackRequests(page: Page) {
  const outside: string[] = [];
  const failed: string[] = [];
  page.on('request', (r: Request) => {
    const u = new URL(r.url());
    if (u.origin === new URL(page.url() || 'http://localhost').origin && !u.pathname.startsWith(BASE)) outside.push(u.pathname);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  return { outside, failed };
}

test('app shell loads under the base path with all five tabs', async ({ page }) => {
  const reqs = trackRequests(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [tab, heading, hash] of [
    ['Walls', 'Walls', '#/walls'],
    ['Progress', 'Progress', '#/progress'],
    ['Goals', 'Goals', '#/goals'],
    ['More', 'More', '#/more'],
    ['Today', 'Today', '#/'],
  ] as const) {
    await nav.getByRole('link', { name: tab }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(BASE);
    expect(new URL(page.url()).hash).toBe(hash);
    await expect(nav.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
  }
  expect(reqs.outside).toEqual([]);
  expect(reqs.failed).toEqual([]);
});

test('every route survives a reload', async ({ page }) => {
  for (const [hash, heading] of [
    ['#/', 'Today'],
    ['#/walls', 'Walls'],
    ['#/progress', 'Progress'],
    ['#/goals', 'Goals'],
    ['#/more', 'More'],
    ['#/board', 'Board log'],
    ['#/settings', 'Settings'],
    ['#/nowhere', 'Not found'],
  ] as const) {
    await page.goto(`./${hash}`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('manifest, icons and service worker are served under the base path', async ({ page, request }) => {
  await page.goto('./');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe(`${BASE}manifest.webmanifest`);
  const manifest = await (await request.get(manifestHref!)).json();
  expect(manifest).toMatchObject({ start_url: BASE, scope: BASE, display: 'standalone' });
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(`${BASE}${icon.src}`);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(touch!, page.url()).toString())).status()).toBe(200);
  expect((await request.get(`${BASE}sw.js`)).status()).toBe(200);
});
