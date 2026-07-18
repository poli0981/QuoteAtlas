import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (docs/11 §3). Tests run against the **production build** served by
 * `vite preview` — that exercises the real bundle, the PWA service worker and the
 * SPA fallback, not just the dev server.
 *
 * Determinism: every test gets a fixed timezone + locale so region detection
 * (docs/03 §1) resolves the same way on every machine and in CI.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // exactOptionalPropertyTypes: omit `workers` entirely rather than pass undefined
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Deterministic boot: Asia/Bangkok + en-US means detect() resolves TH, which
    // has NO native pool, so the app takes the locale-fallback path to `en` (R4) —
    // giving specs a stable `en` pool AND a live fallback banner. (VN/JP/KR/CN now
    // ship pools, so they no longer exercise the fallback path.)
    timezoneId: 'Asia/Bangkok',
    locale: 'en-US',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
