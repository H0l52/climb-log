import { expect, test } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };

// The default gym is the first by name; its boards are data like any wall.
const gym = [...seed.gyms].sort((a, b) => a.name.localeCompare(b.name))[0]!;
const boards = seed.walls.filter((w) => w.gymId === gym.id && w.kind === 'board').map((w) => w.name).sort((a, b) => a.localeCompare(b));

test('log a board climb: it shows in the session and history, never in colour stats', async ({ page }) => {
  test.skip(boards.length === 0, 'default gym has no board');
  await page.goto('./#/more');
  await page.getByRole('link', { name: 'Board log' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Board log' })).toBeVisible();

  const picker = page.getByRole('group', { name: /^Board/ });
  await expect(picker.getByRole('button')).toHaveText(boards);
  await picker.getByRole('button', { name: boards[0]!, exact: true }).click();
  await page.getByLabel('Climb name').fill('Crimp ladder');
  await page.getByRole('group', { name: 'Grade' }).getByRole('button', { name: 'V5', exact: true }).click();
  await page.getByRole('group', { name: 'Angle' }).getByRole('button', { name: '40°', exact: true }).click();
  await page.getByRole('button', { name: 'More tries' }).click();
  await page.getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Sent' }).click();

  const thisSession = page.getByRole('list', { name: 'Board climbs this session' });
  await expect(thisSession.getByRole('listitem')).toHaveCount(1);
  await expect(thisSession).toContainText('Crimp ladder');
  await expect(thisSession).toContainText('V5 · 40° · Sent · 2 tries');
  // Form resets for the next climb; the angle is kept.
  await expect(page.getByLabel('Climb name')).toHaveValue('');
  await expect(page.getByRole('group', { name: 'Angle' }).getByRole('button', { name: '40°', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Today: the open session lists it; the colour tally stays at zero.
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('list', { name: 'Board this session' })).toContainText('Crimp ladder');
  await expect(page.getByTestId('tally').locator('.num').first()).toHaveText('0');

  // Session history.
  await page.goto('./#/more');
  await page.getByRole('link', { name: 'Sessions' }).click();
  const sessions = page.getByRole('list', { name: 'Sessions' });
  await expect(sessions.getByRole('listitem')).toHaveCount(1);
  await expect(sessions).toContainText('0 climbs · 1 board');
  await sessions.locator('summary').first().click();
  await expect(sessions.getByRole('list', { name: 'Entries' })).toContainText('V5 · 40° · Sent · 2 tries');

  // Progress: no sends, no flash rate.
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('group', { name: /^Sends/ }).getByTestId('value')).toHaveText('0');
  await expect(page.getByRole('group', { name: 'Flash rate' }).getByTestId('value')).toHaveText('–');
});

test('delete a board climb with Undo', async ({ page }) => {
  test.skip(boards.length === 0, 'default gym has no board');
  await page.goto('./#/board');
  await page.getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Not yet' }).click();
  const list = page.getByRole('list', { name: 'Board climbs this session' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await list.getByRole('button', { name: /^Delete/ }).click();
  await expect(list).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('list', { name: 'Board climbs this session' }).getByRole('listitem')).toHaveCount(1);
});
