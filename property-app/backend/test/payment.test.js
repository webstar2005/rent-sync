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
  makePayHeroMock,
  setPayHeroMock,
  pool,
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

describe('POST /api/payments/request does not prompt tenants', () => {
  // Rent Sync collects and reconciles; it does not prompt tenants. Rent arrives as Send Money into the
  // landlord's own till, which needs no prompt. Pinned by a test because the code to prompt still
  // exists inside the PayHero client library and would be one endpoint away from reaching a real
  // tenant's phone.

  it('answers 501, says why, and never contacts PayHero', async () => {
    const landlord = await seedLandlord({ name: 'Prompt Off', email: 'prompt-off@test.local' });
    const property = await seedProperty(landlord.user.id, { name: 'Nia Flats' });
    const tenant = await seedTenant(property.id, { name: 'Tenant One', phone: '0712345678' });
    const invoice = await seedInvoice(tenant.id, property.id, { invoice_number: 'INV-OFF', amount: 10000 });
    await seedChannel(landlord.user.id, { channel_type: 'till', short_code: '778899', payhero_channel_id: '9001' });

    // Any call to PayHero here would mean a tenant could still be prompted.
    const calls = [];
    setPayHeroMock(async (url, options = {}) => {
      calls.push(`${options.method || 'GET'} ${url}`);
      return makePayHeroMock()(url, options);
    });

    const res = await request(app)
      .post('/api/payments/request')
      .set(auth(landlord.token))
      .send({ invoice_id: invoice.id })
      .expect(501);

    assert.match(res.body.message, /does not send payment prompts/i);
    assert.deepEqual(calls, [], 'PayHero must not be contacted for a disabled prompt');
  });

  it('does not exist as an STK push anywhere in the service layer', async () => {
    const service = await import('../src/services/payhero.js');
    assert.equal(
      service.initiateStkPush,
      undefined,
      'initiateStkPush must not be exported, or it is one route away from prompting a real tenant'
    );
  });

  it('still requires authentication and a paid plan', async () => {
    await request(app).post('/api/payments/request').send({ invoice_id: 1 }).expect(401);

    const landlord = await seedLandlord({
      name: 'Unpaid',
      email: 'unpaid-prompt@test.local',
      subscription: { status: 'unpaid' },
    });
    await request(app)
      .post('/api/payments/request')
      .set(auth(landlord.token))
      .send({ invoice_id: 1 })
      .expect(402);
  });
});

