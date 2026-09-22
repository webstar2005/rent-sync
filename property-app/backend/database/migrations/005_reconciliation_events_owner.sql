-- LOW finding: reconciliation events with a NULL invoice_id (unmatched tenant / manual review /
-- duplicate) were invisible in the dashboard because the alerts/summary queries joined invoices
-- (INNER/LEFT JOIN + WHERE p.owner_id). Stamping the owner_id on the event makes those rows
-- attributable to the correct landlord and lets the queries surface them.
ALTER TABLE payment_reconciliation_events ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reconciliation_events_owner_created ON payment_reconciliation_events (owner_id, created_at DESC);