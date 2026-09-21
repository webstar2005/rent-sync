-- pgTAP cross-tenant suite — PLAN.md 11.3 Phase 1 gate
-- Run against local Supabase: supabase db reset && supabase test (or psql -f)
-- Every table except organizations must block Org A user from Org B rows (select/insert/update/delete)

begin;
select plan(28); -- 7 tables * 4 ops

-- helper: two orgs, two users
-- In a real pgTAP run with supabase auth, you'd use auth.users inserts via service_role;
-- This file documents the intent — replace uuids with auth.uid() impersonation via set_config('request.jwt.claim.sub', ...)

-- Setup (run as service_role / postgres)
do $$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
begin
  -- organizations
  insert into organizations(id, name) values (org_a, 'Org A'), (org_b, 'Org B');
  -- profiles
  insert into profiles(id, organization_id, role, email) values
    (user_a, org_a, 'owner', 'a@org.test'),
    (user_b, org_b, 'owner', 'b@org.test');
end $$;

-- Generic pattern for each table: as user_a, try to read/write org_b row → expect 0 rows / error
-- Below are *assertions* — adapt to your pgTAP helper that sets auth context per test:
-- For local testing, use: set local request.jwt.claim.sub = 'user_a';

-- properties
select is(
  (select count(*)::int from properties where organization_id = (select id from organizations where name='Org B')),
  0,
  'properties: Org A cannot select Org B rows'
);
select throws_ok(
  $$ insert into properties(organization_id, name) values ((select id from organizations where name='Org B'), 'Hijack') $$,
  null,
  'properties: Org A cannot insert into Org B'
);
select is(
  (with upd as (update properties set name='hijacked' where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from upd),
  0,
  'properties: Org A cannot update Org B'
);
select is(
  (with del as (delete from properties where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from del),
  0,
  'properties: Org A cannot delete Org B'
);

-- units (same 4)
select is((select count(*)::int from units where organization_id=(select id from organizations where name='Org B')),0,'units: no select cross-org');
select throws_ok($$ insert into units(organization_id, property_id, rent_amount) values ((select id from organizations where name='Org B'), (select id from properties limit 1), 1000) $$,null,'units: no insert cross-org');
select is((with u as (update units set rent_amount=999 where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from u),0,'units: no update cross-org');
select is((with d as (delete from units where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from d),0,'units: no delete cross-org');

-- tenants
select is((select count(*)::int from tenants where organization_id=(select id from organizations where name='Org B')),0,'tenants: no select cross-org');
select throws_ok($$ insert into tenants(organization_id, name) values ((select id from organizations where name='Org B'), 'Evil') $$,null,'tenants: no insert cross-org');
select is((with u as (update tenants set name='hijacked' where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from u),0,'tenants: no update cross-org');
select is((with d as (delete from tenants where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from d),0,'tenants: no delete cross-org');

-- invoices
select is((select count(*)::int from invoices where organization_id=(select id from organizations where name='Org B')),0,'invoices: no select cross-org');
select throws_ok($$ insert into invoices(organization_id, tenant_id, unit_id, amount, due_date) values ((select id from organizations where name='Org B'), (select id from tenants limit 1), (select id from units limit 1), 100, now()::date) $$,null,'invoices: no insert cross-org');
select is((with u as (update invoices set status='paid' where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from u),0,'invoices: no update cross-org');
select is((with d as (delete from invoices where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from d),0,'invoices: no delete cross-org');

-- payments
select is((select count(*)::int from payments where organization_id=(select id from organizations where name='Org B')),0,'payments: no select cross-org');
select throws_ok($$ insert into payments(organization_id, invoice_id, tenant_id, amount) values ((select id from organizations where name='Org B'), (select id from invoices limit 1), (select id from tenants limit 1), 100) $$,null,'payments: no insert cross-org');
select is((with u as (update payments set amount=999 where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from u),0,'payments: no update cross-org');
select is((with d as (delete from payments where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from d),0,'payments: no delete cross-org');

-- maintenance_requests
select is((select count(*)::int from maintenance_requests where organization_id=(select id from organizations where name='Org B')),0,'maintenance: no select cross-org');
select throws_ok($$ insert into maintenance_requests(organization_id, unit_id, description) values ((select id from organizations where name='Org B'), (select id from units limit 1), 'hack') $$,null,'maintenance: no insert cross-org');
select is((with u as (update maintenance_requests set status='resolved' where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from u),0,'maintenance: no update cross-org');
select is((with d as (delete from maintenance_requests where organization_id=(select id from organizations where name='Org B') returning 1) select count(*)::int from d),0,'maintenance: no delete cross-org');

-- profiles (own org only + own row)
select is((select count(*)::int from profiles where organization_id=(select id from organizations where name='Org B')),0,'profiles: Org A cannot see Org B profiles');

select * from finish();
rollback;
