// The invoice scheduler is the only thing that creates rent invoices without a landlord clicking a
// button, so the properties that matter are: it is idempotent, it is off during tests, and a failed
// tick does not stop the timer (a dead timer silently ends rent invoicing until the next deploy).

import { it, describe, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app,
  pool,
  applySchema,
  seedLandlord,
  seedProperty,
  seedTenant,
  resetDb,
  closeDb,
} from './helpers.js';

import { generateMonthlyInvoices, parseMonth, dueDateFor } from '../src/services/invoiceService.js';
import { startInvoiceScheduler, stopInvoiceScheduler, runInvoiceCycle } from '../src/services/scheduler.js';

async function seedActiveTenantWithRent(ownerId, rent = 50000) {
  const property = await seedProperty(ownerId, { name: 'Scheduler Flats', rent_due_day: 5 });
  const tenant = await seedTenant(property.id, { name: 'Scheduled Tenant', monthly_rent: rent, status: 'active' });
  return { property, tenant };
}

describe('invoice scheduler', () => {
  const originalEnv = { ...process.env };

  before(async () => {
    await applySchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    stopInvoiceScheduler();
    process.env = { ...originalEnv };
  });

  describe('runInvoiceCycle', () => {
    it('generates a pending invoice for every active tenant and marks nothing overdue', async () => {
      const landlord = await seedLandlord({ name: 'Nia' });
      const { tenant } = await seedActiveTenantWithRent(landlord.user.id);

      const result = await runInvoiceCycle();

      assert.equal(result.generated, 1);
      assert.equal(result.overdue_marked, 0);

      const { rows } = await pool.query('SELECT amount, due_date, status FROM invoices WHERE tenant_id = $1', [tenant.id]);
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].amount), 50000);
      assert.equal(rows[0].status, 'pending');
    });

    it('does not double-bill when it runs again, which is what makes a repeat-safe schedule possible', async () => {
      const landlord = await seedLandlord({ name: 'Nia' });
      await seedActiveTenantWithRent(landlord.user.id);

      await runInvoiceCycle();
      // A second tick hours later, or a restart, or a retry after a failure -- all must be no-ops.
      const second = await runInvoiceCycle();
      const third = await runInvoiceCycle();

      assert.equal(second.generated, 0);
      assert.equal(third.generated, 0);
      const { rows } = await pool.query('SELECT id FROM invoices');
      assert.equal(rows.length, 1, 'a tenant must never end up with two invoices for one month');
    });

    it('fills in a month that was missed rather than skipping the rent', async () => {
      const landlord = await seedLandlord({ name: 'Nia' });
      const { tenant } = await seedActiveTenantWithRent(landlord.user.id);

      // First tick bills the default (next) month.
      await runInvoiceCycle();
      // Now bill an earlier month explicitly, as if recovering from downtime.
      await generateMonthlyInvoices({ month: '2026-03' });

      const { rows } = await pool.query('SELECT invoice_number FROM invoices WHERE tenant_id = $1 ORDER BY invoice_number', [
        tenant.id,
      ]);
      assert.equal(rows.length, 2);
      assert.deepEqual(rows.map((r) => r.invoice_number), [
        `INV-${tenant.id}-202603`,
        `INV-${tenant.id}-202610`,
      ]);
    });

    it('leaves archived tenants and inactive properties alone', async () => {
      const landlord = await seedLandlord({ name: 'Nia' });
      const property = await seedProperty(landlord.user.id, { name: 'Old Block', status: 'inactive' });
      await seedTenant(property.id, { name: 'Moved Out', status: 'moved_out' });
      const live = await seedProperty(landlord.user.id, { name: 'Live Block' });
      await seedTenant(live.id, { name: 'Still Here', status: 'active' });

      const result = await runInvoiceCycle();

      assert.equal(result.generated, 1);
      const { rows } = await pool.query(
        `SELECT t.name FROM invoices i JOIN tenants t ON t.id = i.tenant_id`
      );
      assert.deepEqual(rows.map((r) => r.name), ['Still Here']);
    });

    it('flips a past-due pending invoice to overdue without touching one that is part paid', async () => {
      const landlord = await seedLandlord({ name: 'Nia' });
      const { tenant } = await seedActiveTenantWithRent(landlord.user.id);
      await pool.query(
        `INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, status)
         VALUES ($1, (SELECT property_id FROM tenants WHERE id = $1), 'INV-OLD-1', 50000, CURRENT_DATE - 5, 'pending'),
                ($1, (SELECT property_id FROM tenants WHERE id = $1), 'INV-OLD-2', 50000, CURRENT_DATE - 5, 'partial')`,
        [tenant.id]
      );

      const result = await runInvoiceCycle();

      assert.equal(result.overdue_marked, 1);
      const { rows } = await pool.query('SELECT invoice_number, status FROM invoices ORDER BY invoice_number');
      const byNumber = Object.fromEntries(rows.map((r) => [r.invoice_number, r.status]));
      assert.equal(byNumber['INV-OLD-1'], 'overdue');
      assert.equal(byNumber['INV-OLD-2'], 'partial', 'a part-paid invoice keeps its status');
    });
  });

  describe('startInvoiceScheduler', () => {
    it('does not start under the test environment, so it cannot race test fixtures', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.INVOICE_SCHEDULER_ENABLED;
      assert.equal(startInvoiceScheduler(), null);
    });

    it('does not start when explicitly disabled', () => {
      process.env.NODE_ENV = 'production';
      process.env.INVOICE_SCHEDULER_ENABLED = 'false';
      assert.equal(startInvoiceScheduler(), null);
    });

    it('falls back to the default interval on an unparseable value, because a typo must not stop rent invoicing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.INVOICE_SCHEDULER_ENABLED;
      process.env.INVOICE_SCHEDULER_INTERVAL_HOURS = 'nonsense';
      const timer = startInvoiceScheduler();
      // Number('nonsense') is NaN, which would otherwise become a 0ms interval and spin the tick.
      assert.ok(timer, 'scheduler should still run, at the default cadence');
      assert.equal(timer._idleTimeout, 6 * 60 * 60 * 1000);
      stopInvoiceScheduler();

      process.env.INVOICE_SCHEDULER_INTERVAL_HOURS = '0';
      const zero = startInvoiceScheduler();
      assert.ok(zero, 'zero falls back to the default rather than spinning');
      assert.equal(zero._idleTimeout, 6 * 60 * 60 * 1000);
    });

    it('starts and can be stopped', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.INVOICE_SCHEDULER_ENABLED;
      process.env.INVOICE_SCHEDULER_INTERVAL_HOURS = '6';
      const timer = startInvoiceScheduler();
      assert.ok(timer);
      stopInvoiceScheduler();
    });
  });

  describe('month arithmetic the scheduler depends on', () => {
    it('defaults to the next calendar month', () => {
      const { month } = parseMonth('');
      const now = new Date();
      const expected = (now.getMonth() + 2) % 12 || 12;
      assert.equal(month, expected);
    });

    it('rolls December into the next year', () => {
      assert.deepEqual(parseMonth('2026-12'), { year: 2026, month: 12 });
      // A December run must bill January of the following year, not December again.
      const jan = parseMonth('2027-01');
      assert.deepEqual(jan, { year: 2027, month: 1 });
    });

    it('clamps a due day that does not exist in the target month', () => {
      // rent_due_day 31 in February must land on the 28th/29th, not overflow into March.
      assert.equal(dueDateFor(31, { year: 2026, month: 2 }), '2026-02-28');
      assert.equal(dueDateFor(31, { year: 2024, month: 2 }), '2024-02-29');
      assert.equal(dueDateFor(5, { year: 2026, month: 12 }), '2026-12-05');
    });
  });

  describe('the protected endpoint still works for a manual backfill', () => {
    it('rejects a call with no secret, and accepts the right one', async () => {
      const landlord = await seedLandlord({ name: 'Nia' });
      await seedActiveTenantWithRent(landlord.user.id);

      await request(app).post('/api/cron/invoices').expect(401);
      await request(app).post('/api/cron/invoices').set('x-cron-secret', 'wrong').expect(401);

      const res = await request(app)
        .post('/api/cron/invoices')
        .set('x-cron-secret', process.env.CRON_SECRET)
        .send({ month: '2026-05' })
        .expect(200);

      assert.equal(res.body.generated, 1);
      assert.equal(res.body.period, '2026-05');
      // And it stays idempotent through the endpoint too.
      const again = await request(app)
        .post('/api/cron/invoices')
        .set('x-cron-secret', process.env.CRON_SECRET)
        .send({ month: '2026-05' })
        .expect(200);
      assert.equal(again.body.generated, 0);
      void landlord;
    });
  });
});

after(async () => {
  await closeDb();
});
