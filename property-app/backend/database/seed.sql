-- Example seed data for local development
INSERT INTO users (name, email, password_hash, role)
VALUES
  ('Admin User', 'admin@example.com', '$2a$10$Xy6xQY5fz1B6rBv9.Ai0w.rzaJZ2vK0nBGbM0A0Vw4m2L5Q8Jk6EW', 'admin'),
  ('Landlord One', 'landlord@example.com', '$2a$10$Xy6xQY5fz1B6rBv9.Ai0w.rzaJZ2vK0nBGbM0A0Vw4m2L5Q8Jk6EW', 'landlord');

INSERT INTO properties (owner_id, name, address, city, state, country, units, rent_due_day, status)
VALUES
  (2, 'Sunset Apartments', '12 River Road', 'Accra', 'Greater Accra', 'Ghana', 8, 5, 'active'),
  (2, 'Oak Terrace', '45 Hill Lane', 'Kumasi', 'Ashanti', 'Ghana', 5, 5, 'active');

INSERT INTO tenants (property_id, name, email, phone, unit_number, monthly_rent, lease_start, lease_end, status)
VALUES
  (1, 'Ama Boateng', 'ama@example.com', '254712345678', 'A1', 1200.00, '2025-01-01', '2026-12-31', 'active'),
  (1, 'Kwame Addo', 'kwame@example.com', '254712345679', 'A2', 1300.00, '2025-02-01', '2026-12-31', 'active'),
  -- moved-out/archived keep history but not counted as active (dashboard filters status=active)
  (1, 'Esi Mensah', 'esi@example.com', '254712345680', 'A3', 1200.00, '2024-01-01', '2025-06-30', 'moved_out'),
  (2, 'Yaw Osei', 'yaw@example.com', '254712345681', 'B1', 1500.00, '2024-03-01', '2025-03-01', 'archived');

INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, status, notes)
VALUES
  (1, 1, 'INV-1001', 1200.00, '2025-09-30', 'pending', 'September rent'),
  (2, 1, 'INV-1002', 1300.00, '2025-09-30', 'paid', 'September rent');

INSERT INTO payments (invoice_id, tenant_id, amount, payment_method, reference, status)
VALUES
  (2, 2, 1300.00, 'bank_transfer', 'REF-001', 'completed');

INSERT INTO maintenance_requests (property_id, tenant_id, title, description, priority, status)
VALUES
  (1, 1, 'Water heater issue', 'The water heater is not heating water properly.', 'high', 'open');
