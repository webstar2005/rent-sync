// Shared test bootstrap for the backend (node:test + supertest + a real test Postgres).
//
// The test DB is whatever DATABASE_URL resolves to BY THE TIME app.js is imported — the helper
// sets DATABASE_URL to the test database before dynamically importing the app, so the pool inside
// src/config/db.js binds to it (dotenv runs with override:false, so our env wins over .env files).
//
// Requires a reachable Postgres (e.g. `createdb property_app_test`). Schema (schema.sql + all
// migrations) is applied on demand via applySchema().

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/property_app_test';
process.env.PAYHERO_AUTH_TOKEN = process.env.PAYHERO_AUTH_TOKEN || 'test-payhero-token';
process.env.PAYHERO_ACCOUNT_ID = process.env.PAYHERO_ACCOUNT_ID || '5000';
process.env.PAYHERO_WEBHOOK_SECRET = process.env.PAYHERO_WEBHOOK_SECRET || 'test-webhook-secret';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
process.env.PAYHERO_LOW_BALANCE_ALERT = '500';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { app, pool } = await import('../src/app.js');
const { signToken } = await import('../src/utils/auth.js');
const payhero = await import('../src/services/payhero.js');

function databaseDir(...parts) {
  return path.resolve(__dirname, '..', 'database', ...parts);
}

// Apply schema.sql (only on a fresh database — its triggers are not idempotent) then every
// migration. Migrations are written to be re-runnable, so subsequent runs only need those.
// Safe to call repeatedly.
export async function applySchema() {
  const exists = await pool.query(`SELECT to_regclass('public.users') IS NOT NULL AS e`);
  const files = [];
  if (!exists.rows[0].e) {
    files.push(databaseDir('schema.sql'));
  }
  files.push(
    ...fs
      .readdirSync(databaseDir('migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => databaseDir('migrations', f))
  );

  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await pool.query(sql);
  }
}

// Wipe all domain tables (cascade handles FKs) for a clean slate per test.
export async function resetDb() {
  await pool.query(
    `TRUNCATE payhero_callback_log, payments, payment_reconciliation_events, payment_channels,
     invoices, tenants, properties, maintenance_requests, property_members, users
     RESTART IDENTITY CASCADE`
  );
}

export async function closeDb() {
  await pool.end();
}

// ---- Seed helpers ----

export async function seedLandlord({ name = 'Landlord A', email, role = 'landlord' } = {}) {
  const emailValue = email || `${name.toLowerCase().replace(/\s+/g, '_')}@test.local`;
  const user = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, emailValue, bcrypt.hashSync('password'), role]
  );
  const u = user.rows[0];
  return { user: u, token: signToken({ sub: u.id, email: u.email, role: u.role, name: u.name }) };
}

export async function seedProperty(ownerId, { name = 'Test Property', address = '100 Kenyatta Avenue' } = {}) {
  const row = await pool.query(
    `INSERT INTO properties (owner_id, name, address, units, rent_due_day) VALUES ($1, $2, $3, 4, 5) RETURNING *`,
    [ownerId, name, address]
  );
  return row.rows[0];
}

export async function seedTenant(propertyId, { name = 'Jane Doe', phone = '0700111222', unit_number = 'A1', monthly_rent = 10000, status = 'active' } = {}) {
  const row = await pool.query(
    `INSERT INTO tenants (property_id, name, phone, unit_number, monthly_rent, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [propertyId, name, phone, unit_number, monthly_rent, status]
  );
  return row.rows[0];
}

export async function seedInvoice(tenantId, propertyId, { invoice_number, amount = 10000, status = 'pending', due_date = '2026-10-01' } = {}) {
  const row = await pool.query(
    `INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, propertyId, invoice_number, amount, due_date, status]
  );
  return row.rows[0];
}

export async function seedPayment(ownerId, tenantId, invoiceId, { amount = 4000, payment_method = 'mobile_money', reference = null, transaction_ref = null, status = 'completed', paid_at = new Date(), matched = true, payment_channel_id = null } = {}) {
  const row = await pool.query(
    `INSERT INTO payments (owner_id, tenant_id, invoice_id, amount, payment_method, reference, transaction_ref, status, paid_at, matched, payment_channel_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [ownerId, tenantId, invoiceId, amount, payment_method, reference ?? null, transaction_ref ?? null, status, paid_at, matched, payment_channel_id]
  );
  return row.rows[0];
}

export async function seedChannel(ownerId, { channel_type = 'paybill', short_code = '522522', account_number = null, description = 'Test channel', is_active = true, verification_status = 'active', payhero_channel_id = null } = {}) {
  const row = await pool.query(
    `INSERT INTO payment_channels (owner_id, channel_type, short_code, account_number, payhero_channel_id, description, is_active, verification_status, payhero_meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}') RETURNING *`,
    [ownerId, channel_type, short_code, account_number, payhero_channel_id, description, is_active, verification_status]
  );
  return row.rows[0];
}

// Standard PayHero callback body for tests. `channelIdentifier` lets us inject a channel id/short
// code the way the resolver expects (current PayHero callbacks may not carry one — covered in tests).
export function callbackBody({ amount = 1000, reference = 'INV-001', receipt, checkout, phone = '+254700111222', result_code = 0, result_desc = 'The service request is processed successfully.', extra = {} }) {
  const receiptValue = receipt || `SAE${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const body = {
    forward_url: '',
    status: true,
    response: {
      Amount: amount,
      CheckoutRequestID: checkout || `ws_CO_${Date.now()}`,
      ExternalReference: reference,
      MerchantRequestID: `3202-${Date.now()}`,
      MpesaReceiptNumber: receiptValue,
      Phone: phone,
      ResultCode: result_code,
      ResultDesc: result_desc,
      Status: result_code === 0 ? 'Success' : 'Failed',
      ...extra,
    },
  };
  return { body, receipt: receiptValue };
}

// Injectable PayHero HTTP mock. Keeps its own channel registry so register/create + sync share state.
export function makePayHeroMock({ channels = [], wallet = { id: 1, account_id: 5000, wallet_type: 'service_wallet', currency: 'KES', available_balance: 15000 } } = {}) {
  const registry = [...channels];
  return async (url, options = {}) => {
    const u = String(url);
    const method = options.method || 'GET';

    if (u.endsWith('/payment_channels') && method === 'GET') {
      return jsonResponse({
        payment_channels: registry,
        pagination: { count: registry.length, page: 1, per: 20, num_pages: 1, next_page: null, prev_page: null },
      });
    }
    if (u.endsWith('/payment_channels') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const id = registry.length ? Math.max(...registry.map((c) => Number(c.id))) + 1 : 5000;
      const created = {
        id,
        transaction_type: body.channel_type === 'bank' ? 'BankPayBillOnline' : 'CustomerPayBillOnline',
        channel_type: body.channel_type,
        account_id: body.account_id,
        short_code: String(body.short_code),
        account_number: body.account_number || null,
        description: body.description || null,
        is_active: false,
        balance_plain: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      registry.push(created);
      return jsonResponse(created);
    }
    if (u.includes('/wallets')) {
      return jsonResponse(wallet);
    }

    return jsonResponse({ error_message: 'not found' }, 404);
  };
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  };
}

export function setPayHeroMock(mock) {
  payhero.__setPayHeroHttp(mock);
}

export { app, pool, payhero, signToken };