import { describe, it, before, beforeEach, after } from 'node:test';
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
  seedPayment,
  seedChannel,
  app,
} from './helpers.js';

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

after(async () => {
  await closeDb();
});

describe('GET /api/payments — everything received is visible', () => {
  it('returns a payment that could NOT be matched to an invoice', async () => {
    // This is the regression guard. The webhook records a payment even when it cannot attribute it to
    // an invoice (unrecorded money is worse than unmatched money). This route used to INNER JOIN
    // invoices, so exactly these rows were dropped and a landlord asking "a tenant paid and I can't see
    // it" was answered by the one page that could not show them. payments.invoice_id is nullable.
    const landlord = await seedLandlord({ name: 'Amos' });
    const unmatched = await seedPayment(landlord.user.id, null, null, {
      amount: 5000,
      reference: 'UNMATCHED-1',
      transaction_ref: 'TX-UNMATCHED-1',
      matched: false,
    });

    const res = await request(app).get('/api/payments').set(auth(landlord.token)).expect(200);

    assert.equal(res.body.length, 1, 'an unmatched payment must still be listed');
    assert.equal(res.body[0].id, unmatched.id);
    assert.equal(res.body[0].matched, false, 'the UI needs this flag to flag it for reconciliation');
    assert.equal(res.body[0].invoice_id, null);
    assert.equal(res.body[0].invoice_number, null);
  });

  it('returns matched and unmatched payments together, newest first', async () => {
    const landlord = await seedLandlord({ name: 'Beatrice' });
    const property = await seedProperty(landlord.user.id, { name: 'B Flats' });
    const tenant = await seedTenant(property.id, { name: 'Bob', phone: '0703333444' });
    const invoice = await seedInvoice(tenant.id, property.id, { invoice_number: 'INV-B1', amount: 8000 });

    await seedPayment(landlord.user.id, tenant.id, invoice.id, {
      amount: 8000,
      reference: 'INV-B1',
      transaction_ref: 'TX-OLD',
      paid_at: new Date('2026-09-01T10:00:00Z'),
    });
    await seedPayment(landlord.user.id, null, null, {
      amount: 250,
      reference: 'STRAY-1',
      transaction_ref: 'TX-NEW',
      matched: false,
      paid_at: new Date('2026-09-20T10:00:00Z'),
    });

    const res = await request(app).get('/api/payments').set(auth(landlord.token)).expect(200);

    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].transaction_ref, 'TX-NEW', 'newest payment must be first');
    assert.equal(res.body[1].transaction_ref, 'TX-OLD');
    // The matched row still carries its denormalised invoice/tenant labels for the table.
    assert.equal(res.body[1].invoice_number, 'INV-B1');
    assert.equal(res.body[1].tenant_name, 'Bob');
  });

  it('includes the originating payment channel so a landlord can see where money arrived', async () => {
    const landlord = await seedLandlord({ name: 'Carol' });
    const property = await seedProperty(landlord.user.id);
    const tenant = await seedTenant(property.id, { name: 'Cleo' });
    const invoice = await seedInvoice(tenant.id, property.id, { invoice_number: 'INV-C1' });
    const channel = await seedChannel(landlord.user.id, {
      channel_type: 'till',
      short_code: '778899',
      description: 'Main till',
    });
    await seedPayment(landlord.user.id, tenant.id, invoice.id, {
      amount: 1000,
      transaction_ref: 'TX-CHAN',
      payment_channel_id: channel.id,
    });

    const res = await request(app).get('/api/payments').set(auth(landlord.token)).expect(200);

    assert.equal(res.body[0].channel_short_code, '778899');
    assert.equal(res.body[0].channel_type, 'till');
  });

  it("never returns another landlord's payments, matched or not", async () => {
    const me = await seedLandlord({ name: 'Mine' });
    const other = await seedLandlord({ name: 'Theirs' });

    await seedPayment(me.user.id, null, null, { amount: 100, transaction_ref: 'TX-MINE' });
    await seedPayment(other.user.id, null, null, { amount: 999, transaction_ref: 'TX-THEIRS' });

    const res = await request(app).get('/api/payments').set(auth(me.token)).expect(200);

    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].transaction_ref, 'TX-MINE');
  });

  it('requires authentication', async () => {
    await request(app).get('/api/payments').expect(401);
  });
});
