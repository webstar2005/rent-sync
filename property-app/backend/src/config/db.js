import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

// Run fn(client) inside BEGIN/COMMIT/ROLLBACK — the raw-pg equivalent of Prisma's $transaction.
// Used wherever multiple writes must commit atomically (e.g. payment insert + invoice status update).
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
