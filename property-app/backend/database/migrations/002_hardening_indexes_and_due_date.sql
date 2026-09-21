-- Hardening: dashboard indexes + rent_due_day (landlord dictates per property) + moved-out/archived integrity
-- Run: psql $DATABASE_URL -f database/migrations/002_hardening_indexes_and_due_date.sql
-- Idempotent — safe to re-run

-- 1. Property rent due day (1-28) — auto-invoice uses this, not manual Create invoice
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_due_day INTEGER DEFAULT 5 CHECK (rent_due_day BETWEEN 1 AND 28);

-- 2. Indexes for common dashboard queries (11.7 reporting, App.tsx loadProperties)
-- Tenants: filtered by property, status, unit_number (duplicate checks), search
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_number ON tenants(unit_number);
CREATE INDEX IF NOT EXISTS idx_tenants_property_status ON tenants(property_id, status);
CREATE INDEX IF NOT EXISTS idx_tenants_phone ON tenants(phone);

-- Invoices: recent by property, by tenant, overdue scan, property+status for collection rate
CREATE INDEX IF NOT EXISTS idx_invoices_property_id ON invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_property_status ON invoices(property_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Payments: tenant history, paid_at, property via join, status
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_property_via_invoice ON payments(invoice_id, tenant_id);

-- Maintenance: property + tenant + status for triage
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON maintenance_requests(priority);
CREATE INDEX IF NOT EXISTS idx_maintenance_property_status ON maintenance_requests(property_id, status);

-- Property members
CREATE INDEX IF NOT EXISTS idx_property_members_user_id ON property_members(user_id);

-- Reconciliation: match_status filter for alerts
CREATE INDEX IF NOT EXISTS idx_reconciliation_match_status ON payment_reconciliation_events(match_status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_created_at ON payment_reconciliation_events(created_at DESC);

-- Comment: moved-out/archived tenants must keep history — we never DELETE on status change, only UPDATE status
-- Invoices/payments use ON DELETE CASCADE only for hard DELETE (rare), not for status transitions
-- Dashboard queries filter status='active' for occupancy, but recent invoices/payments still show history
