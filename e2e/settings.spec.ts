import { expect, test } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };

const firstGym = seed.gyms[0]!;
const secondGym = seed.gyms[1]!;
const wallsOf = (gymId: string) => seed.walls.filter((w) => w.gymId === gymId);
const bandsInOrder = [...seed.gradeBands].sort((a, b) => a.order - b.order);

test.beforeEach(async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('shows the seeded walls per gym and colours in order', async ({ page }) => {
  const active = page.getByRole('list', { name: 'Active walls' });
  await page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: firstGym.name }).click();
  await expect(active.getByRole('listitem')).toHaveCount(wallsOf(firstGym.id).length);
  await page.getByRole('group', { name: 'Gym' }).getByRole('button', { name: secondGym.name }).click();
  await expect(active.getByRole('listitem')).toHaveCount(wallsOf(secondGym.id).length);

  const bands = page.getByRole('list', { name: 'Grade colours' }).locator('.grade-chip');
  await expect(bands).toHaveText(bandsInOrder.map((b) => b.name));
});

test('add, rename, retire and restore a wall; edits survive reload', async ({ page }) => {
  const active = page.getByRole('list', { name: 'Active walls' });
  await page.getByLabel('New wall').fill('Test cave');
  await page.getByRole('button', { name: 'Add wall' }).click();
  await expect(active.getByText('Test cave')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Test cave' }).click();
  await page.getByLabel('Wall name').fill('Test cave two');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(active.getByText('Test cave two', { exact: true })).toBeVisible();

  await page.reload();
  await expect(active.getByText('Test cave two', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit Test cave two' }).click();
  await page.getByRole('button', { name: 'Retire wall' }).click();
  await expect(active.getByText('Test cave two', { exact: true })).toHaveCount(0);
  await page.getByText(/Retired and merged/).click();
  await page.getByRole('list', { name: 'Retired walls' }).getByRole('button', { name: 'Restore' }).click();
  await expect(active.getByText('Test cave two', { exact: true })).toBeVisible();
});

test('merge a wall into another', async ({ page }) => {
  const active = page.getByRole('list', { name: 'Active walls' });
  await page.getByLabel('New wall').fill('Dup A');
  await page.getByRole('button', { name: 'Add wall' }).click();
  await expect(active.getByText('Dup A', { exact: true })).toBeVisible();
  await page.getByLabel('New wall').fill('Dup B');
  await page.getByRole('button', { name: 'Add wall' }).click();
  await expect(active.getByText('Dup B', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Dup A' }).click();
  await page.getByLabel('Merge into').selectOption({ label: 'Dup B' });
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  await expect(active.getByText('Dup A', { exact: true })).toHaveCount(0);
  await page.getByText(/Retired and merged/).click();
  await expect(page.getByRole('list', { name: 'Retired walls' }).getByText('Merged into Dup B')).toBeVisible();
});

test('reorder grade colours and the order persists', async ({ page }) => {
  const chips = page.getByRole('list', { name: 'Grade colours' }).locator('.grade-chip');
  const moved = bandsInOrder[4]!.name;
  await page.getByRole('button', { name: `Move ${moved} easier` }).click();
  const expected = bandsInOrder.map((b) => b.name);
  [expected[3], expected[4]] = [expected[4]!, expected[3]!];
  await expect(chips).toHaveText(expected);
  await page.reload();
  await expect(chips).toHaveText(expected);
});

test('toggle a set day', async ({ page }) => {
  const days = page.getByRole('group', { name: `Set days at ${firstGym.name}` });
  const sun = days.getByRole('button', { name: 'Sun' });
  await expect(sun).toHaveAttribute('aria-pressed', 'false');
  await sun.click();
  await expect(sun).toHaveAttribute('aria-pressed', 'true');
});

test('shows storage persistence status and version', async ({ page }) => {
  await expect(page.getByTestId('persist-status')).toHaveText(/Granted|Not granted|Not supported/);
  await expect(page.getByText('Version')).toBeVisible();
});
