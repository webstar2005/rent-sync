-- SQL to set up hinderous456@gmail.com with production access like morganplague@gmail.com
-- Run this against your production database

-- 1. Check if user exists
SELECT id, name, email, role, is_active, subscription_status, plan, created_at 
FROM users 
WHERE email = 'hinderous456@gmail.com';

-- 2. If user does NOT exist, create them:
-- INSERT INTO users (name, email, password_hash, role, is_active, subscription_status, plan, created_at, activated_at, payment_reference, payment_confirmed_by, payment_confirmed_at)
-- VALUES (
--   'Hinderous User', 
--   'hinderous456@gmail.com', 
--   '$2a$10$Xy6xQY5fz1B6rBv9.Ai0w.rzaJZ2vK0nBGbM0A0Vw4m2L5Q8Jk6EW', -- hash of "password" - CHANGE THIS IN PRODUCTION!
--   'landlord',
--   true,
--   'active',
--   'enterprise',
--   NOW(),
--   NOW(),
--   'manual_setup_' || floor(random()*999999)::text,
--   'admin_setup',
--   NOW()
-- );

-- 3. If user exists but needs to be upgraded to active enterprise:
UPDATE users 
SET 
  subscription_status = 'active',
  plan = 'enterprise',
  is_active = true,
  activated_at = NOW(),
  payment_reference = 'manual_setup_' || floor(random()*999999)::text,
  payment_confirmed_by = 'admin_setup',
  payment_confirmed_at = NOW()
WHERE email = 'hinderous456@gmail.com';

-- 4. OPTIONAL: Create some sample data so dashboard isn't empty
-- Only run this if you want to see sample data in the dashboard

-- Create a sample property
WITH inserted_property AS (
  INSERT INTO properties (owner_id, name, address, units, rent_due_day, status, created_at)
  SELECT 
    u.id,
    'Sample Property',
    '123 Sample Street',
    5,
    5,
    'active',
    NOW()
  FROM users u
  WHERE u.email = 'hinderous456@gmail.com'
  RETURNING id
)
-- Create sample tenants
INSERT INTO tenants (property_id, name, email, phone, unit_number, monthly_rent, lease_start, lease_end, status, created_at)
SELECT 
  ip.id,
  'Sample Tenant 1',
  'tenant1@example.com',
  '254700000001',
  '101',
  5000.00,
  NOW() - INTERVAL '3 months',
  NOW() + INTERVAL '9 months',
  'active',
  NOW()
FROM inserted_property ip

UNION ALL

SELECT 
  ip.id,
  'Sample Tenant 2',
  'tenant2@example.com',
  '254700000002',
  '102',
  6000.00,
  NOW() - INTERVAL '2 months',
  NOW() + INTERVAL '10 months',
  'active',
  NOW()
FROM inserted_property ip;

-- Create sample invoices (for next month)
WITH rental_period AS (
  SELECT 
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month' as period_start,
    DATE_TRUNC('month', NOW()) + INTERVAL '2 month' - INTERVAL '1 day' as period_end
),
sample_data AS (
  SELECT 
    p.id as property_id,
    t.id as tenant_id,
    t.monthly_rent
  FROM tenants t
  JOIN properties p ON t.property_id = p.id
  JOIN users u ON p.owner_id = u.id
  WHERE u.email = 'hinderous456@gmail.com'
)
INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, status, notes, created_at)
SELECT
  sd.tenant_id,
  sd.property_id,
  'INV-' || sd.tenant_id || '-' || TO_CHAR(rp.period_start, 'YYYYMM'),
  sd.monthly_rent,
  (rp.period_start + INTERVAL '4 days')::date, -- Assuming rent due on 5th
  'pending',
  'Sample rent for ' || TO_CHAR(rp.period_start, 'Month YYYY'),
  NOW()
FROM sample_data sd
CROSS JOIN rental_period rp;