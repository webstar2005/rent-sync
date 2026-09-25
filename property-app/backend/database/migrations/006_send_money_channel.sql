-- PayHero "Send Money" receiving numbers (PLAN.md 11.4)
-- A tenant can pay rent by sending money straight to the landlord's mobile-money number instead of
-- paying a Paybill/Till. PayHero's registration API has no channel_type for this (paybill/till/bank
-- only), so these rows are stored locally and never sent to POST /payment_channels.
-- short_code holds the landlord's receiving number reduced to its last 9 digits, which is the same
-- form normalizePhone() produces, so callback matching can compare like-for-like.
-- Idempotent — safe to re-run. Run: psql $DATABASE_URL -f database/migrations/006_send_money_channel.sql

ALTER TABLE payment_channels DROP CONSTRAINT IF EXISTS payment_channels_channel_type_check;

ALTER TABLE payment_channels
  ADD CONSTRAINT payment_channels_channel_type_check
  CHECK (channel_type IN ('paybill', 'till', 'bank', 'send_money'));

-- Callback matching: normalize the stored number the same way the payload phone is normalized, so a
-- 0712…/254712…/+254712… entry and a 712… callback value all collapse to the same 9 digits.
CREATE INDEX IF NOT EXISTS idx_payment_channels_send_money_phone
  ON payment_channels (RIGHT(regexp_replace(short_code, '[^0-9]', '', 'g'), 9))
  WHERE channel_type = 'send_money' AND is_active = TRUE;
