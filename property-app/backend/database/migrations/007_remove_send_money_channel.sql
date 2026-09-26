-- Revert 006_send_money_channel.sql — Send Money is no longer supported.
--
-- PayHero's documented payment callback (docs.payhero.co.ke/docs/payment-callback) carries only
-- `Phone`, which is the PAYER's number; there is no recipient field. Callbacks are also per-channel,
-- fired for payments we initiate against a registered Paybill/Till/Bank, so a tenant sending money
-- to a landlord's personal M-Pesa number produces no callback at all. Matching such a payment would
-- have been impossible, not merely unverified, so the channel type is removed rather than left in a
-- state that could never match.
--
-- Rows are deleted because a CHECK constraint is validated against existing rows, so the rows must
-- go before the constraint can be narrowed. There is no payment history to preserve: only test rows
-- ever existed and no PayHero callback had been received.
--
-- Idempotent — safe to re-run. Run: psql $DATABASE_URL -f database/migrations/007_remove_send_money_channel.sql

DELETE FROM payment_channels WHERE channel_type = 'send_money';

DROP INDEX IF EXISTS idx_payment_channels_send_money_phone;

ALTER TABLE payment_channels DROP CONSTRAINT IF EXISTS payment_channels_channel_type_check;

ALTER TABLE payment_channels
  ADD CONSTRAINT payment_channels_channel_type_check
  CHECK (channel_type IN ('paybill', 'till', 'bank'));
