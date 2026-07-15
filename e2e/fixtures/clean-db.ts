import { test as base } from '@playwright/test';
import { Client } from 'pg';

// Base of the fixtures chain. Every spec imports `test`/`expect` from a fixture
// in this dir (never from @playwright/test directly); this one wipes the e2e
// database and reseeds a baseline user before each test, so tests never see each
// other's data and the backend's get_current_user placeholder (standing in for
// real auth until #121) always finds exactly one row to return. Scenario
// fixtures (e.g. a "five books in the library" one) extend this to inherit both.

const dbUrl = process.env['E2E_DATABASE_URL'];
if (!dbUrl) throw new Error('E2E_DATABASE_URL is not set');

export const test = base.extend<{ cleanDb: void }>({
  // `auto: true` means this runs for every test without the test having to ask for it.
  cleanDb: [
    async ({}, use) => {
      // A direct Postgres connection, separate from the app's — used only to reset data.
      const client = new Client({ connectionString: dbUrl });
      await client.connect();

      // Ask Postgres which tables exist instead of hand-maintaining a list, so new
      // tables get wiped automatically. `pg_tables` is a built-in catalog; `public`
      // is the schema our app's tables live in. Skip `alembic_version` — it records
      // which migrations have run, so wiping it would make the DB look un-migrated.
      const { rows } = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename <> 'alembic_version'`,
      );

      // Quote each name (guards against casing/reserved words) and empty them all in
      // one statement. RESTART IDENTITY resets auto-increment id counters back to 1;
      // CASCADE also truncates any table with a foreign key into these, so we don't
      // hit FK errors or have to worry about delete order.
      const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
      if (tables) {
        await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
      }

      await client.query(
        `INSERT INTO users (id, email, created_at, updated_at)
         VALUES (gen_random_uuid(), 'test-user@example.com', now(), now())`,
      );

      await client.end();
      await use(); // hand control to the test, now against a freshly seeded database
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
