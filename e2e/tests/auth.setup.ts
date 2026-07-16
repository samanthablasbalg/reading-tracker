import { test as setup } from '@playwright/test';
import { BACKEND_URL } from '../api/api-client';
import { AUTH_FILE } from '../auth-file';

// Runs once before the browser projects (see playwright.config.ts's `auth setup`
// project). The e2e suite is single-user (clean-db.ts's truncate leaves the
// `users` row alone), so one login for the whole run is enough.
setup('log in as the e2e test user', async ({ request }) => {
  // Through the frontend's proxy (baseURL, from playwright.config.ts), so the
  // cookie is recorded under the origin `page` navigations use.
  await request.post('/api/auth/test-login');

  // Direct to the backend — the origin ApiClient calls, bypassing the proxy —
  // so it needs its own copy of the cookie under that origin.
  await request.post(`${BACKEND_URL}/api/auth/test-login`);

  await request.storageState({ path: AUTH_FILE });
});
