-- Removes the per-property M-Pesa/bank payment settings — collection is now handled at account
-- level through PayHero payment channels (backend/database/schema.sql no longer defines this table).
-- Idempotent: safe on databases that were created fresh from the current schema.sql.
DROP TABLE IF EXISTS property_payment_settings;