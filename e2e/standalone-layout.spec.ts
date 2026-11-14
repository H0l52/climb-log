import { expect, test } from '@playwright/test';

// Simulates the iOS home-screen launch bug: the app's viewport starts shorter than the screen
// (here by a 47 px status bar) and is never corrected on screens too short to scroll.
const SCREEN = { width: 390, height: 844 };
const SHORT = { width: 390, height: 844 - 47 };

/** Report the real screen size; Playwright's screen otherwise follows the viewport. */
async function fakeScreen(page: import('@playwright/test').Page, standalone: boolean) {
  await page.addInitScript(
    ({ w, h, standalone }) => {
      Object.defineProperty(Screen.prototype, 'width', { get: () => w });
      Object.defineProperty(Screen.prototype, 'height', { get: () => h });
      if (standalone) Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true });
    },
    { w: SCREEN.width, h: SCREEN.height, standalone },
  );
}

async function tabBarBottom(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: 'Main' }).evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
}

test.describe('installed app with a short launch viewport', () => {
  test.use({ viewport: SHORT });

  test.beforeEach(async ({ page }) => {
    await fakeScreen(page, true);
  });

  for (const [hash, heading] of [['#/', 'Today'], ['#/walls', 'Walls'], ['#/settings', 'Settings']] as const) {
    test(`tab bar sits on the bottom screen edge on ${heading}`, async ({ page }) => {
      await page.goto(`./${hash}`);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-standalone', '');
      expect(await tabBarBottom(page)).toBe(SCREEN.height);
    });
  }
});

test.describe('browser tab', () => {
  test.use({ viewport: SHORT });

  test('tab bar stays on the window bottom edge', async ({ page }) => {
    await fakeScreen(page, false);
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-standalone', '');
    expect(await tabBarBottom(page)).toBe(SHORT.height);
  });
});
