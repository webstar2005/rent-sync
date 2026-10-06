-- Migration 014: Units table for explicit unit management
-- Each property can have multiple units with detailed info, status, and tenant assignment

CREATE TABLE IF NOT EXISTS units (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  unit_type TEXT CHECK (unit_type IN ('bedsitter', '1_bedroom', '2_bedroom', '3_bedroom', 'commercial', 'other')),
  floor INTEGER,
  size_sqm NUMERIC(6,2),
  monthly_rent NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance', 'reserved')),
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_tenant_id ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

-- Trigger to keep updated_at fresh. Dropped first so the migration stays re-runnable.
DROP TRIGGER IF EXISTS units_updated_at ON units;
CREATE TRIGGER units_updated_at
BEFORE UPDATE ON units
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Backfill: create unit records from existing tenants
-- This ensures existing tenant unit_numbers become explicit unit records
INSERT INTO units (property_id, unit_number, monthly_rent, status, tenant_id, created_at)
SELECT
  t.property_id,
  t.unit_number,
  t.monthly_rent,
  CASE WHEN t.status = 'active' THEN 'occupied' ELSE 'vacant' END,
  t.id,
  t.created_at
FROM tenants t
LEFT JOIN units u ON u.property_id = t.property_id AND u.unit_number = t.unit_number
WHERE u.id IS NULL
ON CONFLICT (property_id, unit_number) DO NOTHING;