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
      // Exclude anonymous-only specs (which assume NO session) and the
      // _stubs quarantine folder. Anonymous specs are:
      //   - login.spec.ts (tests the login flow itself)
      //   - middleware-redirect.spec.ts (tests the unauthenticated redirect branch)
      testIgnore: [
        /login.*\.spec\.ts/,
        /middleware-redirect.*\.spec\.ts/,
        /_stubs/,
      ],
    },
    // Employee tests — uses trainer auth state
    {
      name: 'employee',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/employee.json',
      },
      dependencies: ['auth-setup'],
      testMatch: /employee.*\.spec\.ts/,
      testIgnore: [/_stubs/],
    },
    // Anonymous tests — no storage state, no auth dependency.
    // Used by login.spec.ts, middleware-redirect.spec.ts, and any other flow
    // that must start unauthenticated.
    // Auth test users are seeded once via the `auth-setup` project (run manually if needed);
    // this project does NOT depend on it because it should not re-run setup on every invocation.
    {
      name: 'anonymous',
      use: {
        ...devices['Desktop Chrome'],
        // NOTE: No storageState. Each test starts with a fresh browser context.
      },
      // Add new anonymous-project specs to this array as they're created.
      // Explicit list keeps admin/employee specs from leaking into this project.
      testMatch: [/login.*\.spec\.ts/, /middleware-redirect.*\.spec\.ts/],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
