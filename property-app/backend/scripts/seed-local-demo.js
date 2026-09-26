// Restores local demo data for a scratch development database.
//
//   node scripts/seed-local-demo.js          # create the demo rows
//   node scripts/seed-local-demo.js --reset  # delete them again, leaving the account intact
//
// Why this exists instead of database/seed.sql: seed.sql hardcodes ids (owner_id 2, property_id 1)
// and its sample data is stale for this product — Ghanaian cities, `Accra`, and monthly rents in
// whole dollars. It only applies to a freshly created, empty database. On a working dev database
// those literal ids point at unrelated rows.
//
// Everything here resolves ids from lookups and never hardcodes one, and every row it creates is
// tagged with the demo marker below so `--reset` can find exactly its own rows and nothing else.
// That is deliberate: a cleanup that matches on a human-readable name is how you delete a
// landlord's real property because it happened to share a name with the sample data.
//
// Refuses to run against a database whose name ends in _test (that is the test suite's scratch
// space) and never touches the users table beyond reading the demo owner.

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
void __dirname;

const DEMO_EMAIL = 'admin@example.com';
// Every seeded row carries this so --reset can identify its own writes precisely.
const DEMO_TAG = 'seeded by seed-local-demo.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy backend/.env and fill it in.');
  process.exit(1);
}

const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
if (/_test$/i.test(dbName)) {
  console.error(`Refusing to seed "${dbName}": that is the test suite's scratch database.`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function reset(client) {
  // Children first so the intent is readable even though the FKs cascade anyway. Each delete is
  // scoped by the marker this script wrote, never by a name the user could have typed.
  let removed = 0;
  for (const [sql, params] of [
    ['DELETE FROM payments WHERE reference = $1', [DEMO_TAG]],
    ['DELETE FROM invoices WHERE notes = $1', [DEMO_TAG]],
    ['DELETE FROM tenants WHERE email LIKE $1', ['%@demo.rentsync.test']],
    ['DELETE FROM properties WHERE address = $1', [DEMO_TAG]],
  ]) {
    const { rowCount } = await client.query(sql, params);
    removed += rowCount;
  }
  return removed;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const removed = await reset(client);
    if (process.argv.includes('--reset')) {
      await client.query('COMMIT');
      console.log(`Removed ${removed} demo row(s). Accounts were left alone.`);
      return;
    }

    const owner = await client.query('SELECT id, email FROM users WHERE email = $1', [DEMO_EMAIL]);
    if (owner.rowCount === 0) {
      await client.query('ROLLBACK');
      console.error(
        `No account with email ${DEMO_EMAIL} exists. Register it in the app first, then re-run ` +
          'this script (or pass a different email).'
      );
      process.exitCode = 1;
      return;
    }
    const ownerId = owner.rows[0].id;

    const properties = [];
    for (const [name, units] of [
      ['Sunset Apartments', 8],
      ['Oak Terrace', 5],
    ]) {
      const { rows } = await client.query(
        `INSERT INTO properties (owner_id, name, address, city, units, rent_due_day, status)
         VALUES ($1, $2, $3, 'Nairobi', $4, 1, 'active') RETURNING id, name`,
        [ownerId, name, DEMO_TAG, units]
      );
      properties.push(rows[0]);
    }

    const tenants = [];
    const tenantSpec = [
      [properties[0].id, 'Ama Boateng', 'A1', 45000, 'active'],
      [properties[1].id, 'Kwame Addo', 'B2', 32000, 'active'],
    ];
    for (const [propertyId, name, unit, rent, status] of tenantSpec) {
      const { rows } = await client.query(
        `INSERT INTO tenants (property_id, name, email, phone, unit_number, monthly_rent, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name`,
        [propertyId, name, `ama@demo.rentsync.test`, '0712345678', unit, rent, status]
      );
      tenants.push(rows[0]);
    }

    // One unpaid current invoice, one paid in full, so the dashboard shows both arrears and
    // collection rate on first load instead of a wall of zeroes.
    const invoices = [];
    for (const [index, tenant, amount, status] of [
      [0, tenants[0], 45000, 'pending'],
      [1, tenants[1], 32000, 'paid'],
    ]) {
      const { rows } = await client.query(
        `INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, status, notes)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6) RETURNING id, status`,
        [tenant.id, index === 0 ? properties[0].id : properties[1].id, `INV-DEMO-${index + 1}`, amount, status, DEMO_TAG]
      );
      invoices.push(rows[0]);
    }

    await client.query(
      `INSERT INTO payments (invoice_id, tenant_id, amount, payment_method, reference, status)
       VALUES ($1, $2, 15000, 'mobile_money', $3, 'completed'),
              ($1, $2, 17000, 'mobile_money', $3, 'completed')`,
      [invoices[1].id, tenants[1].id, DEMO_TAG]
    );

    await client.query('COMMIT');
    console.log(
      `Seeded demo data for ${DEMO_EMAIL}: ${properties.length} properties, ${tenants.length} tenants, ` +
        `${invoices.length} invoices, 2 payments.\n` +
        'Undo with: node scripts/seed-local-demo.js --reset'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, nothing was written:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
