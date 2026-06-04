import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit-report.xml' }],
    ['list'],
    ['@testrelic/playwright-analytics/reporter', {
      cloud: {
        apiKey: 'tr_live_54edd70fdf55ceed2c5763a47befcaa01d8b3a37a2adf4c52315fa9960c7e40a',
        upload: 'realtime',
        uploadArtifacts: true,
      },
    }],
  ],
  outputDir: 'test-results/',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npx serve tests/fixtures/demo-app -p 3456',
    url: 'http://localhost:3456',
    reuseExistingServer: !process.env.CI,
  },
});
