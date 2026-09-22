import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  applySchema,
  resetDb,
  closeDb,
  seedLandlord,
  seedProperty,
  seedTenant,
  seedInvoice,
  app,
  pool,
} from './helpers.js';
import { parseMonth, dueDateFor, invoiceNumberFor } from '../src/services/invoiceService.js';

const GEN = '/api/invoices/generate';

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

// pg returns DATE columns as a JS Date at local midnight — format back to YYYY-MM-DD without the UTC shift.
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

describe('Invoice auto-generation', () => {
  it('bills only ACTIVE tenants on ACTIVE properties, with correct title fields', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const prop = await seedProperty(A.user.id, { name: 'A Complex' });
    const active = await seedTenant(prop.id, { name: 'Alice', phone: '0701111222', unit_number: 'AA1', monthly_rent: 12000 });
    await seedTenant(prop.id, { name: 'Away', phone: '0700000000', unit_number: 'AA2', monthly_rent: 9000, status: 'moved_out' });

    const res = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({}).expect(200);
    assert.equal(res.body.generated, 1);
    assert.equal(res.body.skipped, 0);
    assert.equal(res.body.overdue_marked, 0);
    assert.match(res.body.period, /^\d{4}-(0[1-9]|1[0-2])$/);

    const rows = await pool.query('SELECT * FROM invoices ORDER BY id');
    assert.equal(rows.rows.length, 1);
    const inv = rows.rows[0];
    const period = parseMonth();
    assert.equal(inv.tenant_id, active.id);
    assert.equal(inv.property_id, prop.id);
    assert.equal(Number(inv.amount), 12000);
    assert.equal(inv.status, 'pending');
    assert.equal(inv.invoice_number, invoiceNumberFor(active.id, period));
    assert.equal(localDateStr(inv.due_date), dueDateFor(prop.rent_due_day, period));
  });

  it('is idempotent — a second run bills nothing', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const prop = await seedProperty(A.user.id);
    await seedTenant(prop.id, { name: 'Alice', unit_number: 'AA1' });

    const first = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({}).expect(200);
    assert.equal(first.body.generated, 1);
    const second = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({}).expect(200);
    assert.equal(second.body.generated, 0);

    const rows = await pool.query('SELECT COUNT(*)::int AS n FROM invoices');
    assert.equal(rows.rows[0].n, 1);
  });

  it('does not duplicate a tenant already billed in the period (even when that invoice is paid)', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const prop = await seedProperty(A.user.id);
    const tenant = await seedTenant(prop.id, { name: 'Alice', unit_number: 'AA1' });
    const period = parseMonth();
    await seedInvoice(tenant.id, prop.id, {
      invoice_number: 'MANUAL-1',
      amount: 12000,
      status: 'paid',
      due_date: dueDateFor(prop.rent_due_day, period),
    });

    const res = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({}).expect(200);
    assert.equal(res.body.generated, 0);
    const rows = await pool.query('SELECT id, invoice_number FROM invoices');
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].invoice_number, 'MANUAL-1');
  });

  it('scopes generation to the calling owner across different orgs', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1' });

    const B = await seedLandlord({ name: 'Beatrice' });
    const propB = await seedProperty(B.user.id, { name: 'B Flats' });
    await seedTenant(propB.id, { name: 'Bob', unit_number: 'BB1' });

    const aRes = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({}).expect(200);
    assert.equal(aRes.body.generated, 1);

    const rowsAfterA = await pool.query(
      `SELECT i.tenant_id, p.owner_id FROM invoices i JOIN properties p ON p.id = i.property_id`
    );
    assert.equal(rowsAfterA.rows.length, 1);
    assert.equal(rowsAfterA.rows[0].owner_id, A.user.id);

    const bRes = await request(app).post(GEN).set('Authorization', `Bearer ${B.token}`).send({}).expect(200);
    assert.equal(bRes.body.generated, 1);
    const owners = (await pool.query(
      `SELECT DISTINCT p.owner_id FROM invoices i JOIN properties p ON p.id = i.property_id`
    )).rows.map((r) => r.owner_id).sort();
    assert.deepEqual(owners, [A.user.id, B.user.id].sort());
  });

  it('requires auth and a landlord/admin role', async () => {
    await request(app).post(GEN).send({}).expect(401);
    const tenant = await seedLandlord({ name: 'Tilly', role: 'tenant' });
    await request(app).post(GEN).set('Authorization', `Bearer ${tenant.token}`).send({}).expect(403);
  });

  it('honours an explicit month and the property due day on a short month', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const prop = (await pool.query(
      `INSERT INTO properties (owner_id, name, address, units, rent_due_day) VALUES ($1, $2, $3, 1, 28) RETURNING *`,
      [A.user.id, 'February Property', '28th Street']
    )).rows[0];
    await seedTenant(prop.id, { name: 'Alice', unit_number: 'AA1' });

    const res = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({ month: '2027-02' }).expect(200);
    assert.equal(res.body.generated, 1);
    assert.equal(res.body.period, '2027-02');

    const rows = await pool.query('SELECT * FROM invoices');
    assert.equal(rows.rows[0].invoice_number, invoiceNumberFor(rows.rows[0].tenant_id, { year: 2027, month: 2 }));
    assert.equal(localDateStr(rows.rows[0].due_date), '2027-02-28');
  });

  it('rejects a malformed month', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const res = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({ month: '2026-13' }).expect(400);
    assert.match(res.body.message, /month/i);
  });

  it('flips unpaid pending invoices past their due date to overdue, owner-scoped', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'PAST-1', due_date: '2000-01-01', status: 'pending' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'FUTURE-1', due_date: '2100-01-01', status: 'pending' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'PARTIAL-1', due_date: '2000-01-01', status: 'partial' });

    const B = await seedLandlord({ name: 'Beatrice' });
    const propB = await seedProperty(B.user.id, { name: 'B Flats' });
    const tenantB = await seedTenant(propB.id, { name: 'Bob', unit_number: 'BB1' });
    await seedInvoice(tenantB.id, propB.id, { invoice_number: 'B-PAST-1', due_date: '2000-01-01', status: 'pending' });

    const res = await request(app).post(GEN).set('Authorization', `Bearer ${A.token}`).send({}).expect(200);
    assert.equal(res.body.overdue_marked, 1);

    const own = (await pool.query("SELECT invoice_number, status FROM invoices WHERE property_id = $1", [propA.id])).rows;
    const byNumber = Object.fromEntries(own.map((r) => [r.invoice_number, r.status]));
    assert.equal(byNumber['PAST-1'], 'overdue');
    assert.equal(byNumber['FUTURE-1'], 'pending');
    assert.equal(byNumber['PARTIAL-1'], 'partial');

    const bPast = await pool.query('SELECT status FROM invoices WHERE invoice_number = $1', ['B-PAST-1']);
    assert.equal(bPast.rows[0].status, 'pending');
  });
});

describe('Invoice cron job', () => {
  it('bills active tenants across all owners and marks overdue', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1', monthly_rent: 12000 });

    const B = await seedLandlord({ name: 'Beatrice' });
    const propB = await seedProperty(B.user.id, { name: 'B Flats' });
    const tenantB = await seedTenant(propB.id, { name: 'Bob', unit_number: 'BB1', monthly_rent: 8000 });
    await seedInvoice(tenantB.id, propB.id, { invoice_number: 'BOLD-1', due_date: '2000-01-01', status: 'pending' });

    const secret = process.env.CRON_SECRET;
    const req = secret
      ? request(app).post('/api/cron/invoices').set('x-cron-secret', secret)
      : request(app).post('/api/cron/invoices');
    const res = await req.send({}).expect(200);
    assert.equal(res.body.generated, 2);
    assert.equal(res.body.overdue_marked, 1);

    const sum = (await pool.query('SELECT COUNT(*)::int AS n FROM invoices WHERE notes LIKE $1', ['Auto-generated rent for%'])).rows[0].n;
    assert.equal(sum, 2);
  });
});