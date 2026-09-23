// One-shot schema/migration runner for a fresh production database (e.g. Neon).
//
// Usage:
//   1. Put the Neon DIRECT connection string in backend/.env.production:
//        DATABASE_URL=postgresql://user:pass@ep-xxx-db.neon.tech/neondb?sslmode=require
//      (.env.production is gitignored — never commit the URL.)
//   2. From property-app/backend:
//        node scripts/apply-migrations.js
//
// Mirrors the test bootstrap (test/helpers.js applySchema): on a fresh database run
// schema.sql FIRST (its triggers are not idempotent), then every migration in sort order
// (all migrations are written to be re-runnable). Refuses to run if DATABASE_URL is
// missing or still a placeholder. Never runs seed.sql — that is dev sample data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backDir, '.env.production'), override: false });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || dbUrl.includes('__SET_VIA_SECRET_MANAGER__') || !dbUrl.startsWith('postgresql://')) {
  console.error('[apply-migrations] Set DATABASE_URL to the Neon direct connection string in backend/.env.production (gitignored), then re-run.');
  process.exit(1);
}

const databaseDir = (...parts) => path.join(backDir, 'database', ...parts);

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

try {
  const exists = await client.query(`SELECT to_regclass('public.users') IS NOT NULL AS e`);
  const files = [];
  if (!exists.rows[0].e) {
    files.push(databaseDir('schema.sql'));
  }
  files.push(
    ...fs
      .readdirSync(databaseDir('migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => databaseDir('migrations', f))
  );

  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
    console.log(`applied ${path.basename(file)}`);
  }
  console.log('Schema + migrations applied successfully.');
} finally {
  await client.end();
}