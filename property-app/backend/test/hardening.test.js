import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {
  applySchema,
  resetDb,
  seedLandlord,
  seedProperty,
  seedTenant,
  seedInvoice,
  closeDb,
  pool,
  app,
} from './helpers.js';
import { redactUrl } from '../src/utils/logger.js';
import { startInvoiceScheduler, stopInvoiceScheduler } from '../src/services/scheduler.js';

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
  stopInvoiceScheduler();
  await closeDb();
});

// The PayHero callback carries the account's live webhook secret in the query string, because
// PayHero sends no signature and supports no custom header. The HTTP access log used to record
// req.url verbatim, which wrote that secret to Render's log stream and to the on-disk log file.
describe('access logs never record the PayHero webhook secret', () => {
  it('redacts a secret carried in the query string', () => {
    const out = redactUrl('https://api.rentsync.africa/webhooks/payhero?secret=hunter2');
    assert.equal(out, 'https://api.rentsync.africa/webhooks/payhero?secret=[redacted]');
    assert.ok(!out.includes('hunter2'), 'the secret value must not survive redaction');
  });

  it('redacts the other credential-shaped keys too', () => {
    // Distinctive values: the key names themselves stay in the URL (that is the point of keeping the
    // rest of the query), so a value like "at" would collide with "signature" and prove nothing.
    const url = '/x?token=Zt0kenVAL&password=Pw0rdVAL&api_key=Ap1KeyVAL&access_token=Ac0cessVAL&signature=S1gnatureVAL';
    const out = redactUrl(url);
    for (const secret of ['Zt0kenVAL', 'Pw0rdVAL', 'Ap1KeyVAL', 'Ac0cessVAL', 'S1gnatureVAL']) {
      assert.ok(!out.includes(secret), `${secret} leaked into ${out}`);
    }
    // The key names are retained so the line stays diagnosable.
    assert.ok(out.includes('signature='));
  });

  it('is case-insensitive about the key name', () => {
    assert.equal(redactUrl('/x?SECRET=abc'), '/x?SECRET=[redacted]');
  });

  it('keeps non-sensitive parameters, because those are what make a log line diagnosable', () => {
    assert.equal(redactUrl('/api/invoices?status=pending&page=2'), '/api/invoices?status=pending&page=2');
  });

  it('leaves a URL with no query string alone', () => {
    assert.equal(redactUrl('/health'), '/health');
  });

  it('does not throw on malformed percent-encoding in a key', () => {
    assert.equal(redactUrl('/x?%E0%A4%A=1&secret=s'), '/x?%E0%A4%A=1&secret=[redacted]');
  });

  it('passes through empty and non-string input unchanged', () => {
    assert.equal(redactUrl(''), '');
    assert.equal(redactUrl(undefined), undefined);
  });
});

// Behind Cloudflare in front of Render, every visitor used to share one rate-limit bucket because
// `trust proxy` was never configured, so req.ip resolved to Cloudflare's single shared address.
describe('rate limiters bucket on the real client address', () => {
  it('is configured with a bounded hop count, not `true` and not left unset', () => {
    const hops = app.get('trust proxy');
    assert.equal(hops, 2, `expected a hop count of 2, got ${JSON.stringify(hops)}`);
    assert.notEqual(hops, true, 'trust proxy must never be `true`: that trusts any client-supplied X-Forwarded-For and lets anyone mint unlimited buckets');
    assert.notEqual(hops, undefined, 'trust proxy must be set, or req.ip collapses to the proxy address');
  });

  it('resolves the client address from the real two-hop chain', async () => {
    // Client -> Cloudflare -> app. 203.0.113.9 is the client; 198.51.100.1 is Cloudflare.
    const probe = express();
    probe.set('trust proxy', 2);
    probe.get('/ip', (req, res) => res.json({ ip: req.ip }));

    const res = await request(probe)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.9, 198.51.100.1');

    assert.equal(res.body.ip, '203.0.113.9');
  });

  it('is bounded: a longer chain resolves to the hop we trust, not the leftmost entry', async () => {
    // A client prepending a forged address must not become the bucketed key, which is exactly what
    // `trust proxy: true` would have allowed.
    const probe = express();
    probe.set('trust proxy', 2);
    probe.get('/ip', (req, res) => res.json({ ip: req.ip }));

    const res = await request(probe)
      .get('/ip')
      .set('X-Forwarded-For', '198.51.100.7, 203.0.113.9, 198.51.100.1');

    assert.equal(res.body.ip, '203.0.113.9');
    assert.notEqual(res.body.ip, '198.51.100.7', 'the leftmost, client-controlled entry must not be trusted');
  });
});

