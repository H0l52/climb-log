import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };
import { openLog, openSettings } from './nav';
import { makeTestImages } from './testImages';

const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.name);
const DAY = 86_400_000;
/** 2026-11-14 10:00 Melbourne. */
const T0 = Date.UTC(2026, 10, 13, 23, 0, 0);

async function logClimb(page: Page, band: string, photo?: Buffer) {
  await openLog(page);
  await page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: band, exact: true }).click();
  if (photo) {
    await page.getByText('More detail').click();
    await page.getByLabel('Choose photo').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: photo });
    await expect(page.getByRole('img', { name: 'Photo to save' })).toBeVisible();
  }
  await page.getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Flash' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

/** Settings → Export backup → Save backup; returns the downloaded file. */
async function exportBackup(page: Page, includePhotos = true): Promise<{ name: string; bytes: Buffer }> {
  await openSettings(page);
  const toggle = page.getByRole('button', { name: /^Include photos/ });
  if ((await toggle.getAttribute('aria-pressed')) !== String(includePhotos)) await toggle.click();
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup' }).click();
  const d = await download;
  return { name: d.suggestedFilename(), bytes: await readFile((await d.path())!) };
}

test('export with photos, then import it back: data and photos return', async ({ page }) => {
  await page.goto('./');
  const [img] = await makeTestImages(page, 1, { width: 1600, height: 1200 });
  await logClimb(page, bands[0]!, img);
  await logClimb(page, bands[1]!);

  const file = await exportBackup(page);
  expect(file.name).toMatch(/^climb-log-\d{4}-\d{2}-\d{2}\.zip$/);
  expect(file.bytes.subarray(0, 2).toString()).toBe('PK');
  await expect(page.getByTestId('last-backup')).toContainText('today');

  // More climbing after the backup; the import must replace it.
  await logClimb(page, bands[2]!);
  await openSettings(page);
  await page.getByLabel('Import backup').setInputFiles({ name: file.name, mimeType: 'application/zip', buffer: file.bytes });
  const confirm = page.getByRole('group', { name: 'Confirm import' });
  await expect(confirm).toContainText('1 session, 2 climbs and 1 photo');
  await confirm.getByRole('button', { name: 'Replace data' }).click();
  await expect(page.getByText('Backup imported')).toBeVisible();
  await expect(page.getByTestId('photo-usage')).toHaveText(/^1 · /);

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('list', { name: 'This session' }).getByRole('listitem')).toHaveCount(2);
});

test('JSON-only export when photos are off', async ({ page }) => {
  await page.goto('./');
  await logClimb(page, bands[0]!);
  const file = await exportBackup(page, false);
  expect(file.name).toMatch(/\.json$/);
  const json = JSON.parse(file.bytes.toString('utf8'));
  expect(json).toMatchObject({ app: 'climb-log', schemaVersion: 1, photos: [] });
  expect(json.tables.attempts).toHaveLength(1);
});

test('import refuses a newer backup and a file from another app, with a clear message', async ({ page }) => {
  await page.goto('./');
  await logClimb(page, bands[0]!);
  const { bytes } = await exportBackup(page, false);
  const newer = { ...JSON.parse(bytes.toString('utf8')), schemaVersion: 99 };
  const input = page.getByLabel('Import backup');

  await input.setInputFiles({ name: 'newer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(newer)) });
  await expect(page.getByRole('alert')).toHaveText(/newer version of Climb Log.*Update the app/);
  await expect(page.getByRole('group', { name: 'Confirm import' })).toHaveCount(0);

  await input.setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'other-tracker', version: 3, climbs: [] })) });
  await expect(page.getByRole('alert')).toHaveText('This file is not a Climb Log backup.');
  await expect(page.getByRole('group', { name: 'Confirm import' })).toHaveCount(0);

  // Nothing was replaced.
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('list', { name: 'This session' }).getByRole('listitem')).toHaveCount(1);
});

test('backup banner appears at 31 days and clears after an export (fake clock)', async ({ page }) => {
  const banner = page.getByTestId('backup-banner');
  const at = async (days: number) => {
    await page.clock.setFixedTime(T0 + days * DAY);
    await page.getByRole('link', { name: 'More', exact: true }).click();
    await page.getByRole('link', { name: 'Today' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  };

  await page.clock.setFixedTime(T0);
  await page.goto('./');
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'End session' }).click();

  await at(30);
  await expect(banner).toHaveCount(0);
  await at(31);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('No backup yet');

  await banner.getByRole('link', { name: 'Back up' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await exportBackup(page);
  await at(31);
  await expect(banner).toHaveCount(0);

  await at(61);
  await expect(banner).toHaveCount(0); // 30 days after the export
  await at(62);
  await expect(banner).toContainText('Last backup 31 days ago');
  await banner.getByRole('button', { name: 'Dismiss' }).click();
  await expect(banner).toHaveCount(0);
});
