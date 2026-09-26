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
  seedChannel,
  callbackBody,
  makePayHeroMock,
  setPayHeroMock,
  app,
  pool,
} from './helpers.js';

const WEBHOOK = '/webhooks/payhero';
const SECRET = process.env.PAYHERO_WEBHOOK_SECRET;

function postWebhook(payload, secret = SECRET) {
  return request(app).post(WEBHOOK).send(payload).set('x-payhero-secret', secret);
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
  setPayHeroMock(makePayHeroMock());
});

describe('PayHero webhook → payment pipeline', () => {
  it('verification: rejects callbacks without the shared secret (fail closed)', async () => {
    const cb = callbackBody({});
    // missing secret
    await request(app).post(WEBHOOK).send(cb.body).expect(403);
    // wrong secret
    await request(app).post(WEBHOOK).send(cb.body).set('x-payhero-secret', 'wrong-secret').expect(403);
    // correct secret passes
    const ok = await postWebhook(cb.body).expect(200);
    assert.equal(ok.body.status, 'ok');
  });

  it('verification: accepts the secret via the ?secret= query param, the only form PayHero can send', async () => {
    // PayHero signs nothing and can set no custom header, so the callback URL we register in their
    // dashboard carries the secret. This is the path a real payment must be able to take.
    const cb = callbackBody({});
    const res = await request(app)
      .post(`${WEBHOOK}?secret=${encodeURIComponent(SECRET)}`)
      .send(cb.body)
      .expect(200);
    assert.equal(res.body.status, 'ok');

    // A wrong secret in the query string is still rejected.
    await request(app).post(`${WEBHOOK}?secret=wrong-secret`).send(cb.body).expect(403);
  });

  it('verification: also accepts the x-payhero-webhook-secret header name', async () => {
    const cb = callbackBody({});
    const res = await request(app)
      .post(WEBHOOK)
      .send(cb.body)
      .set('x-payhero-webhook-secret', SECRET)
      .expect(200);
    assert.equal(res.body.status, 'ok');
  });

  it('verification: records every rejection in the audit log without leaking the secret', async () => {
    const cb = callbackBody({});

    await request(app).post(WEBHOOK).send(cb.body).expect(403);
    await request(app).post(WEBHOOK).send(cb.body).set('x-payhero-secret', 'wrong-secret-value').expect(403);

    const { rows } = await pool.query(
      `SELECT status, processing_error, raw_payload FROM payhero_callback_log ORDER BY id`
    );
    const rejected = rows.filter((r) => r.status === 'rejected_auth');
    assert.equal(rejected.length, 2, 'both rejections should be auditable');

    // The reason must be diagnosable...
    assert.match(rejected[0].processing_error, /secret_missing/);
    assert.match(rejected[1].processing_error, /secret_mismatch/);
    assert.match(rejected[1].processing_error, /via=x-payhero-secret/);
    // ...and the payload must survive, since it is the only evidence of PayHero's real shape.
    assert.deepEqual(rejected[0].raw_payload, cb.body);

    // Neither the presented nor the configured secret may appear anywhere in the row.
    for (const row of rejected) {
      assert.doesNotMatch(JSON.stringify(row), /wrong-secret-value/);
      assert.doesNotMatch(JSON.stringify(row), new RegExp(SECRET));
      assert.match(row.processing_error, /sha256:/, 'presented value should be fingerprinted, not stored');
    }
  });

  it('verification: a valid secret is still rejected when the IP allowlist excludes the caller', async () => {
    const previous = process.env.PAYHERO_IP_ALLOWLIST;
    process.env.PAYHERO_IP_ALLOWLIST = '203.0.113.7'; // TEST-NET-3, never the loopback test client
    try {
      const cb = callbackBody({});
      await request(app).post(WEBHOOK).send(cb.body).set('x-payhero-secret', SECRET).expect(403);
      const { rows } = await pool.query(
        `SELECT processing_error FROM payhero_callback_log WHERE status = 'rejected_auth'`
      );
      assert.match(rows[0].processing_error, /ip_not_allowed/);
    } finally {
      if (previous === undefined) delete process.env.PAYHERO_IP_ALLOWLIST;
      else process.env.PAYHERO_IP_ALLOWLIST = previous;
    }
  });

  it('routes callbacks to the correct org when two orgs each own a Paybill channel', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    const propA = await seedProperty(a.user.id, { name: 'A Complex' });
    const tenantA = await seedTenant(propA.id, { name: 'Alice', phone: '0701111222', unit_number: 'AA1' });
    const invA = await seedInvoice(tenantA.id, propA.id, { invoice_number: 'INV-A1', amount: 12000 });
    const chanA = await seedChannel(a.user.id, { channel_type: 'paybill', short_code: '522522', payhero_channel_id: '1001' });

    const b = await seedLandlord({ name: 'Beatrice' });
    const propB = await seedProperty(b.user.id, { name: 'B Flats' });
    const tenantB = await seedTenant(propB.id, { name: 'Bob', phone: '0703333444', unit_number: 'BB1' });
    const invB = await seedInvoice(tenantB.id, propB.id, { invoice_number: 'INV-B1', amount: 8000 });
    const chanB = await seedChannel(b.user.id, { channel_type: 'paybill', short_code: '411111', payhero_channel_id: '1002' });

    const cbA = callbackBody({ amount: 12000, reference: 'INV-A1', phone: '+254701111222' });
    const cbB = callbackBody({ amount: 8000, reference: 'INV-B1', phone: '+254703333444' });

    const resA = await postWebhook({ ...cbA.body, response: { ...cbA.body.response, channel_id: '1001' } }).expect(200);
    assert.equal(resA.body.result, 'matched');
    const resB = await postWebhook({ ...cbB.body, response: { ...cbB.body.response, channel_id: '1002' } }).expect(200);
    assert.equal(resB.body.result, 'matched');

    const payments = await pool.query('SELECT * FROM payments ORDER BY id');
    assert.equal(payments.rows.length, 2);
    const pA = payments.rows.find((p) => p.transaction_ref === cbA.receipt);
    const pB = payments.rows.find((p) => p.transaction_ref === cbB.receipt);
    assert.ok(pA && pB, 'both payments recorded');
    assert.equal(pA.owner_id, a.user.id);
    assert.equal(pA.payment_channel_id, chanA.id);
    assert.equal(pA.tenant_id, tenantA.id);
    assert.equal(pA.matched, true);
    assert.equal(pB.owner_id, b.user.id);
    assert.equal(pB.payment_channel_id, chanB.id);
    assert.equal(pB.tenant_id, tenantB.id);

    const invAFinal = await pool.query('SELECT status FROM invoices WHERE id = $1', [invA.id]);
    const invBFinal = await pool.query('SELECT status FROM invoices WHERE id = $1', [invB.id]);
    assert.equal(invAFinal.rows[0].status, 'paid');
    assert.equal(invBFinal.rows[0].status, 'paid');
  });

  it('attributes payments to the right channel within one org that has a Paybill AND a Till', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    const prop = await seedProperty(a.user.id, { name: 'A Complex' });
    const tenant = await seedTenant(prop.id, { name: 'Alice', phone: '0701111222', unit_number: 'AA1' });
    await seedInvoice(tenant.id, prop.id, { invoice_number: 'INV-A1', amount: 12000 });
    const chanPaybill = await seedChannel(a.user.id, { channel_type: 'paybill', short_code: '522522', payhero_channel_id: '1001' });
    const chanTill = await seedChannel(a.user.id, { channel_type: 'till', short_code: '411111', payhero_channel_id: '2001' });

    // Paybill payment attributed via the channel id
    const cb1 = callbackBody({ amount: 12000, reference: 'INV-A1', phone: '+254701111222' });
    const res1 = await postWebhook({ ...cb1.body, response: { ...cb1.body.response, channel_id: '1001' } }).expect(200);
    assert.equal(res1.body.result, 'matched');

    // Till payment (no invoice reference) matched by phone within scope
    const cb2 = callbackBody({ amount: 5000, reference: '', phone: '+254701111222' });
    const res2 = await postWebhook({ ...cb2.body, response: { ...cb2.body.response, channel_id: '2001' } }).expect(200);

    const p1 = await pool.query('SELECT * FROM payments WHERE transaction_ref = $1', [cb1.receipt]);
    const p2 = await pool.query('SELECT * FROM payments WHERE transaction_ref = $1', [cb2.receipt]);
    assert.equal(p1.rows[0].payment_channel_id, chanPaybill.id);
    assert.equal(p1.rows[0].tenant_id, tenant.id);
    assert.equal(p1.rows[0].payment_method, 'mobile_money');
    // second payment: tenant matched, invoice already paid → recorded against the Till channel, manual review
    assert.equal(p2.rows[0].payment_channel_id, chanTill.id);
    assert.equal(p2.rows[0].tenant_id, tenant.id);
    assert.equal(res2.body.result, 'unmatched_tenant');
  });

  it('is idempotent: a retried callback never creates a second payment', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    const prop = await seedProperty(a.user.id);
    const tenant = await seedTenant(prop.id, { name: 'Alice', phone: '0701111222' });
    await seedInvoice(tenant.id, prop.id, { invoice_number: 'INV-A1', amount: 10000 });
    await seedChannel(a.user.id, { channel_type: 'paybill', short_code: '522522', payhero_channel_id: '1001' });

    const cb = callbackBody({ amount: 10000, reference: 'INV-A1', phone: '+254701111222' });
    const payload = { ...cb.body, response: { ...cb.body.response, channel_id: '1001' } };

    const first = await postWebhook(payload).expect(200);
    assert.equal(first.body.result, 'matched');
    const second = await postWebhook(payload).expect(200);
    assert.equal(second.body.result, 'duplicate');

    const count = await pool.query('SELECT COUNT(*)::int AS c FROM payments WHERE transaction_ref = $1', [cb.receipt]);
    assert.equal(count.rows[0].c, 1);

    const events = await pool.query('SELECT match_status FROM payment_reconciliation_events WHERE transaction_ref = $1 ORDER BY id', [cb.receipt]);
    assert.deepEqual(events.rows.map((r) => r.match_status), ['matched', 'duplicate']);

    const log = await pool.query('SELECT status FROM payhero_callback_log ORDER BY id');
    assert.deepEqual(log.rows.map((r) => r.status), ['processed', 'duplicate']);
  });

  it('never drops unmatched money: records it against the channel owner with matched=false', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    await seedProperty(a.user.id, { name: 'A Complex' }); // landlord exists but has no matching tenant
    const chan = await seedChannel(a.user.id, { channel_type: 'paybill', short_code: '522522', payhero_channel_id: '1001' });

    const cb = callbackBody({ amount: 5000, reference: 'NO-SUCH-INVOICE', phone: '+254799999999' });
    const res = await postWebhook({ ...cb.body, response: { ...cb.body.response, channel_id: '1001' } }).expect(200);
    assert.equal(res.body.result, 'unmatched_tenant');

    const pay = await pool.query('SELECT * FROM payments WHERE transaction_ref = $1', [cb.receipt]);
    assert.equal(pay.rows.length, 1, 'money is never dropped');
    assert.equal(pay.rows[0].matched, false);
    assert.equal(pay.rows[0].owner_id, a.user.id, 'attributed to the channel owner');
    assert.equal(pay.rows[0].payment_channel_id, chan.id);
    assert.equal(pay.rows[0].tenant_id, null);
    assert.equal(pay.rows[0].invoice_id, null);

    const ev = await pool.query('SELECT * FROM payment_reconciliation_events WHERE transaction_ref = $1', [cb.receipt]);
    assert.equal(ev.rows.length, 1);
    assert.equal(ev.rows[0].match_status, 'manual_review');
    assert.equal(ev.rows[0].payment_channel_id, chan.id);
  });

  it('logs + alerts an unrecognized channel identifier instead of silently ignoring it', async () => {
    const cb = callbackBody({ amount: 5000, reference: 'INV-X', phone: '+254799999999' });
    const res = await postWebhook({ ...cb.body, response: { ...cb.body.response, channel_id: '9999' } }).expect(200);
    assert.equal(res.body.result, 'unmatched_channel');

    const log = await pool.query('SELECT * FROM payhero_callback_log ORDER BY id DESC LIMIT 1');
    assert.equal(log.rows[0].status, 'unmatched_channel');
    assert.equal(log.rows[0].alerted, true);
    assert.equal(log.rows[0].payhero_channel_id, '9999');

    const payments = await pool.query('SELECT COUNT(*)::int AS c FROM payments');
    assert.equal(payments.rows[0].c, 0, 'no payment recorded for an unregistered channel');
    const events = await pool.query('SELECT COUNT(*)::int AS c FROM payment_reconciliation_events');
    assert.equal(events.rows[0].c, 0);
  });

  it('attributes an owner from a strictly-unique phone when no channel id is present (current PayHero docs behavior)', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    const prop = await seedProperty(a.user.id, { name: 'A Complex' });
    const tenant = await seedTenant(prop.id, { name: 'Alice', phone: '0701111222', unit_number: 'AA1' });
    await seedInvoice(tenant.id, prop.id, { invoice_number: 'INV-A1', amount: 10000 });
    await seedChannel(a.user.id, { channel_type: 'paybill', short_code: '522522', payhero_channel_id: '1001' });
    const b = await seedLandlord({ name: 'Beatrice' });
    await seedChannel(b.user.id, { channel_type: 'paybill', short_code: '411111', payhero_channel_id: '1002' });

    // no channel identifier anywhere in the callback — falls back to phone; only one org has this tenant's phone
    const cb = callbackBody({ amount: 10000, reference: 'INV-A1', phone: '+254701111222' });
    const res = await postWebhook(cb.body).expect(200);
    assert.equal(res.body.result, 'matched');
    assert.equal(res.body.ownerId, a.user.id);

    const pay = await pool.query('SELECT * FROM payments WHERE transaction_ref = $1', [cb.receipt]);
    assert.equal(pay.rows[0].owner_id, a.user.id);
    assert.equal(pay.rows[0].tenant_id, tenant.id);
  });
});

