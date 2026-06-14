import { test as base } from '@playwright/test';
import { Client } from 'pg';

const dbUrl = process.env['E2E_DATABASE_URL'];
if (!dbUrl) throw new Error('E2E_DATABASE_URL is not set');

export const test = base.extend<{ cleanDb: void }>({
  cleanDb: [
    async ({}, use) => {
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      await client.query(
        'TRUNCATE books, authors, book_sources, blog_posts, standalone_entries RESTART IDENTITY CASCADE',
      );
      await client.end();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
