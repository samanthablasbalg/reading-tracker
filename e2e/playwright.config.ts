import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'
import { AUTH_FILE } from './auth-file'

dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],
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
      // Logs in once via the env-gated /auth/test-login bypass and saves the
      // session to AUTH_FILE; the projects below load it as storageState so
      // every page/request starts already authenticated.
      name: 'auth setup',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['db setup'],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['db setup', 'auth setup'],
      testIgnore: /seed\.spec\.ts/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: AUTH_FILE },
      dependencies: ['db setup', 'auth setup'],
      testIgnore: /seed\.spec\.ts/,
    },
    {
      // The only project that exercises the small-screen path: at ≤599px the
      // progress log opens as a bottom sheet instead of a dialog. Pixel 7
      // (412px wide, touch) trips that breakpoint. (Firefox can't do mobile
      // device emulation, so the mobile project is Chromium-engine.)
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: AUTH_FILE },
      dependencies: ['db setup', 'auth setup'],
      testIgnore: /seed\.spec\.ts/,
    },
    // Authoring seed for the playwright-new-test skill: a single paused
    // session to drive with playwright-cli under --debug=cli. timeout: 0 so
    // the pause never expires — never run in CI, only interactively.
    ...(process.env['CI']
      ? []
      : [
          {
            name: 'seed',
            testMatch: /seed\.spec\.ts/,
            timeout: 0,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['db setup'],
          },
        ]),
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
        // The app connects via APP_DATABASE_URL (RLS-restricted role in prod).
        // e2e is single-user, so RLS filtering changes nothing observable here;
        // we reuse the e2e database URL directly and let the backend test suite
        // be the place RLS is exercised as the restricted role.
        DATABASE_URL: process.env['E2E_DATABASE_URL'] ?? '',
        APP_DATABASE_URL: process.env['E2E_DATABASE_URL'] ?? '',
        SESSION_SECRET: process.env['SESSION_SECRET'] ?? '',
        // Enables POST /auth/test-login, the Google-bypass the auth setup
        // project uses (defaults to the "e2e" persona). Scoped to this
        // dedicated :8001 process — local dev (:8000) sets this too, to let
        // scripts/seed_dev.py authenticate as the "dev" persona, but the
        // pytest suite never does.
        ALLOW_TEST_LOGIN: 'true',
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