describe('payment channel registration endpoints (owner-scoped)', () => {
  it('registers a channel via PayHero and stores the payhero channel id', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    setPayHeroMock(makePayHeroMock());

    const res = await request(app)
      .post('/api/payment-channels')
      .set(auth(a.token))
      .send({ channel_type: 'paybill', short_code: '522522', description: 'Main Paybill' })
      .expect(201);

    assert.equal(res.body.payhero_channel_id, '5000');
    assert.equal(res.body.owner_id, a.user.id);
    // PayHero returns is_active:false for a brand-new channel → ownership confirmation step pending
    assert.equal(res.body.verification_status, 'inactive');
    assert.equal(res.body.is_active, false);

    const list = await request(app).get('/api/payment-channels').set(auth(a.token)).expect(200);
    assert.equal(list.body.length, 1);

    // idempotent: re-adding the same short code returns the existing row
    const again = await request(app)
      .post('/api/payment-channels')
      .set(auth(a.token))
      .send({ channel_type: 'paybill', short_code: '522522' })
      .expect(200);
    assert.equal(again.body.payhero_channel_id, '5000');
  });

  it('never leaks channels across landlords (isolation on read + write)', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    const b = await seedLandlord({ name: 'Beatrice' });
    await seedChannel(a.user.id, { payhero_channel_id: '1001' });

    const listB = await request(app).get('/api/payment-channels').set(auth(b.token)).expect(200);
    assert.equal(listB.body.length, 0, 'Org B must never see Org A channels');

    const patch = await request(app)
      .patch('/api/payment-channels/1')
      .set(auth(b.token))
      .send({ is_active: false })
      .expect(403);
    assert.match(patch.body.message, /do not own/i);

    const sync = await request(app)
      .post('/api/payment-channels/1/sync')
      .set(auth(b.token))
      .expect(403);
    assert.match(sync.body.message, /do not own/i);
  });

  it('sync() reflects the channel activation status PayHero returns', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    const chan = await seedChannel(a.user.id, { payhero_channel_id: '5000', verification_status: 'pending', is_active: false });

    // the landlord confirmed ownership in the PayHero portal; GET /payment_channels now shows is_active:true
    setPayHeroMock(
      makePayHeroMock({
        channels: [
          { id: 5000, channel_type: 'paybill', account_id: 5000, short_code: '522522', account_number: null, description: 'Main Paybill', is_active: true },
        ],
      })
    );

    const res = await request(app).post(`/api/payment-channels/${chan.id}/sync`).set(auth(a.token)).expect(200);
    assert.equal(res.body.verification_status, 'active');
    assert.equal(res.body.is_active, true);
    assert.equal(res.body.payhero_channel_id, '5000');
  });

  it('surfaces the service wallet balance with a low-balance flag', async () => {
    const a = await seedLandlord({ name: 'Amos' });
    setPayHeroMock(makePayHeroMock({ wallet: { currency: 'KES', available_balance: 300, account_id: 5000 } }));

    const res = await request(app).get('/api/payment-channels/wallet').set(auth(a.token)).expect(200);
    assert.equal(res.body.available_balance, 300);
    assert.equal(res.body.low, true);
    assert.equal(res.body.threshold, 500);

    setPayHeroMock(makePayHeroMock({ wallet: { currency: 'KES', available_balance: 15000, account_id: 5000 } }));
    const healthy = await request(app).get('/api/payment-channels/wallet').set(auth(a.token)).expect(200);
    assert.equal(healthy.body.low, false);
  });
});

// ensure the process exits cleanly once the suite is done
process.on('exit', () => {
  closeDb().catch(() => {});
});