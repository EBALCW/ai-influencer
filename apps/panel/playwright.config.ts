import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env');

loadEnvConfig(resolve(process.cwd(), '../..'));

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // CI'da build edilmiş uygulama test edilir, yerelde dev sunucusu
    command: isCI ? 'pnpm start' : 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
