import { defineConfig, devices } from '@playwright/test';

const port = 4173;

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
  webServer: {
    command: `npm run build:web && npm run preview:web -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
