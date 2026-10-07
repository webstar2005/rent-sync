import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applySchema, resetDb, seedLandlord, seedChannel, pool, app } from './helpers.js';

// A landlord who added the wrong till should be able to take it back out, but not once money has
// been recorded against it: every reference from payments, reconciliation events and the callback
// log is ON DELETE SET NULL, so deleting a used channel would quietly drop the only link showing
// which till the money arrived on. Deletion is therefore for unused channels, and history is
// deactivated instead - the distinction these tests pin down.

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

let seq = 0;

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

describe('Deleting a payment channel', () => {
  it('removes a channel nothing is booked against', async () => {
    const L = await seedLandlord({ name: `C-${(seq += 1)}` });
    const channel = await seedChannel(L.user.id, { short_code: '555001' });

    await request(app).delete(`/api/payment-channels/${channel.id}`).set(auth(L.token)).expect(204);

    const res = await request(app).get('/api/payment-channels').set(auth(L.token)).expect(200);
    assert.equal(res.body.length, 0, 'the channel is gone from the list the dashboard reads');
  });

  it('refuses while a payment points at it, and says why', async () => {
    const L = await seedLandlord({ name: `C-${(seq += 1)}` });
    const channel = await seedChannel(L.user.id, { short_code: '555002' });
    await pool.query('INSERT INTO payments (owner_id, amount, payment_channel_id) VALUES ($1, $2, $3)', [
      L.user.id,
      2500,
      channel.id,
    ]);

    const res = await request(app)
      .delete(`/api/payment-channels/${channel.id}`)
      .set(auth(L.token))
      .expect(409);

    assert.equal(res.body.code, 'channel_has_history');
    assert.equal(res.body.payments, 1);
    assert.match(res.body.message, /deactivat/i, 'the refusal names the way out');

    const still = await pool.query('SELECT id FROM payment_channels WHERE id = $1', [channel.id]);
    assert.equal(still.rows.length, 1, 'the channel survives so the payment keeps its link to it');
  });

  it('refuses while a reconciliation event points at it', async () => {
    const L = await seedLandlord({ name: `C-${(seq += 1)}` });
    const channel = await seedChannel(L.user.id, { short_code: '555003' });
    await pool.query(
      `INSERT INTO payment_reconciliation_events (owner_id, payment_channel_id, match_status)
       VALUES ($1, $2, 'unmatched')`,
      [L.user.id, channel.id]
    );

    const res = await request(app)
      .delete(`/api/payment-channels/${channel.id}`)
      .set(auth(L.token))
      .expect(409);

    assert.equal(res.body.code, 'channel_has_history');
    assert.equal(res.body.events, 1);
  });

  it('will not let one landlord delete another landlord\'s channel', async () => {
    const A = await seedLandlord({ name: `C-${(seq += 1)}` });
    const B = await seedLandlord({ name: `C-${(seq += 1)}` });
    const channel = await seedChannel(B.user.id, { short_code: '555004' });

    await request(app).delete(`/api/payment-channels/${channel.id}`).set(auth(A.token)).expect(403);

    const still = await pool.query('SELECT id FROM payment_channels WHERE id = $1', [channel.id]);
    assert.equal(still.rows.length, 1, 'an ownership miss must not confirm whether the channel exists');
  });

  it('deactivates rather than deletes when asked to - the PATCH path stays the safe one', async () => {
    const L = await seedLandlord({ name: `C-${(seq += 1)}` });
    const channel = await seedChannel(L.user.id, { short_code: '555005' });

    await request(app)
      .patch(`/api/payment-channels/${channel.id}`)
      .set(auth(L.token))
      .send({ is_active: false })
      .expect(200);

    const res = await request(app).get('/api/payment-channels').set(auth(L.token)).expect(200);
    assert.equal(res.body.length, 1, 'deactivation keeps the row');
    assert.equal(res.body[0].is_active, false);
  });
});
