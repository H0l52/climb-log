import { expect, test, type Page } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };

// Gyms are listed by name; the first is the default on first launch. Walls are data, read from the seed.
const gyms = [...seed.gyms].sort((a, b) => a.name.localeCompare(b.name));
const gym = gyms[0]!;
const otherGym = gyms[1]!;
const wallNames = (gymId: string) =>
  seed.walls.filter((w) => w.gymId === gymId && w.kind === 'boulder').map((w) => w.name).sort((a, b) => a.localeCompare(b));
const walls = wallNames(gym.id);
const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.name);

const colour = (page: Page, name: string) => page.getByRole('group', { name: 'Colour' }).getByRole('button', { name, exact: true });
const result = (page: Page, name: string) => page.getByRole('group', { name: 'Result' }).getByRole('button', { name, exact: true });
const wallButton = (page: Page, name: string) => page.getByRole('group', { name: /^Wall/ }).getByRole('button', { name, exact: true });
const projectsList = (page: Page) => page.getByRole('list', { name: 'Projects on this wall' });

/** Melbourne calendar date, as the app computes it. */
const melbourneToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function logClimb(page: Page, wall: string, band: string, res: 'Not yet' | 'Flash') {
  await page.getByRole('link', { name: 'Log climb' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Log climb' })).toBeVisible();
  await wallButton(page, wall).click();
  await colour(page, band).click();
  await result(page, res).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

async function openWall(page: Page, wall: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Walls' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Walls' })).toBeVisible();
  await page.getByRole('list', { name: 'Walls' }).getByRole('link', { name: new RegExp(`^${wall}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: wall })).toBeVisible();
}

async function statuses(page: Page) {
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
    const problems = await all<{ status: string }>('problems');
    const attempts = await all<unknown>('attempts');
    const sets = await all<{ retiredDate: string | null }>('wallSets');
    db.close();
    const by = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});
    return { statuses: by(problems.map((p) => p.status)), attempts: attempts.length, sets: sets.length, retired: sets.filter((s) => s.retiredDate).length };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('projects from an expired set leave the Log climb projects list', async ({ page }) => {
  await logClimb(page, walls[0]!, bands[2]!, 'Not yet');
  await logClimb(page, walls[0]!, bands[0]!, 'Flash');
  await logClimb(page, walls[1]!, bands[3]!, 'Not yet');

  await page.getByRole('link', { name: 'Log climb' }).click();
  await wallButton(page, walls[0]!).click();
  await expect(projectsList(page).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('link', { name: 'Cancel' }).click();

  await openWall(page, walls[0]!);
  await page.getByRole('button', { name: 'Mark as reset' }).click();
  const date = page.getByLabel('Reset on');
  // Seeded sets are dated the first-launch day, so today is both the earliest and the latest allowed date.
  await expect(date).toHaveValue(melbourneToday());
  await expect(date).toHaveAttribute('max', melbourneToday());
  await expect(date).toHaveAttribute('min', melbourneToday());
  await expect(page.getByText('1 project will expire.')).toBeVisible();
  await page.getByRole('form', { name: 'Mark as reset' }).getByRole('button', { name: 'Mark as reset' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'reset' }).first()).toBeVisible();
  await expect(page.getByText('Nothing logged on this set yet.')).toBeVisible();
  await page.getByText('Past sets (1)').click();
  await expect(page.getByRole('list', { name: 'Past sets' })).toContainText('2 climbs');
  expect(await statuses(page)).toMatchObject({ statuses: { expired: 1, sent: 1, project: 1 }, attempts: 3, retired: 1 });

  // The reset wall has no projects; the other wall keeps its project.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click();
  await page.getByRole('link', { name: 'Log climb' }).click();
  await wallButton(page, walls[0]!).click();
  await expect(projectsList(page)).toHaveCount(0);
  await wallButton(page, walls[1]!).click();
  await expect(projectsList(page).getByRole('listitem')).toHaveCount(1);
});

test('undo reset puts the project back on the Log climb list', async ({ page }) => {
  await logClimb(page, walls[0]!, bands[2]!, 'Not yet');
  const before = await statuses(page);

  await openWall(page, walls[0]!);
  await page.getByRole('button', { name: 'Mark as reset' }).click();
  await page.getByRole('form', { name: 'Mark as reset' }).getByRole('button', { name: 'Mark as reset' }).click();
  await page.getByRole('button', { name: 'Undo reset' }).click();
  await expect(page.getByRole('button', { name: 'Undo reset' })).toHaveCount(0);
  expect(await statuses(page)).toEqual(before);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click();
  await page.getByRole('link', { name: 'Log climb' }).click();
  await wallButton(page, walls[0]!).click();
  await expect(projectsList(page).getByRole('listitem')).toHaveCount(1);
});

test('cancel leaves the wall as it was', async ({ page }) => {
  await openWall(page, walls[0]!);
  await page.getByRole('button', { name: 'Mark as reset' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Mark as reset' })).toBeVisible();
  expect((await statuses(page)).retired).toBe(0);
});

test('Today shows a wall strip with days since set and a fresh badge', async ({ page }) => {
  const strip = page.getByRole('navigation', { name: 'Walls by days since set' });
  await expect(strip.getByRole('link')).toHaveCount(walls.length);
  const first = strip.getByRole('link', { name: new RegExp(`^${walls[0]}`) });
  await expect(first).toContainText('0 days');
  await expect(first).toContainText('Fresh');
  await first.click();
  await expect(page.getByRole('heading', { level: 1, name: walls[0]! })).toBeVisible();
  await expect(page.getByText('Set today')).toBeVisible();

  // The strip follows the gym switcher.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click();
  await page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: otherGym.name }).click();
  await expect(strip.getByRole('link')).toHaveCount(wallNames(otherGym.id).length);
});

test('Walls list shows sent and project counts for the current set', async ({ page }) => {
  await logClimb(page, walls[0]!, bands[0]!, 'Flash');
  await logClimb(page, walls[0]!, bands[1]!, 'Not yet');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Walls' }).click();
  const row = page.getByRole('list', { name: 'Walls' }).getByRole('link', { name: new RegExp(`^${walls[0]}`) });
  await expect(row.getByLabel('Sent: 1')).toContainText(bands[0]!);
  await expect(row.getByLabel('Projects: 1')).toContainText(bands[1]!);
});

test('unknown wall shows not found', async ({ page }) => {
  await page.goto('./#/walls/nope');
  await expect(page.getByRole('heading', { level: 1, name: 'Wall not found' })).toBeVisible();
});
