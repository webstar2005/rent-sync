import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const backDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backDir, '.env.production'), override: false });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const idx = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'payment_requests' ORDER BY indexname`
  );
  for (const r of idx.rows) console.log('-', r.indexname, '\n   ', r.indexdef.replace(/\s+/g, ' '));
  const partial = await client.query(
    `SELECT COUNT(*)::int AS n FROM pg_indexes
      WHERE tablename = 'payment_requests' AND indexdef LIKE '%WHERE%' AND indexname LIKE '%code%'`
  );
  console.log('\npending-only code indexes remaining (want 0):', partial.rows[0].n);
  const n = await client.query('SELECT COUNT(*)::int AS n FROM payment_requests');
  console.log('payment_requests rows:', n.rows[0].n);
} finally {
  await client.end();
}
