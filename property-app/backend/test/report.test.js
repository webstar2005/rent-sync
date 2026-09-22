import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  applySchema,
  resetDb,
  seedLandlord,
  seedProperty,
  seedTenant,
  seedInvoice,
  seedPayment,
  app,
} from './helpers.js';

// "Last month" relative to now — the collection-rate window's most recent period.
function lastMonthLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

describe('Reports — arrears', () => {
  it('summarises invoiced / paid / outstanding per active property', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1', monthly_rent: 12000 });
    const invPaid = await seedInvoice(tenantA.id, propA.id, { invoice_number: 'A-1', amount: 12000, status: 'paid' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'A-2', amount: 12000, status: 'overdue' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'A-3', amount: 5000, status: 'cancelled' });
    await seedPayment(A.user.id, tenantA.id, invPaid.id, { amount: 12000, transaction_ref: 'TX-1' });

    const propB = await seedProperty(A.user.id, { name: 'B Flats' });
    const tenantB = await seedTenant(propB.id, { name: 'Bob', unit_number: 'BB1' });
    await seedInvoice(tenantB.id, propB.id, { invoice_number: 'B-1', amount: 8000, status: 'partial' });
    await seedPayment(A.user.id, tenantB.id, null, { amount: 3000, reference: 'REF-B', matched: false });

    const res = await request(app).get('/api/reports/arrears').set('Authorization', `Bearer ${A.token}`).expect(200);
    const rows = res.body;
    assert.equal(rows.length, 2);

    const byName = Object.fromEntries(rows.map((r) => [r.property_name, r]));
    assert.equal(Number(byName['A Complex'].total_invoiced), 24000);
    assert.equal(Number(byName['A Complex'].total_paid), 12000);
    assert.equal(Number(byName['A Complex'].outstanding), 12000);
    assert.equal(byName['A Complex'].overdue_count, 1);
    assert.equal(byName['A Complex'].pending_count, 0);

    assert.equal(Number(byName['B Flats'].total_invoiced), 8000);
    assert.equal(Number(byName['B Flats'].total_paid), 0);
    assert.equal(byName['B Flats'].overdue_count, 0);
  });

  it('scopes to the calling owner and supports ?property_id', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'A-1', amount: 12000, status: 'overdue' });
    await seedProperty(A.user.id, { name: 'B Flats' });

    const B = await seedLandlord({ name: 'Beatrice' });
    const propB = await seedProperty(B.user.id, { name: 'B Flats' });
    const tenantB = await seedTenant(propB.id, { name: 'Bob', unit_number: 'BB1' });
    await seedInvoice(tenantB.id, propB.id, { invoice_number: 'B-1', amount: 90000, status: 'overdue' });

    const all = await request(app).get('/api/reports/arrears').set('Authorization', `Bearer ${A.token}`).expect(200);
    assert.equal(all.body.length, 2);

    const scoped = await request(app)
      .get(`/api/reports/arrears?property_id=${propA.id}`)
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);
    assert.equal(scoped.body.length, 1);
    assert.equal(scoped.body[0].property_id, propA.id);
    assert.notEqual(propA.id, propB.id);
  });

  it('exposes CSV via ?format=csv', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1' });
    await seedInvoice(tenantA.id, propA.id, { invoice_number: 'A-1', amount: 12000, status: 'overdue' });

    const res = await request(app)
      .get('/api/reports/arrears?format=csv')
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text, /^property_id,property_name,/);
    assert.match(res.text, /A Complex/);
  });

  it('requires auth and a landlord/admin role', async () => {
    await request(app).get('/api/reports/arrears').expect(401);
    const tenant = await seedLandlord({ name: 'Tilly', role: 'tenant' });
    await request(app).get('/api/reports/arrears').set('Authorization', `Bearer ${tenant.token}`).expect(403);
  });
});

