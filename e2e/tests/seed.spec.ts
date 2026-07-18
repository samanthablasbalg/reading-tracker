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

  // Logs the browser in as the same "dev" persona seed_dev.py just seeded
  // data for, so the paused session actually shows the seeded books instead
  // of the guest landing page.
  await page.request.post('/api/auth/test-login', { data: { persona: 'dev' } });

  await page.goto('/');
  await page.pause();
});
