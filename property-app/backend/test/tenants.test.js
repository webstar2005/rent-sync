import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applySchema, resetDb, seedLandlord, pool, app } from './helpers.js';

// The dashboard's "Tenants" card is `tenants.length` and the roster under it is the same array, so
// the contract that matters is that GET /api/tenants hands back the landlord's entire portfolio -
// every property, every status, no page the client has to remember to walk. A landlord who imports
// twenty-five people and is shown one has not misread the UI; the list has been truncated.
//
// The roster also renders the property name, the unit number and the monthly rent for each row, so
// those are asserted here as part of the same contract rather than left to the UI to discover.

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

// Comfortably over any page size someone might pick by accident (the units endpoint defaults to 20).
const TENANTS_PER_PROPERTY = 15;
const PROPERTY_COUNT = 2;

let seq = 0;

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

async function buildPortfolio(token) {
  const properties = [];
  for (let i = 0; i < PROPERTY_COUNT; i += 1) {
    const res = await request(app)
      .post('/api/properties')
      .set(auth(token))
      .send({ name: `Block ${String.fromCharCode(65 + i)}`, address: `${i + 1} Riverside Drive`, units: TENANTS_PER_PROPERTY })
      .expect(201);
    properties.push(res.body);
  }

  const tenants = [];
  for (const property of properties) {
    for (let n = 1; n <= TENANTS_PER_PROPERTY; n += 1) {
      const res = await request(app)
        .post('/api/tenants')
        .set(auth(token))
        .send({
          property_id: property.id,
          name: `Tenant ${property.id}-${n}`,
          phone: `0700000${String(n).padStart(4, '0')}`,
          unit_number: `U${n}`,
          monthly_rent: 10000 + n,
        })
        .expect(201);
      tenants.push(res.body);
    }
  }
  return { properties, tenants };
}

describe('Tenant roster - what the dashboard shows', () => {
  it('returns every tenant across every property, with no page limit', async () => {
    const L = await seedLandlord({ name: `R-${(seq += 1)}` });
    const { tenants } = await buildPortfolio(L.token);
    const expected = TENANTS_PER_PROPERTY * PROPERTY_COUNT;
    assert.equal(tenants.length, expected, 'precondition: the portfolio was built');

    const res = await request(app).get('/api/tenants').set(auth(L.token)).expect(200);

    assert.equal(
      res.body.length,
      expected,
      'the card reads this array directly, so anything shorter is a wrong tenant count on screen'
    );

    const properties = new Set(res.body.map((t) => t.property_id));
    assert.equal(properties.size, PROPERTY_COUNT, 'tenants from every property, not just the newest');
  });

  it('keeps tenants that are no longer active, because the roster is a record and not a queue', async () => {
    const L = await seedLandlord({ name: `R-${(seq += 1)}` });
    const { tenants } = await buildPortfolio(L.token);

    // Two leave and one is archived; the money sections filter these out, the roster must not.
    await request(app)
      .patch(`/api/tenants/${tenants[0].id}/status`)
      .set(auth(L.token))
      .send({ status: 'moved_out' })
      .expect(200);
    await request(app)
      .patch(`/api/tenants/${tenants[1].id}/status`)
      .set(auth(L.token))
      .send({ status: 'moved_out' })
      .expect(200);
    await request(app)
      .patch(`/api/tenants/${tenants[2].id}/status`)
      .set(auth(L.token))
      .send({ status: 'archived' })
      .expect(200);

    const res = await request(app).get('/api/tenants').set(auth(L.token)).expect(200);

    assert.equal(res.body.length, TENANTS_PER_PROPERTY * PROPERTY_COUNT, 'a tenant who left is still on the roster');
    const byStatus = (status) => res.body.filter((t) => t.status === status).length;
    assert.equal(byStatus('moved_out'), 2);
    assert.equal(byStatus('archived'), 1);
    assert.equal(byStatus('active'), TENANTS_PER_PROPERTY * PROPERTY_COUNT - 3);
  });

  it('carries the property name, unit number and monthly rent each roster row renders', async () => {
    const L = await seedLandlord({ name: `R-${(seq += 1)}` });
    await buildPortfolio(L.token);

    const res = await request(app).get('/api/tenants').set(auth(L.token)).expect(200);

    for (const tenant of res.body) {
      assert.ok(tenant.property_name, `tenant ${tenant.id} has no property_name - the roster would render a blank cell`);
      assert.ok(tenant.unit_number, `tenant ${tenant.id} has no unit_number`);
      assert.ok(Number(tenant.monthly_rent) > 0, `tenant ${tenant.id} has no rent to show`);
    }
  });

  it('materialises a matching unit for every imported tenant, so unit view and roster agree', async () => {
    const L = await seedLandlord({ name: `R-${(seq += 1)}` });
    const { tenants } = await buildPortfolio(L.token);

    const unitRows = await pool.query(
      `SELECT property_id, count(*)::int AS rows,
              count(*) FILTER (WHERE status = 'occupied')::int AS occupied
         FROM units GROUP BY property_id ORDER BY property_id`
    );
    assert.equal(
      unitRows.rows.length,
      PROPERTY_COUNT,
      'both properties have units rows - this is what the Units panel reads'
    );
    for (const row of unitRows.rows) {
      assert.equal(row.rows, TENANTS_PER_PROPERTY, 'unit count matches the declared count');
      assert.equal(row.occupied, TENANTS_PER_PROPERTY, 'every flat its tenant lives in is marked occupied');
    }

    // The Units panel and the roster must not name two different flats for the same person.
    const byId = new Map(tenants.map((t) => [t.id, t]));
    const units = await pool.query(
      `SELECT unit_number, tenant_id FROM units WHERE tenant_id IS NOT NULL`
    );
    assert.equal(units.rows.length, tenants.length, 'one occupied unit per tenant, not more and not fewer');
    for (const unit of units.rows) {
      const tenant = byId.get(unit.tenant_id);
      assert.ok(tenant, 'the occupied unit points at a tenant that exists');
      assert.equal(
        unit.unit_number,
        tenant.unit_number,
        'the Units panel and the roster must not name two different flats for one person'
      );
    }
    // The Units panel shows the unit's rent and the roster shows the tenant's. If those two could
    // disagree, a landlord would be looking at two different numbers for what one person owes.
    const occupied = await pool.query(
      `SELECT u.unit_number, u.monthly_rent AS unit_rent, t.monthly_rent AS tenant_rent
         FROM units u JOIN tenants t ON t.id = u.tenant_id`
    );
    assert.ok(occupied.rows.length > 0);
    for (const row of occupied.rows) {
      assert.equal(
        Number(row.unit_rent),
        Number(row.tenant_rent),
        `unit ${row.unit_number} advertises a different rent from its tenant's agreement`
      );
    }
  });
});