describe('Reports — collection rate', () => {
  it('computes invoiced vs collected percentage per month', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1', monthly_rent: 10000 });

    // Seed into the last-month window of the 12-month series.
    const inv = await seedInvoice(tenantA.id, propA.id, { invoice_number: 'LATEST-1', amount: 10000, due_date: new Date().toISOString().slice(0, 10) });
    await seedPayment(A.user.id, tenantA.id, inv.id, { amount: 2500, transaction_ref: 'TX-LATEST', paid_at: new Date() });

    const res = await request(app).get('/api/reports/collection-rate').set('Authorization', `Bearer ${A.token}`).expect(200);
    const rows = res.body;
    assert.equal(rows.length, 12);

    const label = lastMonthLabel();
    const latest = rows.find((r) => r.month === label);
    assert.ok(latest, `expected a row for ${label}`);
    assert.equal(Number(latest.invoiced), 10000);
    assert.equal(Number(latest.collected), 2500);
    assert.equal(Number(latest.collection_rate_pct), 25);

    // Older same-landlord periods outside the window do not leak in.
    const other = rows.find((r) => Number(r.invoiced) > 0 && r.month !== label);
    assert.equal(other, undefined);
  });

  it('scopes collection to the calling owner only', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1' });
    const inv = await seedInvoice(tenantA.id, propA.id, { invoice_number: 'A-LATEST', amount: 9000, due_date: new Date().toISOString().slice(0, 10) });
    await seedPayment(A.user.id, tenantA.id, inv.id, { amount: 9000, transaction_ref: 'TX-A' });

    const B = await seedLandlord({ name: 'Beatrice' });
    const propB = await seedProperty(B.user.id, { name: 'B Flats' });
    const tenantB = await seedTenant(propB.id, { name: 'Bob', unit_number: 'BB1' });
    const invB = await seedInvoice(tenantB.id, propB.id, { invoice_number: 'B-LATEST', amount: 90000, due_date: new Date().toISOString().slice(0, 10) });
    await seedPayment(B.user.id, tenantB.id, invB.id, { amount: 90000, transaction_ref: 'TX-B' });

    const label = lastMonthLabel();
    const res = await request(app).get('/api/reports/collection-rate').set('Authorization', `Bearer ${A.token}`).expect(200);
    const latest = res.body.find((r) => r.month === label);
    assert.equal(Number(latest.invoiced), 9000);
    assert.equal(Number(latest.collected), 9000);
  });

  it('honours ?months= and rejects > 24', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const res = await request(app).get('/api/reports/collection-rate?months=5').set('Authorization', `Bearer ${A.token}`).expect(200);
    assert.equal(res.body.length, 5);
    await request(app).get('/api/reports/collection-rate?months=25').set('Authorization', `Bearer ${A.token}`).expect(400);
    await request(app).get('/api/reports/collection-rate?months=0').set('Authorization', `Bearer ${A.token}`).expect(400);
  });
});

describe('Reports — tenant statement', () => {
  it('builds invoice + payment history with a running balance', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenant = await seedTenant(propA.id, { name: 'Alice', unit_number: 'AA1', monthly_rent: 10000 });
    const inv1 = await seedInvoice(tenant.id, propA.id, { invoice_number: 'T-1', amount: 10000, due_date: '2026-08-01' });
    const inv2 = await seedInvoice(tenant.id, propA.id, { invoice_number: 'T-2', amount: 10000, due_date: '2026-09-01' });
    await seedPayment(A.user.id, tenant.id, inv1.id, { amount: 10000, transaction_ref: 'pay-1', paid_at: new Date('2026-08-05') });
    await seedPayment(A.user.id, tenant.id, inv2.id, { amount: 4000, transaction_ref: 'pay-2', paid_at: new Date('2026-09-05') });

    const res = await request(app)
      .get(`/api/reports/tenant-statement/${tenant.id}`)
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);

    assert.equal(res.body.tenant.id, tenant.id);
    assert.equal(res.body.tenant.property_name, 'A Complex');
    assert.equal(res.body.statement.length, 4);

    const byRef = Object.fromEntries(res.body.statement.map((r) => [r.ref_number, r]));
    assert.equal(byRef['T-1'].type, 'invoice');
    assert.equal(Number(byRef['T-1'].amount), 10000);
    assert.equal(Number(byRef['T-1'].running_balance), 10000);
    assert.equal(byRef['pay-1'].type, 'payment');
    assert.equal(Number(byRef['pay-1'].running_balance), 0);
    assert.equal(Number(byRef['T-2'].running_balance), 10000);
    assert.equal(Number(byRef['pay-2'].running_balance), 6000);
  });

  it('returns 404 for a tenant owned by another landlord', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id);
    const tenant = await seedTenant(propA.id);

    const B = await seedLandlord({ name: 'Beatrice' });
    await request(app)
      .get(`/api/reports/tenant-statement/${tenant.id}`)
      .set('Authorization', `Bearer ${B.token}`)
      .expect(404);
  });

  it('exposes CSV via ?format=csv', async () => {
    const A = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(A.user.id, { name: 'A Complex' });
    const tenant = await seedTenant(propA.id, { name: 'Alice' });
    await seedInvoice(tenant.id, propA.id, { invoice_number: 'T-1', amount: 10000 });
    await seedPayment(A.user.id, tenant.id, null, { amount: 3000, transaction_ref: 'pay-1' });

    const res = await request(app)
      .get(`/api/reports/tenant-statement/${tenant.id}?format=csv`)
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text, /^type,ref_number,/);
    assert.match(res.text, /T-1/);
  });
});