import { test } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test('seed', async ({ page }) => {
  execSync('python scripts/seed_dev.py', {
    cwd: path.resolve(__dirname, '../../backend'),
    env: {
      ...process.env,
      DATABASE_URL: process.env['E2E_DATABASE_URL'] ?? '',
      BASE_URL: 'http://127.0.0.1:8001',
    },
    stdio: 'inherit',
  });

  await page.goto('/');
  await page.pause();
});
