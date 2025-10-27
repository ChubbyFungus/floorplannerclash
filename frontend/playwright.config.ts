import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'html',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    video: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'npm run --prefix ../backend dev:e2e',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: !isCI,
      timeout: 180_000
    },
    {
      command: 'npm run dev:e2e',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !isCI,
      timeout: 180_000
    }
  ]
})
