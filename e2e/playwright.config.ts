import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    // The e2e frontend runs on its own port (4201) so it never collides with a
    // dev server on 4200. See the webServer config below.
    baseURL: 'http://localhost:4201',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'db setup',
      testMatch: /db\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['db setup'],
    },
  ],
  webServer: [
    {
      // Dedicated e2e backend on :8001 (dev runs on :8000), bound to the e2e
      // database via E2E_DATABASE_URL. Because the port is isolated, there is no
      // dev server here to accidentally reuse, so the wrong-database trap can't
      // happen regardless of reuseExistingServer.
      command: 'cd ../backend && uvicorn app.main:app --host 127.0.0.1 --port 8001',
      url: 'http://127.0.0.1:8001/docs',
      reuseExistingServer: !process.env['CI'],
      env: {
        DATABASE_URL: process.env['E2E_DATABASE_URL'] ?? '',
      },
    },
    {
      // Dedicated e2e frontend on :4201 (dev runs on :4200), using the e2e proxy
      // config that points /api at the e2e backend on :8001.
      command:
        'cd ../frontend && npm start -- --port 4201 --proxy-config proxy.e2e.conf.json',
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
})
