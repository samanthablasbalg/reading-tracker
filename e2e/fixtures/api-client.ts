import { test as base } from './clean-db';
import { ApiClient } from '../api/api-client';

// Extends the clean-db fixture (which truncates the DB before each test) with
// an `apiClient` for backend data setup. Specs that need to seed data import
// `test`/`expect` from here; the wipe rides along via the chain.

export const test = base.extend<{ apiClient: ApiClient }>({
  apiClient: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export { expect } from './clean-db';
