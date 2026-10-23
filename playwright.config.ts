import { defineConfig, devices } from '@playwright/test';

const port = 4173;
// e2e/web/seo.spec.ts requests this Worker directly.
const workerPort = 8788;

// Web counterpart of the Detox tests: runs the production build with
// react-native-web in Chromium.
export default defineConfig({
  testDir: 'e2e/web',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'artifacts/playwright',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Playwright starts these in order, so the Worker serves the finished build.
  webServer: [
    {
      command: `bun run build:web && bun run preview:web --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The deployed Worker's asset handling (wrangler.jsonc), run locally,
      // for behavior Vite's preview doesn't share, such as the 404 page.
      command: `bunx wrangler dev --ip 127.0.0.1 --port ${workerPort} --show-interactive-dev-session=false`,
      url: `http://127.0.0.1:${workerPort}`,
      reuseExistingServer: !process.env.CI,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
});
