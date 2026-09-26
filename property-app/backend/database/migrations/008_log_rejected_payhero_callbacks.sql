-- Record REJECTED PayHero callbacks instead of dropping them into a bare 403.
--
-- A rejected callback is the only evidence of what PayHero actually sends us. Without this, an auth
-- failure and a provider-side failure are indistinguishable and the endpoint is permanently blind —
-- which is how the previous header-only scheme went unnoticed while being impossible to satisfy.
--
-- Idempotent — safe to re-run. Run: psql $DATABASE_URL -f database/migrations/008_log_rejected_payhero_callbacks.sql

ALTER TABLE payhero_callback_log DROP CONSTRAINT IF EXISTS payhero_callback_log_status_check;

ALTER TABLE payhero_callback_log
  ADD CONSTRAINT payhero_callback_log_status_check
  CHECK (status IN (
    'received', 'processed', 'duplicate', 'unmatched_channel', 'unmatched_tenant',
    'failed', 'ignored', 'rejected_auth'
  ));
