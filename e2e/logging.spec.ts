import { expect, test, type Page } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };

// Gyms are listed by name; the first is the default on first launch.
const gyms = [...seed.gyms].sort((a, b) => a.name.localeCompare(b.name));
const gym = gyms[0]!;
const otherGym = gyms[1]!;
const wallNames = (gymId: string) =>
  seed.walls.filter((w) => w.gymId === gymId && w.kind === 'boulder').map((w) => w.name).sort((a, b) => a.localeCompare(b));
const walls = wallNames(gym.id);
const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.name);

declare global {
  interface Window { __taps: number }
}

test.beforeEach(async ({ page }) => {
  // Count every real tap (click) the page receives. Typing is not a tap.
  await page.addInitScript(() => {
    window.__taps = 0;
    document.addEventListener('click', () => { window.__taps += 1; }, true);
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

const wallGroup = (page: Page) => page.getByRole('group', { name: /^Wall/ });
const colour = (page: Page, name: string) => page.getByRole('group', { name: 'Colour' }).getByRole('button', { name, exact: true });
const result = (page: Page, name: string) => page.getByRole('group', { name: 'Result' }).getByRole('button', { name, exact: true });
const sessionList = (page: Page) => page.getByRole('list', { name: 'This session' });
const taps = (page: Page) => page.evaluate(() => window.__taps);

/** Open Log climb and start counting taps from zero, as the budget table says ("after the screen is open"). */
async function openLog(page: Page) {
  await page.getByRole('link', { name: 'Log climb' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Log climb' })).toBeVisible();
  await expect(wallGroup(page).getByRole('button').first()).toBeVisible();
  await page.evaluate(() => { window.__taps = 0; });
}

async function backOnToday(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

async function counts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('climb-log');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = <T,>(store: string) =>
      new Promise<T[]>((res, rej) => {
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => res(r.result as T[]);
        r.onerror = () => rej(r.error);
      });
    const attempts = await all<{ result: string; tries: number }>('attempts');
    const problems = await all<{ status: string }>('problems');
    const sessions = await all<{ endedAt: number | null }>('sessions');
    db.close();
    const by = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});
    return {
      attempts: attempts.length,
      tries: attempts.reduce((n, a) => n + a.tries, 0),
      results: by(attempts.map((a) => a.result)),
      problems: problems.length,
      statuses: by(problems.map((p) => p.status)),
      sessions: sessions.length,
      openSessions: sessions.filter((s) => s.endedAt === null).length,
    };
  });
}

test.describe('tap budgets', () => {
  test('new climb, flash, last-used wall: at most 3 taps', async ({ page }) => {
    // Make the second wall the last-used one.
    await openLog(page);
    await wallGroup(page).getByRole('button', { name: walls[1]!, exact: true }).click();
    await colour(page, bands[0]!).click();
    await result(page, 'Flash').click();
    await backOnToday(page);

    await openLog(page);
    await expect(wallGroup(page).getByRole('button').first()).toHaveText(walls[1]!);
    await expect(wallGroup(page).getByRole('button', { name: walls[1]!, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await colour(page, bands[1]!).click();
    await result(page, 'Flash').click();
    await backOnToday(page);
    expect(await taps(page)).toBeLessThanOrEqual(3);
    expect(await taps(page)).toBe(2);

    const first = sessionList(page).getByRole('listitem').first();
    await expect(first).toContainText(bands[1]!);
    await expect(first).toContainText(walls[1]!);
    await expect(first).toContainText('Flash');
  });

  test('new climb, any wall: at most 4 taps', async ({ page }) => {
    await openLog(page);
    await wallGroup(page).getByRole('button', { name: walls[1]!, exact: true }).click();
    await colour(page, bands[3]!).click();
    await page.getByRole('button', { name: 'More tries' }).click();
    await result(page, 'Sent').click();
    await backOnToday(page);
    expect(await taps(page)).toBeLessThanOrEqual(4);

    const first = sessionList(page).getByRole('listitem').first();
    await expect(first).toContainText(walls[1]!);
    await expect(first).toContainText('Sent · 2 tries');
  });

  test('re-log an existing project: at most 2 taps', async ({ page }) => {
    await openLog(page);
    await colour(page, bands[2]!).click();
    await result(page, 'Not yet').click();
    await backOnToday(page);

    await openLog(page);
    const projects = page.getByRole('list', { name: 'Projects on this wall' });
    await expect(projects.getByRole('listitem')).toHaveCount(1);
    await expect(projects).toContainText('1 try');
    await projects.getByRole('button').first().click();
    await result(page, 'Sent').click(); // never "Flash" on a re-log
    await backOnToday(page);
    expect(await taps(page)).toBeLessThanOrEqual(2);

    await expect(sessionList(page).getByRole('listitem')).toHaveCount(2);
    await expect(sessionList(page).getByRole('listitem').first()).toContainText('Sent');
    expect(await counts(page)).toMatchObject({ problems: 1, attempts: 2, statuses: { sent: 1 }, results: { fail: 1, send: 1 } });

    // Sent problems leave the projects list.
    await openLog(page);
    await expect(page.getByRole('list', { name: 'Projects on this wall' })).toHaveCount(0);
  });

  test('new wall + first climb: at most 6 taps plus typing; the wall is saved to the current gym', async ({ page }) => {
    await openLog(page);
    await page.getByRole('button', { name: '+ New wall' }).click();
    await page.getByLabel('New wall name').fill('Test prow');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(wallGroup(page).getByRole('button', { name: 'Test prow', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await colour(page, bands[4]!).click();
    await result(page, 'Flash').click();
    await backOnToday(page);
    expect(await taps(page)).toBeLessThanOrEqual(6);
    await expect(sessionList(page).getByRole('listitem').first()).toContainText('Test prow');

    // Selectable afterwards, first in the picker, and only in this gym.
    await openLog(page);
    await expect(wallGroup(page).getByRole('button').first()).toHaveText('Test prow');
    await page.getByRole('link', { name: 'Cancel' }).click();
    await page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: otherGym.name }).click();
    await openLog(page);
    await expect(wallGroup(page).getByRole('button', { name: 'Test prow', exact: true })).toHaveCount(0);
    await page.goto('./#/settings');
    await page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: gym.name }).click();
    await expect(page.getByRole('list', { name: 'Active walls' }).getByText('Test prow', { exact: true })).toBeVisible();
  });
});

test('logging with no open session starts one; switching gym changes the wall list', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
  expect(await counts(page)).toMatchObject({ sessions: 0 });

  await openLog(page);
  await expect(wallGroup(page).getByRole('button')).toHaveText([...walls, '+ New wall']);
  await colour(page, bands[0]!).click();
  await result(page, 'Flash').click();
  await backOnToday(page);
  await expect(page.getByRole('button', { name: 'End session' })).toBeVisible();
  expect(await counts(page)).toMatchObject({ sessions: 1, openSessions: 1 });

  // The other gym has its own walls, and remembers being picked.
  await page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: otherGym.name }).click();
  await expect(page.getByText(`Session open at ${gym.name}`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: otherGym.name })).toHaveAttribute('aria-pressed', 'true');
  await openLog(page);
  await expect(wallGroup(page).getByRole('button')).toHaveText([...wallNames(otherGym.id), '+ New wall']);

  // Logging there ends the first session and opens one for that gym.
  await colour(page, bands[0]!).click();
  await result(page, 'Flash').click();
  await backOnToday(page);
  await expect(sessionList(page).getByRole('listitem')).toHaveCount(1);
  expect(await counts(page)).toMatchObject({ sessions: 2, openSessions: 1 });
});

