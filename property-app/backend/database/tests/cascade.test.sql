-- Cascade + moved-out/archived integrity checks (run after seed)
-- psql $DATABASE_URL -f database/tests/cascade.test.sql
-- Should not modify prod — use dev/staging copy

\echo '1. Property delete cascades to tenants/invoices/payments/maintenance (expected: child rows gone)'
-- Count before
SELECT 'tenants before' as test, count(*) FROM tenants WHERE property_id = 1;
SELECT 'invoices before' as test, count(*) FROM invoices WHERE property_id = 1;

-- Dry-run: show what would be deleted (do not actually delete in prod)
SELECT 'property 1 would delete' as test,
  (SELECT count(*) FROM tenants WHERE property_id=1) as tenants,
  (SELECT count(*) FROM invoices WHERE property_id=1) as invoices,
  (SELECT count(*) FROM maintenance_requests WHERE property_id=1) as maintenance;

\echo '2. Tenant delete cascades to invoices/payments (FK ON DELETE CASCADE) — but moved_out should NOT delete'
SELECT 'tenant 3 (moved_out) invoices before' as test, count(*) FROM invoices WHERE tenant_id=3;
-- If we DELETE tenant 3, its invoices should cascade delete (history lost) — so we must NOT delete on moved_out, only UPDATE status
-- Correct flow: UPDATE tenants SET status=''moved_out'' WHERE id=3 — then:
SELECT 'after status moved_out, tenant still exists' as test, count(*) FROM tenants WHERE id=3 AND status='moved_out';
SELECT 'invoices still exist after moved_out' as test, count(*) FROM invoices WHERE tenant_id=3;
SELECT 'payments still exist after moved_out' as test, count(*) FROM payments WHERE tenant_id=3;

\echo '3. Invoice delete cascades to payments (ON DELETE CASCADE)'
SELECT 'payments for invoice 1 before' as test, count(*) FROM payments WHERE invoice_id=1;
-- DELETE invoice 1 would delete its payments — verify

\echo '4. Maintenance tenant SET NULL — deleting tenant should keep maintenance with tenant_id NULL'
SELECT 'maintenance with tenant 1 before' as test, count(*) FROM maintenance_requests WHERE tenant_id=1;

\echo '5. Moved-out/archived not counted as active (dashboard filter)'
SELECT 'active tenants' as test, count(*) FROM tenants WHERE status='active';
SELECT 'moved_out' as test, count(*) FROM tenants WHERE status='moved_out';
SELECT 'archived' as test, count(*) FROM tenants WHERE status='archived';
-- Dashboard propertySummaries does: tenants.filter(status==='active') — so moved_out/archived excluded but history kept in invoices/payments

\echo 'All checks are SELECT-only — no data modified. For destructive cascade test, run in a transaction and ROLLBACK:'
\echo 'BEGIN; DELETE FROM properties WHERE id=1; SELECT count(*) FROM tenants WHERE property_id=1; ROLLBACK;'
