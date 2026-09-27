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
- `POST /api/invoices/generate` — (landlord/admin) auto-generate next month's rent invoices for the caller's ACTIVE tenants on ACTIVE properties; idempotent (skips periods already billed), also flips unpaid pending invoices past their due date to `overdue`. Optional body `{ "month": "YYYY-MM" }` (defaults to next calendar month); `due_date` = the property's `rent_due_day`; `amount` = the tenant's `monthly_rent`; `invoice_number` = `INV-<tenantId>-<YYYYMM>`.
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

### Cron

- `POST /api/cron/invoices` — system-wide billing job: generates next month's invoices for every ACTIVE tenant (all owners) and flips unpaid `pending` invoices past their due date to `overdue`. Guarded by `x-cron-secret` (open when `CRON_SECRET` is unset); run it monthly via pg_cron / GitHub Actions / any external scheduler.

## Testing

Run against a separate test database (default `postgresql://postgres:postgres@localhost:5432/property_app_test`, override with `DATABASE_URL_TEST`):

    DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/property_app_test npm test

Note: test files share one test database, so the script runs them serially (`--test-concurrency=1`). Schema + migrations are applied automatically; PayHero HTTP is mocked in-process.

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

## Subscriptions (Rent Sync's own plans)

Rent Sync is a paid product, separate from the tenant rent it collects. Plans are quoted on the
marketing site and paid by **M-Pesa Send Money to 0790 325 943** — not Lipa na M-PESA, so there is
no till, no paybill, and no paybill number to look up.

Because a Send Money transfer records no reference we can read, nothing about it can be automated
safely. A landlord signs up, reads the instructions, pays, and pastes the confirmation code from
their M-Pesa SMS into the paywall. An admin then checks that code against the statement by hand
and switches the account on.

**Every day-to-day operation:**

```bash
cd property-app/backend

# What is waiting to be checked?
node scripts/activate-subscription.js --list

# Checked it against the statement and it is there? Switch them on.
node scripts/activate-subscription.js ruth@example.com premium --code QJG7X2M4KL

# Non-standard unit count, suspend, or bring back
node scripts/activate-subscription.js ruth@example.com premium --units 120
node scripts/activate-subscription.js ruth@example.com --suspend
node scripts/activate-subscription.js ruth@example.com --reactivate
```

Activation takes effect on that user's **next request** — there is no need to get them to sign in
again, because `requireAuth` reads `subscription_status` from the live users row rather than from
the JWT.

**Endpoints.** `/api/billing/*` is deliberately mounted *without* `requirePaid`: a locked-out
landlord still has to be able to find out what they owe and hand over their code. Everything else
under `/api` answers **402 Payment Required** until the subscription is active.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/billing/me` | Status, plan, amount, pending claims, payment instructions |
| `POST /api/billing/request` | Record a claim. **Grants nothing** — it writes to `payment_requests` for an admin to check |

A claim never activates an account, and one M-Pesa confirmation code can only have one *pending*
claim (a partial unique index enforces it), so a single payment cannot switch on two accounts.

**Grandfathering.** Migration `010` adds the columns with `DEFAULT 'active'` so every pre-existing
account keeps working, then moves the default to `'unpaid'` so every *new* signup is locked. That
ordering is the whole trick — do not "simplify" it into a single `DEFAULT 'unpaid'`, which would
lock out every current landlord on the next deploy.

## Notes

This is now a stronger starting point for the property-management app. The next natural extensions are role-based admin access, richer invoice/payment logic, and a UI layer that calls these endpoints.
