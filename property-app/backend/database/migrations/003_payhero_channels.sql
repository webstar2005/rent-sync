-- PayHero multi-channel payment collection (PLAN.md 11.4)
-- Landlord-scoped payment channels (Paybill / Till / Bank) + raw callback audit log.
-- Idempotent — safe to re-run. Run: psql $DATABASE_URL -f database/migrations/003_payhero_channels.sql

-- 1. payment_channels — one row per landlord-owned PayHero channel. Scoped to owner (landlord) user.
--    Never hard-delete once a channel has payment history — deactivate via is_active = false.
CREATE TABLE IF NOT EXISTS payment_channels (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('paybill', 'till', 'bank')),
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

-- 2. Raw PayHero callback audit — insert BEFORE any processing; nothing is ever lost.
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

-- 3. payments learn their channel + landlord; unmatched money is still recorded (never dropped).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_channel_id INTEGER REFERENCES payment_channels(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS matched BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id DROP NOT NULL;

-- 4. Reconciliation events also carry the channel id for audit.
ALTER TABLE payment_reconciliation_events ADD COLUMN IF NOT EXISTS payment_channel_id INTEGER REFERENCES payment_channels(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_channels_payhero_channel_id ON payment_channels(payhero_channel_id) WHERE payhero_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_channels_owner_id ON payment_channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_payment_channels_short_code ON payment_channels(short_code);
CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_channel_id ON payments(payment_channel_id);
CREATE INDEX IF NOT EXISTS idx_payhero_callback_log_status ON payhero_callback_log(status);
CREATE INDEX IF NOT EXISTS idx_payhero_callback_log_transaction_ref ON payhero_callback_log(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_payhero_callback_log_created_at ON payhero_callback_log(created_at DESC);

-- 6. Keep updated_at fresh (DROP first so the migration is safe to re-run)
DROP TRIGGER IF EXISTS payment_channels_updated_at ON payment_channels;
CREATE TRIGGER payment_channels_updated_at
BEFORE UPDATE ON payment_channels
FOR EACH ROW EXECUTE FUNCTION set_updated_at();