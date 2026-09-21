-- Initial schema — property-app (PLAN.md 11.2)
-- Financial ledger: Postgres FKs + referential integrity, NOT Firestore-style app links
-- Every table except organizations + profiles carries organization_id for multi-tenant isolation

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- organizations — one per landlord/PM account, owner is auth.users
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  plan text,
  created_at timestamptz default now()
);

-- profiles — one row per auth user, holds role + org membership (RLS anchor)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text check (role in ('owner','manager','staff')),
  organization_id uuid references organizations(id) on delete set null
);
create index idx_profiles_organization_id on profiles(organization_id);
create index idx_profiles_role on profiles(role);

-- properties
create table properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  type text
);
create index idx_properties_organization_id on properties(organization_id);

-- units
create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) not null on delete cascade,
  unit_number text,
  rent_amount numeric not null check (rent_amount >= 0),
  status text check (status in ('occupied','vacant')) default 'vacant'
);
create index idx_units_organization_id on units(organization_id);
create index idx_units_property_id on units(property_id);

-- tenants
create table tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  name text not null,
  phone text,
  email text,
  lease_start date,
  lease_end date,
  deposit_amount numeric check (deposit_amount is null or deposit_amount >= 0),
  constraint lease_range check (lease_end is null or lease_start is null or lease_end >= lease_start)
);
create index idx_tenants_organization_id on tenants(organization_id);
create index idx_tenants_unit_id on tenants(unit_id);

-- invoices — ledger row, immutable period + amount
create table invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null on delete cascade,
  tenant_id uuid not null references tenants(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  amount numeric not null check (amount > 0),
  due_date date not null,
  period text,
  status text check (status in ('pending','paid','overdue')) default 'pending'
);
create index idx_invoices_organization_id on invoices(organization_id);
create index idx_invoices_tenant_id on invoices(tenant_id);
create index idx_invoices_due_date on invoices(due_date);

-- payments — insert on webhook / manual, FK to invoice
create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete restrict,
  tenant_id uuid not null references tenants(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text check (method in ('mpesa','bank','cash')),
  transaction_ref text,
  paid_at timestamptz default now(),
  constraint uq_payments_transaction_ref unique (transaction_ref)
);
-- unique only for non-null refs (Postgres nulls are distinct; this is intentional — pending manual cash may have no ref)
create index idx_payments_organization_id on payments(organization_id);
create index idx_payments_invoice_id on payments(invoice_id);

-- maintenance_requests
create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  description text,
  status text check (status in ('open','in_progress','resolved')) default 'open',
  created_at timestamptz default now()
);
create index idx_maintenance_organization_id on maintenance_requests(organization_id);
create index idx_maintenance_unit_id on maintenance_requests(unit_id);

-- updated_at helper (optional, for future phases)
-- leave out for Phase 1 minimal
