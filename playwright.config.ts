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
    process.env.TESTRELIC_API_KEY
      ? ['@testrelic/playwright-analytics', {
          apiKey: process.env.TESTRELIC_API_KEY,
          projectName: 'fde-assignment-smart-reporter',
          environment: process.env.CI ? 'ci' : 'local',
          ci: {
            provider: 'github',
            repository: process.env.GITHUB_REPOSITORY,
            runId: process.env.GITHUB_RUN_ID,
            runUrl: process.env.GITHUB_RUN_URL,
          }
        }]
      : ['null'],
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
