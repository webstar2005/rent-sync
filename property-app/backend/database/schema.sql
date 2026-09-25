-- Core user model
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'landlord' CHECK (role IN ('admin', 'manager', 'landlord', 'tenant')),
  auth_provider TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local', 'google')),
  google_sub TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (google_sub)
);

-- Properties owned or managed by a user
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  units INTEGER NOT NULL DEFAULT 1,
  rent_due_day INTEGER NOT NULL DEFAULT 5 CHECK (rent_due_day BETWEEN 1 AND 28),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenants assigned to a property/unit
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  unit_number TEXT NOT NULL,
  monthly_rent NUMERIC(10,2) NOT NULL DEFAULT 0,
  lease_start DATE,
  lease_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'moved_out', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices generated for rent or other charges
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PayHero payment channels — one row per landlord-owned channel (Paybill / Till / Bank / Send Money).
-- Scoped to the owner (landlord) user; never hard-deleted once it has payment history — deactivate instead.
-- 'send_money' rows are local-only (PayHero has no such channel_type) and hold the landlord's
-- receiving number in short_code, normalized to its last 9 digits. See migrations/006.
CREATE TABLE IF NOT EXISTS payment_channels (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('paybill', 'till', 'bank', 'send_money')),
  short_code TEXT NOT NULL,
  account_number TEXT,
  payhero_channel_id TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'active', 'inactive', 'failed')),
  payhero_meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, short_code, channel_type)
);

-- Payment receipts or transactions against invoices
-- invoice_id / tenant_id are NULLABLE so unmatched PayHero payments are never dropped
-- (they are still attributed to the landlord via owner_id and flagged matched=false).
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'mobile_money', 'cash', 'card', 'other')),
  reference TEXT,
  transaction_ref TEXT UNIQUE,
  phone_number TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  matched BOOLEAN NOT NULL DEFAULT TRUE,
  payment_channel_id INTEGER REFERENCES payment_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raw PayHero callbacks — logged BEFORE any processing; nothing is ever lost.
CREATE TABLE IF NOT EXISTS payhero_callback_log (
  id SERIAL PRIMARY KEY,
  raw_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'duplicate', 'unmatched_channel', 'unmatched_tenant', 'failed', 'ignored')),
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

-- Raw payment callbacks and reconciliation attempts for audit and review
CREATE TABLE IF NOT EXISTS payment_reconciliation_events (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'mobile_money',
  transaction_ref TEXT,
  payment_channel_id INTEGER REFERENCES payment_channels(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'unmatched', 'duplicate', 'manual_review', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance issues submitted by tenants or staff
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional support for property staff assignments
CREATE TABLE IF NOT EXISTS property_members (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'accountant', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, user_id)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref ON payments(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_channel_id ON payments(payment_channel_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_invoice_id ON payment_reconciliation_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_transaction_ref ON payment_reconciliation_events(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_reconciliation_events_owner_created ON payment_reconciliation_events (owner_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_channels_payhero_channel_id ON payment_channels(payhero_channel_id) WHERE payhero_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_channels_owner_id ON payment_channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_payment_channels_short_code ON payment_channels(short_code);
CREATE INDEX IF NOT EXISTS idx_payment_channels_send_money_phone ON payment_channels (RIGHT(regexp_replace(short_code, '[^0-9]', '', 'g'), 9)) WHERE channel_type = 'send_money' AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_payhero_callback_log_status ON payhero_callback_log(status);
CREATE INDEX IF NOT EXISTS idx_payhero_callback_log_transaction_ref ON payhero_callback_log(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_payhero_callback_log_created_at ON payhero_callback_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_property_id ON maintenance_requests(property_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER properties_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payment_channels_updated_at
BEFORE UPDATE ON payment_channels
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER maintenance_updated_at
BEFORE UPDATE ON maintenance_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