describe('POST /api/payments - manual capture of rent that no provider can see', () => {
  // Most Kenyan rent arrives as M-Pesa Send Money straight into the landlord's own number. No
  // payment provider observes that, so nothing ever calls our webhook and the money has to be keyed
  // in by hand. This endpoint is the only way that money reaches the ledger, so the transitions it
  // causes on the invoice are what a landlord's arrears figures are built from.

  async function seedInvoiceFor(landlord, { amount = 10000, status = 'pending' } = {}) {
    const property = await seedProperty(landlord.user.id, { name: 'Nia Flats' });
    const tenant = await seedTenant(property.id, { name: 'Grace Wanjiku', phone: '0712345678' });
    const invoice = await seedInvoice(tenant.id, property.id, {
      invoice_number: 'INV-M1',
      amount,
      status,
    });
    return { property, tenant, invoice };
  }

  it('records a Send Money payment and marks the invoice paid', async () => {
    const landlord = await seedLandlord({ name: 'Nia' });
    const { tenant, invoice } = await seedInvoiceFor(landlord);

    const res = await request(app)
      .post('/api/payments')
      .set(auth(landlord.token))
      .send({
        invoice_id: invoice.id,
        tenant_id: tenant.id,
        amount: 10000,
        payment_method: 'mobile_money',
        reference: 'QJG7X4K2PL',
        status: 'completed',
      })
      .expect(201);

    assert.equal(Number(res.body.amount), 10000);
    assert.equal(res.body.payment_method, 'mobile_money');
    assert.equal(res.body.reference, 'QJG7X4K2PL');
    // Recorded as reconciled: a landlord keyed this in against a specific invoice on purpose, so it
    // must not show up in the "needs reconciliation" queue alongside unmatched webhook payments.
    assert.equal(res.body.matched, true);
    assert.equal(res.body.invoice_status, 'paid');

    const inv = await pool.query('SELECT status FROM invoices WHERE id = $1', [invoice.id]);
    assert.equal(inv.rows[0].status, 'paid');
  });

  it('leaves a part payment as partial and later completes it', async () => {
    const landlord = await seedLandlord({ name: 'Nia' });
    const { tenant, invoice } = await seedInvoiceFor(landlord, { amount: 10000 });

    const first = await request(app)
      .post('/api/payments')
      .set(auth(landlord.token))
      .send({ invoice_id: invoice.id, tenant_id: tenant.id, amount: 4000, payment_method: 'cash', status: 'completed' })
      .expect(201);
    assert.equal(first.body.invoice_status, 'partial');

    // The tenant sends the rest a week later as Send Money.
    const second = await request(app)
      .post('/api/payments')
      .set(auth(landlord.token))
      .send({ invoice_id: invoice.id, tenant_id: tenant.id, amount: 6000, payment_method: 'mobile_money', status: 'completed' })
      .expect(201);
    assert.equal(second.body.invoice_status, 'paid');

    const inv = await pool.query('SELECT status FROM invoices WHERE id = $1', [invoice.id]);
    assert.equal(inv.rows[0].status, 'paid');
  });

  it('leaves the invoice untouched when the payment is not completed', async () => {
    const landlord = await seedLandlord({ name: 'Nia' });
    const { tenant, invoice } = await seedInvoiceFor(landlord);

    await request(app)
      .post('/api/payments')
      .set(auth(landlord.token))
      .send({ invoice_id: invoice.id, tenant_id: tenant.id, amount: 10000, payment_method: 'mobile_money', status: 'pending' })
      .expect(201);

    const inv = await pool.query('SELECT status FROM invoices WHERE id = $1', [invoice.id]);
    assert.equal(inv.rows[0].status, 'pending', 'an unconfirmed payment must not mark rent collected');
  });

  it('rejects a zero or negative amount', async () => {
    const landlord = await seedLandlord({ name: 'Nia' });
    const { tenant, invoice } = await seedInvoiceFor(landlord);

    for (const amount of [0, -500]) {
      const res = await request(app)
        .post('/api/payments')
        .set(auth(landlord.token))
        .send({ invoice_id: invoice.id, tenant_id: tenant.id, amount, payment_method: 'cash', status: 'completed' })
        .expect(400);
      assert.ok(res.body.message);
    }
    const { rows } = await pool.query('SELECT id FROM payments');
    assert.equal(rows.length, 0);
  });

  it("refuses another landlord's invoice", async () => {
    const owner = await seedLandlord({ name: 'Nia' });
    const { tenant, invoice } = await seedInvoiceFor(owner);
    const intruder = await seedLandlord({ name: 'Intruder' });

    await request(app)
      .post('/api/payments')
      .set(auth(intruder.token))
      .send({ invoice_id: invoice.id, tenant_id: tenant.id, amount: 10000, payment_method: 'cash', status: 'completed' })
      .expect(403);
  });

  it('refuses a tenant that does not belong to the invoice property', async () => {
    const landlord = await seedLandlord({ name: 'Nia' });
    const { invoice } = await seedInvoiceFor(landlord);
    const otherProperty = await seedProperty(landlord.user.id, { name: 'Other Block' });
    const stranger = await seedTenant(otherProperty.id, { name: 'Wrong Tenant' });

    await request(app)
      .post('/api/payments')
      .set(auth(landlord.token))
      .send({ invoice_id: invoice.id, tenant_id: stranger.id, amount: 100, payment_method: 'cash', status: 'completed' })
      .expect(403);
  });

  it('refuses a cancelled invoice', async () => {
    const landlord = await seedLandlord({ name: 'Nia' });
    const { tenant, invoice } = await seedInvoiceFor(landlord, { status: 'cancelled' });

    const res = await request(app)
      .post('/api/payments')
      .set(auth(landlord.token))
      .send({ invoice_id: invoice.id, tenant_id: tenant.id, amount: 100, payment_method: 'cash', status: 'completed' })
      .expect(409);
    assert.match(res.body.message, /cancelled/i);
  });

  it('requires authentication', async () => {
    await request(app).post('/api/payments').send({ invoice_id: 1, tenant_id: 1, amount: 1 }).expect(401);
  });
});