test('start and end a session from Today', async ({ page }) => {
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByText('Nothing logged yet')).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
  await expect(page.getByText(/Last session/)).toBeVisible();
  expect(await counts(page)).toMatchObject({ sessions: 1, openSessions: 0 });
});

test('edit an entry, delete it, and Undo restores it exactly', async ({ page }) => {
  await openLog(page);
  await colour(page, bands[5]!).click();
  await result(page, 'Flash').click();
  await backOnToday(page);
  await openLog(page);
  await colour(page, bands[1]!).click();
  await page.getByRole('button', { name: 'More tries' }).click();
  await page.getByRole('button', { name: 'More tries' }).click();
  await result(page, 'Not yet').click();
  await backOnToday(page);

  const items = sessionList(page).getByRole('listitem');
  await expect(items).toHaveCount(2);
  const tally = page.getByTestId('tally');
  await expect(tally).toContainText('1send1flash1not yet');

  // Edit: the 3-try project becomes a 4-try send.
  await items.first().getByRole('button', { name: /^Edit/ }).click();
  await page.getByRole('button', { name: 'More tries' }).click();
  await items.first().getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Sent' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(items.first()).toContainText('Sent · 4 tries');
  await expect(tally).toContainText('2sends1flash0not yet');

  const before = await counts(page);
  const textBefore = await items.allInnerTexts();

  await items.first().getByRole('button', { name: /^Edit/ }).click();
  await page.getByRole('button', { name: /^Delete/ }).click();
  await expect(items).toHaveCount(1);
  await expect(tally).toContainText('1send1flash0not yet');
  expect(await counts(page)).toMatchObject({ attempts: 1, problems: 1 });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(items).toHaveCount(2);
  expect(await items.allInnerTexts()).toEqual(textBefore);
  expect(await counts(page)).toEqual(before);
});

test('Undo on the save toast removes the climb just logged', async ({ page }) => {
  await openLog(page);
  await colour(page, bands[0]!).click();
  await result(page, 'Flash').click();
  await backOnToday(page);
  await expect(sessionList(page).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(sessionList(page)).toHaveCount(0);
  expect(await counts(page)).toMatchObject({ attempts: 0, problems: 0 });
});

test('50 climbs across 3 sessions survive a reload with identical counts', async ({ page }) => {
  test.slow();
  let logged = 0;
  for (const size of [17, 17, 16]) {
    for (let i = 0; i < size; i++, logged++) {
      await page.getByRole('link', { name: 'Log climb' }).click();
      await colour(page, bands[logged % bands.length]!).click();
      if (logged % 5 === 4) await page.getByRole('button', { name: 'More tries' }).click();
      await result(page, logged % 3 === 2 ? 'Not yet' : logged % 5 === 4 ? 'Sent' : 'Flash').click();
      await expect(sessionList(page).getByRole('listitem')).toHaveCount(i + 1);
    }
    await page.getByRole('button', { name: 'End session' }).click();
    await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
  }

  const before = await counts(page);
  expect(before).toMatchObject({ attempts: 50, problems: 50, sessions: 3, openSessions: 0 });
  expect(before.results.fail).toBe(16);
  const summary = await page.getByTestId('tally').innerText();

  await page.reload();
  await expect(page.getByText(/Last session/)).toBeVisible();
  await expect(page.getByText('16 climbs')).toBeVisible();
  expect(await page.getByTestId('tally').innerText()).toBe(summary);
  expect(await counts(page)).toEqual(before);
});
