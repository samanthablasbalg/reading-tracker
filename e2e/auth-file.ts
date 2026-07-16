import path from 'path';

// Shared by tests/auth.setup.ts (writes it) and playwright.config.ts (reads it
// into each browser project's storageState), so the two never drift apart.
export const AUTH_FILE = path.resolve(__dirname, '.auth/user.json');
