import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/climb-log/`,
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'iphone',
      // iPhone viewport, touch and UA; Chromium engine because it is the browser available locally and in CI.
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/climb-log/`,
    reuseExistingServer: !process.env.CI,
  },
});
