import { defineConfig } from '@playwright/test';

// E2E suite for permission-aware UI. Requires the Vite dev server on :5173 and
// the API on :5000 (see npm run dev:server / dev:client). The spec self-provisions
// a fresh tenant via the API, so it creates no dependency on pre-seeded accounts.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  retries: 0,
  expect: {
    // Generous: first-load Vite dev compilation on this OneDrive-synced box can
    // exceed 5s; we assert against the rendered page, not timing.
    timeout: 20000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list']],
});