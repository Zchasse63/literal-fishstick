import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },

  projects: [
    // Auth setup — creates session state for admin and employee users
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Admin tests — uses owner auth state
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
    },
    // Employee tests — uses trainer auth state
    {
      name: 'employee',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/employee.json',
      },
      dependencies: ['auth-setup'],
      testMatch: /employee/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