// A port conflict means the first listen callback never ran, so the scheduler was never started.
// The process then served traffic happily while rent invoicing stayed stopped until the next deploy.
describe('the invoice scheduler survives a port-conflict recovery', () => {
  function withSchedulerEnabled(fn) {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFlag = process.env.INVOICE_SCHEDULER_ENABLED;
    // The scheduler self-disables under NODE_ENV=test so it cannot race test fixtures.
    process.env.NODE_ENV = 'development';
    process.env.INVOICE_SCHEDULER_ENABLED = 'true';
    try {
      return fn();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevFlag === undefined) delete process.env.INVOICE_SCHEDULER_ENABLED;
      else process.env.INVOICE_SCHEDULER_ENABLED = prevFlag;
    }
  }

  it('starting twice does not create a second interval', () => {
    withSchedulerEnabled(() => {
      const first = startInvoiceScheduler();
      assert.ok(first, 'expected the scheduler to start');
      const second = startInvoiceScheduler();
      assert.equal(second, first, 'a second start must return the live timer, not create another one');
      stopInvoiceScheduler();
    });
  });

  it('stopping releases the scheduler so a later start creates a fresh timer', () => {
    withSchedulerEnabled(() => {
      const first = startInvoiceScheduler();
      stopInvoiceScheduler();
      const second = startInvoiceScheduler();
      assert.notEqual(second, first, 'stop must clear the timer so a restart can take effect');
      stopInvoiceScheduler();
    });
  });
});

// Reconciliation used to dedup on reference + tenant + amount, and `reference` itself fell back to the
// tenant name. Two identical cash payments — same tenant, same amount, no reference — therefore
// rejected the second as a duplicate and discarded real rent that had actually been handed over.
describe('reconciliation does not discard genuine repeat payments', () => {
  async function premiumFixture() {
    const landlord = await seedLandlord({ name: 'Repeat Landlord', subscription: { plan: 'premium' } });
    const property = await seedProperty(landlord.user.id, { name: 'Repeat Flats' });
    const tenant = await seedTenant(property.id, { name: 'Jane Doe', monthly_rent: 10000 });
    const invoice = await seedInvoice(tenant.id, property.id, {
      invoice_number: 'INV-REPEAT-1',
      amount: 10000,
      status: 'pending',
    });
    return { landlord, property, tenant, invoice };
  }

  function reconcile(token, property, body) {
    return request(app)
      .post('/api/reconciliation/reconcile')
      .set(auth(token))
      .send({ property_id: property.id, tenant_name: 'Jane Doe', ...body });
  }

  it('records two identical payments that carry no reference at all', async () => {
    const { landlord, property, invoice } = await premiumFixture();
    const cash = { amount: 5000, payment_method: 'cash' };

    const first = await reconcile(landlord.token, property, cash);
    assert.equal(first.status, 201, `first payment was rejected: ${JSON.stringify(first.body)}`);

    const second = await reconcile(landlord.token, property, cash);
    assert.equal(second.status, 201, 'the second identical payment must be recorded, not discarded as a duplicate');

    const payments = await pool.query(
      'SELECT amount FROM payments WHERE invoice_id = $1 ORDER BY id',
      [invoice.id]
    );
    assert.equal(payments.rows.length, 2, 'both payments must exist');
    assert.deepEqual(payments.rows.map((r) => Number(r.amount)), [5000, 5000]);
  });

  it('settles the invoice once both halves of rent are recorded', async () => {
    const { landlord, property, invoice } = await premiumFixture();
    const cash = { amount: 5000, payment_method: 'cash' };

    await reconcile(landlord.token, property, cash).expect(201);
    await reconcile(landlord.token, property, cash).expect(201);

    // With the old heuristic the second payment was refused, leaving the invoice short at 5,000.
    const row = await pool.query('SELECT status FROM invoices WHERE id = $1', [invoice.id]);
    assert.equal(row.rows[0].status, 'paid');
  });

  it('still records one payment once when the same reference is submitted twice', async () => {
    const { landlord, property, invoice } = await premiumFixture();
    const body = { amount: 5000, payment_method: 'bank_transfer', transaction_ref: 'MPESA-XYZ-1' };

    await reconcile(landlord.token, property, body).expect(201);
    const retry = await reconcile(landlord.token, property, body);
    assert.equal(retry.status, 409, 'a repeated reference is a retry of one payment, not a second one');

    const payments = await pool.query('SELECT COUNT(*)::int AS c FROM payments WHERE invoice_id = $1', [invoice.id]);
    assert.equal(payments.rows[0].c, 1, 'a retried reference must not be counted twice');
  });

  it('records two same-amount payments that carry different references', async () => {
    const { landlord, property } = await premiumFixture();

    await reconcile(landlord.token, property, {
      amount: 5000, payment_method: 'bank_transfer', transaction_ref: 'MPESA-A',
    }).expect(201);
    await reconcile(landlord.token, property, {
      amount: 5000, payment_method: 'bank_transfer', transaction_ref: 'MPESA-B',
    }).expect(201);

    const payments = await pool.query('SELECT COUNT(*)::int AS c FROM payments');
    assert.equal(payments.rows[0].c, 2);
  });

  it('leaves the duplicate audit trail when a reference is retried', async () => {
    const { landlord, property } = await premiumFixture();
    const body = { amount: 5000, payment_method: 'bank_transfer', transaction_ref: 'MPESA-DUPE' };

    await reconcile(landlord.token, property, body).expect(201);
    await reconcile(landlord.token, property, body).expect(409);

    const events = await pool.query(
      "SELECT COUNT(*)::int AS c FROM payment_reconciliation_events WHERE match_status = 'duplicate'"
    );
    assert.equal(events.rows[0].c, 1, 'the refused retry should still leave a duplicate audit event');
  });
});
