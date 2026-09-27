// The subscription gate: who gets in, who does not, and how someone gets let in.
//
// The properties of this gate that matter, and that these tests exist to pin down:
//   - a NEW signup starts locked (the users column default is 'unpaid')
//   - an account that predates the gate keeps working (migration 010 backfills 'active')
//   - a locked account can still reach /api/billing, or it could never pay
//   - submitting a confirmation code does NOT grant access
//   - one confirmation code cannot switch on two accounts
//   - an admin is never locked out of the tool used to switch people on

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { app, pool, applySchema, resetDb, seedLandlord, closeDb } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.before(async () => {
  await applySchema();
});

test.after(async () => {
  await closeDb();
});

test.beforeEach(async () => {
  await resetDb();
});

test('a newly registered account is locked out of the product', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'New Landlord', email: 'new@test.local', password: 'password123' })
    .expect(201);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'new@test.local', password: 'password123' })
    .expect(200);
  const token = login.body.token;

  // The product is closed...
  const blocked = await request(app)
    .get('/api/properties')
    .set('Authorization', `Bearer ${token}`)
    .expect(402);

  assert.equal(blocked.body.code, 'subscription_required');
  assert.equal(blocked.body.subscription.status, 'unpaid');

  // ...but the way out is open.
  const me = await request(app)
    .get('/api/billing/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(me.body.subscription.status, 'unpaid');
  assert.equal(me.body.billing.phoneDisplay, '0790 325 943');
  assert.ok(me.body.plans.length >= 3);
});

test('new rows default to locked, and re-running the migration spares existing accounts', async () => {
  // The mechanism that locks new signups is the column default, so assert it directly rather than
  // inferring it: if this ever drifts to 'active', every future signup is free.
  const col = await pool.query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'subscription_status'`
  );
  assert.match(col.rows[0].column_default, /'unpaid'/);

  // A row shaped the way migration 010 leaves an account that predates the gate.
  const inserted = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, subscription_status, plan, units_limit, activated_at)
     VALUES ('Old Landlord', 'old@test.local', 'x', 'landlord', 'active', 'standard', 50, NOW())
     RETURNING id`
  );

  // Re-applying the migration must not knock that account back to 'unpaid'. Migrations are written
  // to be re-runnable and apply-migrations.js replays all of them, so this is a real scenario.
  const migration = fs.readFileSync(
    path.resolve(__dirname, '..', 'database', 'migrations', '010_user_subscription.sql'),
    'utf8'
  );
  await pool.query(migration);

  const after = await pool.query(`SELECT subscription_status, activated_at FROM users WHERE id = $1`, [
    inserted.rows[0].id,
  ]);
  assert.equal(after.rows[0].subscription_status, 'active');
  assert.ok(after.rows[0].activated_at, 'a grandfathered account still has an "active since" date');
});

test('a paid account reaches the product', async () => {
  const { token } = await seedLandlord({ name: 'Paid Landlord' });
  await request(app).get('/api/properties').set('Authorization', `Bearer ${token}`).expect(200);
});

test('an admin is never locked out, even with no subscription', async () => {
  const { token } = await seedLandlord({
    name: 'Admin',
    role: 'admin',
    subscription: { status: 'unpaid' },
  });
  await request(app).get('/api/properties').set('Authorization', `Bearer ${token}`).expect(200);
});

test('a suspended account is closed with a different message', async () => {
  const { token } = await seedLandlord({
    name: 'Suspended',
    subscription: { status: 'suspended' },
  });
  const res = await request(app)
    .get('/api/properties')
    .set('Authorization', `Bearer ${token}`)
    .expect(402);
  assert.match(res.body.message, /suspended/i);
});

// ---- the payment claim ----

test('submitting a confirmation code records a claim but grants nothing', async () => {
  const { token } = await seedLandlord({
    name: 'Claimer',
    subscription: { status: 'unpaid' },
  });

  const res = await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ plan: 'premium', mpesa_confirmation_code: 'QJG7X2M4KL9RT' })
    .expect(201);

  assert.equal(res.body.request.plan, 'premium');
  assert.equal(res.body.request.amount, 6500);

  // The whole point: a claim is not a payment.
  await request(app).get('/api/properties').set('Authorization', `Bearer ${token}`).expect(402);

  const user = await pool.query(`SELECT subscription_status FROM users WHERE name = 'Claimer'`);
  assert.equal(user.rows[0].subscription_status, 'unpaid');
});

test('one confirmation code cannot be claimed by two accounts', async () => {
  const a = await seedLandlord({ name: 'First', subscription: { status: 'unpaid' } });
  const b = await seedLandlord({ name: 'Second', subscription: { status: 'unpaid' } });
  const code = 'SHAREDCODE123';

  await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ plan: 'basic', mpesa_confirmation_code: code })
    .expect(201);

  const second = await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${b.token}`)
    .send({ plan: 'basic', mpesa_confirmation_code: code })
    .expect(409);

  assert.match(second.body.message, /already been submitted/i);
});

test('a rejected claim frees the code to be submitted again', async () => {
  const a = await seedLandlord({ name: 'First', subscription: { status: 'unpaid' } });
  const code = 'REUSEME12345';

  await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ plan: 'basic', mpesa_confirmation_code: code })
    .expect(201);

  await pool.query(`UPDATE payment_requests SET status = 'rejected', reviewed_at = NOW()`);

  const b = await seedLandlord({ name: 'Second', subscription: { status: 'unpaid' } });
  await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${b.token}`)
    .send({ plan: 'basic', mpesa_confirmation_code: code })
    .expect(201);
});

test('a bad plan or a missing code is rejected', async () => {
  const { token } = await seedLandlord({ name: 'Sloppy', subscription: { status: 'unpaid' } });

  await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ plan: 'platinum', mpesa_confirmation_code: 'ABC123456' })
    .expect(400);

  await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ plan: 'basic', mpesa_confirmation_code: 'short' })
    .expect(400);
});

test('enterprise cannot be self-served, because it has no fixed amount', async () => {
  const { token } = await seedLandlord({ name: 'Big', subscription: { status: 'unpaid' } });
  const res = await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ plan: 'enterprise', mpesa_confirmation_code: 'ENTCODE1234' })
    .expect(400);
  assert.match(res.body.message, /priced individually/i);
});

test('an already-active account cannot queue a pointless claim', async () => {
  const { token } = await seedLandlord({ name: 'Happy' });
  const res = await request(app)
    .post('/api/billing/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ plan: 'basic', mpesa_confirmation_code: 'ALREADY12345' })
    .expect(409);
  assert.match(res.body.message, /already active/i);
});

// ---- what the admin CLI does ----

test('activating an account unlocks it on the next request, with no new sign-in', async () => {
  const { user, token } = await seedLandlord({ name: 'Pending', subscription: { status: 'unpaid' } });

  await request(app).get('/api/properties').set('Authorization', `Bearer ${token}`).expect(402);

  // What scripts/activate-subscription.js runs.
  await pool.query(
    `UPDATE users
     SET subscription_status = 'active', plan = 'premium', units_limit = 100,
         activated_at = NOW(), payment_reference = 'ABC123', payment_confirmed_at = NOW()
     WHERE id = $1`,
    [user.id]
  );

  // Same token. No re-login, because the status is read from the live row, not the JWT.
  await request(app).get('/api/properties').set('Authorization', `Bearer ${token}`).expect(200);
});

test('billing endpoints require a sign-in even though they are not paywalled', async () => {
  await request(app).get('/api/billing/me').expect(401);
  await request(app).post('/api/billing/request').send({ plan: 'basic' }).expect(401);
});
