import { test as setup } from '@playwright/test';
import { Client } from 'pg';
import { execSync } from 'child_process';
import path from 'path';

const dbUrl = process.env['E2E_DATABASE_URL'];
if (!dbUrl) throw new Error('E2E_DATABASE_URL is not set');

setup('provision e2e database', async () => {
  const adminUrl = dbUrl.replace(/\/[^/]+$/, '/postgres');
  const dbName = dbUrl.split('/').pop()!;

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const { rowCount } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName],
  );
  if (!rowCount) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();

  const backendDir = path.resolve(__dirname, '../../backend');
  execSync('python -m alembic upgrade head', {
    cwd: backendDir,
    // app/database.py requires APP_DATABASE_URL at import time, and alembic's
    // env.py imports it for Base — even though migrations use DATABASE_URL. The
    // e2e app is single-user, so point both at the same database.
    env: { ...process.env, DATABASE_URL: dbUrl, APP_DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
});
