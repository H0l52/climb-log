import { expect, test, type Page } from '@playwright/test';
import seed from '../src/data/seed.json' with { type: 'json' };
import { generateSynthetic, type SyntheticData } from '../src/domain/__fixtures__/synthetic';
import { formatRate, progressView, type RangeKey } from '../src/domain/progress';
import { flashSummary, pyramidSummary, scoreSummary, sendsSummary, styleSummary } from '../src/domain/progressText';
import type { GradeBand, Wall } from '../src/db/types';

const bands = [...seed.gradeBands].sort((a, b) => a.order - b.order) as GradeBand[];
const names = Object.fromEntries(bands.map((b) => [b.id, b.name]));
const gyms = [...seed.gyms].sort((a, b) => a.name.localeCompare(b.name));
const boulderWalls = seed.walls.filter((w) => w.kind === 'boulder');
const firstWall = boulderWalls.filter((w) => w.gymId === gyms[0]!.id).map((w) => w.name).sort((a, b) => a.localeCompare(b))[0]!;

const melbourneToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Replace the app's sets and history with synthetic rows, straight into IndexedDB, then reload. */
async function loadSynthetic(page: Page, data: SyntheticData) {
  await page.evaluate(async (rows) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('climb-log');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['wallSets', 'problems', 'attempts', 'sessions'], 'readwrite');
      tx.objectStore('wallSets').clear();
      for (const [store, list] of Object.entries(rows)) for (const row of list as object[]) tx.objectStore(store).put(row);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { wallSets: data.wallSets, problems: data.problems, attempts: data.attempts, sessions: data.sessions });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

const synthetic = () =>
  generateSynthetic({ now: Date.now(), bandIds: bands.map((b) => b.id), walls: boulderWalls.map((w) => ({ id: w.id, gymId: w.gymId })) });

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
const tile = (page: Page, label: RegExp | string) => page.getByTestId('tiles').getByRole('group', { name: label }).getByTestId('value');
const summary = (page: Page, title: string) => page.getByRole('figure', { name: title }).locator('figcaption');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('Progress renders in under 1 second with two years of data', async ({ page }) => {
  const data = synthetic();
  expect(data.attempts.length).toBeGreaterThan(2700);
  await loadSynthetic(page, data);

  const t0 = Date.now();
  await tab(page, 'Progress').click();
  await expect(summary(page, 'Session score')).toBeVisible();
  await expect(tile(page, 'Week streak')).toBeVisible();
  const ms = Date.now() - t0;
  console.log(`Progress rendered ${data.attempts.length} entries in ${ms} ms`);
  expect(ms).toBeLessThan(1000);

  // Switching range re-renders within the budget too.
  const t1 = Date.now();
  await page.getByRole('group', { name: 'Range' }).getByRole('button', { name: 'All' }).click();
  await expect(summary(page, 'Sends per colour')).toContainText('in all');
  expect(Date.now() - t1).toBeLessThan(1000);
});

test('gym and range filters change every tile and chart consistently', async ({ page }) => {
  const data = synthetic();
  await loadSynthetic(page, data);
  await tab(page, 'Progress').click();
  const input = { ...data, bands, walls: seed.walls as unknown as Wall[] };
  const today = melbourneToday();
  const seen = new Set<string>();

  for (const gym of [null, ...gyms]) {
    await page.getByRole('group', { name: 'Gym filter' }).getByRole('button', { name: gym?.name ?? 'All gyms', exact: true }).click();
    for (const [range, label] of [['6w', '6 weeks'], ['year', 'Year'], ['all', 'All']] as [RangeKey, string][]) {
      await page.getByRole('group', { name: 'Range' }).getByRole('button', { name: label, exact: true }).click();
      const v = progressView(input, { gymId: gym?.id ?? null, range, today });
      const expected = {
        working: v.tiles.workingGrade ? names[v.tiles.workingGrade]! : '–',
        sends: String(v.tiles.sends),
        flash: formatRate(v.tiles.flashRate),
        streak: String(v.tiles.streak),
        sendsChart: sendsSummary(v, range),
        pyramid: pyramidSummary(v, names),
        flashChart: flashSummary(v, names, range),
        style: styleSummary(v),
        score: scoreSummary(v, range),
      };
      await expect(tile(page, 'Working grade')).toHaveText(expected.working);
      await expect(tile(page, /^Sends/)).toHaveText(expected.sends);
      await expect(tile(page, 'Flash rate')).toHaveText(expected.flash);
      await expect(tile(page, 'Week streak')).toHaveText(expected.streak);
      await expect(summary(page, 'Sends per colour')).toHaveText(expected.sendsChart);
      await expect(summary(page, 'Grade pyramid')).toHaveText(expected.pyramid);
      await expect(summary(page, 'Flash rate')).toHaveText(expected.flashChart);
      await expect(summary(page, 'Style')).toHaveText(expected.style);
      await expect(summary(page, 'Session score')).toHaveText(expected.score);
      await expect(page.getByRole('group', { name: 'Sends by period' }).getByRole('button')).toHaveCount(v.buckets.length);
      seen.add(JSON.stringify(expected));
    }
  }
  // The filters really changed what is shown (not the same numbers every time).
  expect(seen.size).toBeGreaterThan(6);
  await expect(page.locator('body')).not.toContainText(/NaN|Infinity/);
});

