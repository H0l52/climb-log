import { expect, test, type Page } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };
import { openLog, openSettings } from './nav';
import { makeTestImages, storedPhotos } from './testImages';

const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order).map((b) => b.name);

async function logWithPhoto(page: Page, image: Buffer, band: string, name: string) {
  await openLog(page);
  await page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: band, exact: true }).click();
  await page.getByText('More detail').click();
  await page.getByLabel('Choose photo').setInputFiles({ name, mimeType: 'image/jpeg', buffer: image });
  await expect(page.getByRole('img', { name: 'Photo to save' })).toBeVisible();
  await page.getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Not yet' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

test('10 camera-size photos store at ≤ 300 KB on average with thumbnails ≤ 15 KB', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const images = await makeTestImages(page, 10);
  const originals = images.map((b) => b.length);
  for (const [i, img] of images.entries()) await logWithPhoto(page, img, bands[i % bands.length]!, `IMG_${1000 + i}.jpg`);

  const photos = await storedPhotos(page);
  expect(photos).toHaveLength(10);
  const avg = photos.reduce((s, p) => s + p.blob, 0) / photos.length;
  const avgThumb = photos.reduce((s, p) => s + p.thumb, 0) / photos.length;
  test.info().annotations.push({
    type: 'sizes',
    description: `originals avg ${Math.round(originals.reduce((a, b) => a + b, 0) / originals.length / 1024)} KB; stored avg ${Math.round(avg / 1024)} KB (max ${Math.round(Math.max(...photos.map((p) => p.blob)) / 1024)} KB); thumbs avg ${Math.round(avgThumb / 1024)} KB (max ${Math.round(Math.max(...photos.map((p) => p.thumb)) / 1024)} KB)`,
  });
  console.log(test.info().annotations.at(-1)?.description);
  expect(avg).toBeLessThanOrEqual(300 * 1024);
  for (const p of photos) {
    expect(p.thumb).toBeLessThanOrEqual(15 * 1024);
    expect(p.type).toBe('image/jpeg');
    expect(Math.max(p.width, p.height)).toBe(1280);
    expect(Math.max(p.thumbWidth, p.thumbHeight)).toBe(160);
  }
  // Portrait stays portrait.
  expect(photos.some((p) => p.height > p.width)).toBe(true);
});

test('thumbnails show in project and problem lists and open full size on tap', async ({ page }) => {
  await page.goto('./');
  const [img] = await makeTestImages(page, 1, { width: 2000, height: 1500 });
  await logWithPhoto(page, img!, bands[2]!, 'wall.jpg');

  // Project list on Log climb.
  await openLog(page);
  const thumb = page.getByRole('button', { name: new RegExp(`^Show photo: ${bands[2]}`) });
  await expect(thumb).toBeVisible();
  await expect(thumb.locator('img')).toHaveJSProperty('complete', true);
  await thumb.click();
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByRole('img')).toBeVisible();
  expect(await viewer.getByRole('img').evaluate((el: HTMLImageElement) => Math.max(el.naturalWidth, el.naturalHeight))).toBe(1280);
  await viewer.getByRole('button', { name: 'Close' }).click();
  await expect(viewer).toHaveCount(0);

  // Problem list on the wall's detail screen.
  await page.getByRole('link', { name: 'Walls' }).click();
  await page.locator('.wall-row').first().click();
  await page.getByRole('list', { name: 'Current set' }).getByRole('button', { name: /^Show photo/ }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Settings counts it.
  await openSettings(page);
  await expect(page.getByTestId('photo-usage')).toHaveText(/^1 · \d+ KB$/);
});
