import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'guest', testMatch: /guest\.spec\.ts/ },
    {
      name: 'owner',
      testMatch: /app\.spec\.ts/,
      use: { storageState: 'e2e/.auth/owner.json' },
    },
    {
      // Ayrı oturum: app.spec'teki çıkış testi owner oturumunu iptal eder
      name: 'editor',
      testMatch: /(?:persona|content)\.spec\.ts/,
      use: { storageState: 'e2e/.auth/editor.json' },
    },
    {
      name: 'viewer',
      testMatch: /viewer\.spec\.ts/,
      use: { storageState: 'e2e/.auth/viewer.json' },
    },
  ],
  webServer: {
    // CI'da build edilmiş uygulama test edilir, yerelde dev sunucusu
    command: isCI ? 'pnpm start' : 'pnpm dev',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
