-- RLS policies — single most important checkpoint (PLAN.md 11.3)
-- Every table except organizations uses organization_id = (select organization_id from profiles where id = auth.uid())
-- This runs as a separate migration after schema so tables exist

-- helper: no RLS on organizations for Phase 1 (per spec: "except organizations")
-- enable RLS on all tenant tables + profiles

alter table profiles enable row level security;
alter table properties enable row level security;
alter table units enable row level security;
alter table tenants enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table maintenance_requests enable row level security;

-- profiles: user can read/update own row; org members read same org (needed for joins)
-- For Phase 1 minimal: owner/manager/staff can read any profile in their org, and their own row writable

create policy "profiles: users can read own org profiles"
on profiles for select
using (
  organization_id = (select organization_id from profiles where id = auth.uid())
  or id = auth.uid()
);

create policy "profiles: users can insert own profile (signup trigger)"
on profiles for insert
with check (id = auth.uid());

create policy "profiles: users can update own profile"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Note: deletes handled by admin only — no delete policy = no one can delete via anon/auth

-- properties

create policy "properties: org members can access their org's properties"
on properties for all
using (organization_id = (select organization_id from profiles where id = auth.uid()))
with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- units

create policy "units: org members can access their org's units"
on units for all
using (organization_id = (select organization_id from profiles where id = auth.uid()))
with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- tenants

create policy "tenants: org members can access their org's tenants"
on tenants for all
using (organization_id = (select organization_id from profiles where id = auth.uid()))
with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- invoices

create policy "invoices: org members can access their org's invoices"
on invoices for all
using (organization_id = (select organization_id from profiles where id = auth.uid()))
with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- payments — include role note: staff cannot see payments (enforced later via view/restricted policy)
-- For Phase 1, same org check; Phase 2 will add role gating (owner=full, manager=no-reports, staff=maintenance-only placeholder)

create policy "payments: org members can access their org's payments"
on payments for all
using (organization_id = (select organization_id from profiles where id = auth.uid()))
with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- maintenance_requests

create policy "maintenance_requests: org members can access their org's requests"
on maintenance_requests for all
using (organization_id = (select organization_id from profiles where id = auth.uid()))
with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- For role-based restrictions (Phase 2), add additional policy with role check:
-- Example (not enabled in Phase 1, documented for next phase):
-- create policy "payments: staff cannot read payments"
-- on payments for select
-- using (
--   organization_id = (select organization_id from profiles where id = auth.uid())
--   and (select role from profiles where id = auth.uid()) in ('owner','manager')
-- );

-- organizations: intentionally NOT enabled per spec for Phase 1.
-- If you later enable it, use:
-- alter table organizations enable row level security;
-- create policy "organizations: members can read own org"
-- on organizations for select using (id = (select organization_id from profiles where id = auth.uid()));
