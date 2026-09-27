-- Subscription gate: Rent Sync is a paid product.
--
-- Plans are bought by M-Pesa Send Money to the business phone number and switched on by hand
-- (scripts/activate-subscription.js) after the payer quotes the confirmation code from their
-- M-Pesa SMS. This records that state on the user row; src/middleware/subscription.js enforces it.
--
-- GRANDFATHERING is the entire point of the three-step default dance below. Adding the column
-- with DEFAULT 'active' backfills every row that already exists as active, so nobody who has
-- already entered properties and tenants loses access to their own data the moment this runs.
-- Only once that backfill is done is the default moved to 'unpaid' - which is what every future
-- INSERT gets. Adding the column straight as DEFAULT 'unpaid' would have locked out every
-- current landlord on the next deploy.
--
-- Idempotent, and safe on a database already created from the current schema.sql.

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS units_limit INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- Rows that predate activated_at get their signup time, so "active since" is never blank for
-- a grandfathered account.
UPDATE users SET activated_at = created_at WHERE activated_at IS NULL AND subscription_status = 'active';

-- Every signup from here on starts locked.
ALTER TABLE users ALTER COLUMN subscription_status SET DEFAULT 'unpaid';

-- The CHECK lives inside schema.sql's CREATE TABLE, so add it separately and only when missing,
-- or this fails on a database that already has it. Same guard as 009.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%subscription_status%'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_subscription_status_check
      CHECK (subscription_status IN ('unpaid', 'active', 'suspended'));
  END IF;
END
$$;

-- What a payer claims to have sent. A Send Money transfer records no reference we can read, so
-- the confirmation code from their SMS is the only thing tying a transaction to an account; this
-- table is the admin's queue for checking those codes against the statement by hand.
CREATE TABLE IF NOT EXISTS payment_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  mpesa_confirmation_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One pending claim per confirmation code. The codes are the only evidence, so letting two
-- accounts claim the same code would let one payment switch on two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_pending_code
  ON payment_requests (mpesa_confirmation_code) WHERE status = 'pending';

-- The admin queue reads pending rows newest-first.
CREATE INDEX IF NOT EXISTS idx_payment_requests_pending
  ON payment_requests (created_at DESC) WHERE status = 'pending';