test('charts fit the screen at 390 and 320 px', async ({ page }) => {
  await loadSynthetic(page, synthetic());
  await tab(page, 'Progress').click();
  await expect(summary(page, 'Session score')).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Tapping a bar shows its values in the readout below the chart.
    const bars = page.getByRole('group', { name: 'Sends by period' }).getByRole('button');
    await bars.first().click();
    await expect(bars.first()).toHaveAttribute('aria-pressed', 'true');
  }
});

test('an undefined flash rate shows "–", never 0% or NaN', async ({ page }) => {
  await page.getByRole('link', { name: 'Log climb' }).click();
  await page.getByRole('group', { name: /^Wall/ }).getByRole('button', { name: firstWall, exact: true }).click();
  await page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: bands[0]!.name, exact: true }).click();
  await page.getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Not yet', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  await tab(page, 'Progress').click();
  await expect(tile(page, 'Flash rate')).toHaveText('–');
  await expect(tile(page, /^Sends/)).toHaveText('0');
  await expect(tile(page, 'Working grade')).toHaveText('–');
  await expect(page.locator('body')).not.toContainText(/NaN|Infinity|0%/);
});

test('empty Progress offers to log a climb', async ({ page }) => {
  await tab(page, 'Progress').click();
  await expect(page.getByText('No climbs logged yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log a climb' })).toBeVisible();
});

test('a first-send goal completes when the send is logged; achievements and streak follow', async ({ page }) => {
  const band = bands[2]!;
  await tab(page, 'Goals').click();
  await expect(page.getByText('No goals yet. Add one to track it here.')).toBeVisible();
  await page.getByRole('button', { name: 'New goal' }).click();
  const form = page.getByRole('form', { name: 'New goal' });
  await form.getByRole('group', { name: 'Goal type' }).getByRole('button', { name: 'First send' }).click();
  await form.getByRole('group', { name: 'Colour' }).getByRole('button', { name: band.name, exact: true }).click();
  await form.getByRole('button', { name: 'Add goal' }).click();
  const active = page.getByRole('list', { name: 'Active goals' });
  await expect(active).toContainText(`First ${band.name} send`);
  await expect(active).toContainText('Not yet');

  await tab(page, 'Today').click();
  await page.getByRole('link', { name: 'Log climb' }).click();
  await page.getByRole('group', { name: /^Wall/ }).getByRole('button', { name: firstWall, exact: true }).click();
  await page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: band.name, exact: true }).click();
  await page.getByRole('group', { name: 'Result' }).getByRole('button', { name: 'Flash', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1 week streak');

  await tab(page, 'Goals').click();
  await expect(page.getByRole('list', { name: 'Achieved goals' })).toContainText(`First ${band.name} send`);
  await expect(page.getByRole('list', { name: 'Active goals' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Achievements' })).toContainText('First send · flash');
  await expect(page.getByRole('group', { name: 'Week streak' }).getByTestId('value')).toHaveText('1');
});
