import { expect, type Page } from '@playwright/test';

// Navigate by tapping, as the owner does. A page.goto that only changes the hash can race the app's own
// hash change right after a save.

export async function openLog(page: Page) {
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await page.getByRole('link', { name: 'Log climb' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Log climb' })).toBeVisible();
}

export async function openSettings(page: Page) {
  await page.getByRole('link', { name: 'More', exact: true }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
}
