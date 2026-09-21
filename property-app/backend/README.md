# Property App Backend

A lightweight Node.js + Express + PostgreSQL backend for the property management app.

## Setup

1. Install dependencies:
   npm install
2. Copy the environment file:
   cp .env.example .env
3. Update the database URL in `.env`.
4. Start the API:
   npm run dev

## Main endpoints

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/properties`
- `POST /api/properties`
- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/invoices`
- `POST /api/invoices`
- `GET /api/payments`
- `POST /api/payments`
- `GET /api/maintenance`
- `POST /api/maintenance`

### PayHero payment channels (landlord-scoped)

- `GET /api/payment-channels` — list the caller's channels
- `POST /api/payment-channels` — register a channel with PayHero (body: `channel_type`={`paybill`|`till`|`bank`}, `short_code`, optional `account_number`, `description`)
- `PATCH /api/payment-channels/:id` — update `description` / `is_active` (deactivate; never hard-delete)
- `POST /api/payment-channels/:id/sync` — re-sync verification/activation status from PayHero
- `GET /api/payment-channels/wallet` — PayHero prepaid service-wallet balance with low-balance `low` flag

### PayHero webhook

- `POST /webhooks/payhero` — incoming payment callbacks from PayHero. Verify with `PAYHERO_WEBHOOK_SECRET` (`x-payhero-secret` header or `?secret=` query; fails closed in production), optional `PAYHERO_IP_ALLOWLIST`. Resolves the landlord by channel id / short code, then reference (invoice number) / strictly-unique phone. Unmatched money is always recorded against the channel owner (`matched=false`) for manual reconciliation; retried callbacks are deduped on `transaction_ref`.

## Testing

Run against a separate test database (default `postgresql://postgres:postgres@localhost:5432/property_app_test`, override with `DATABASE_URL_TEST`):

    npm test

Schema + migrations are applied automatically; PayHero HTTP is mocked in-process.

## Database schema

The backend expects a PostgreSQL database with the following core tables:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'landlord',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  units INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  unit_number TEXT NOT NULL,
  monthly_rent NUMERIC(10,2) NOT NULL DEFAULT 0,
  lease_start DATE,
  lease_end DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  transaction_ref TEXT UNIQUE,
  phone_number TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  matched BOOLEAN NOT NULL DEFAULT TRUE,
  payment_channel_id INTEGER REFERENCES payment_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_channels (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('paybill', 'till', 'bank')),
  short_code TEXT NOT NULL,
  account_number TEXT,
  payhero_channel_id TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  payhero_meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, short_code, channel_type)
);

CREATE TABLE payhero_callback_log (
  id SERIAL PRIMARY KEY,
  raw_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  payhero_channel_id TEXT,
  short_code TEXT,
  transaction_ref TEXT,
  matched_channel_id INTEGER REFERENCES payment_channels(id) ON DELETE SET NULL,
  matched_owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  matched_payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  matched_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  alerted BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_requests (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Notes

This is now a stronger starting point for the property-management app. The next natural extensions are role-based admin access, richer invoice/payment logic, and a UI layer that calls these endpoints.
