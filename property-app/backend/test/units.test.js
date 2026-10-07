import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  applySchema,
  resetDb,
  seedLandlord,
  seedProperty,
  seedTenant,
  pool,
  app,
} from './helpers.js';
import { materialiseUnits } from '../src/services/units.js';

// `properties.units` is a number the landlord types into a form; `units` is the table the Units
// panel reads. Nothing in the schema connects the two, which is how a block declared at 72 came to
// be rendered as an empty list - and how the single tenant living in it ended up with no unit record
// either. These tests pin the projection: declared count in, matching rows out, always.

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function unitsOf(propertyId) {
  const result = await pool.query(
    'SELECT * FROM units WHERE property_id = $1 ORDER BY unit_number',
    [propertyId]
  );
  return result.rows;
}

// Enterprise has no unit ceiling, so a test can declare a 72-unit block the way production did
// without the plan cap turning the assertion into a 409.
let seq = 0;
const landlord = () => seedLandlord({ name: `M-${(seq += 1)}`, subscription: { plan: 'enterprise' } });

async function createProperty(token, payload) {
  const res = await request(app)
    .post('/api/properties')
    .set(auth(token))
    .send({ name: 'Block AB', address: '12 Riverside Drive', ...payload })
    .expect(201);
  return res.body;
}

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

describe('Materialising declared units', () => {
  it('creates a vacant row for every unit a new property declares', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 72 });

    const units = await unitsOf(property.id);
    assert.equal(units.length, 72);
    assert.ok(
      units.every((u) => u.status === 'vacant' && u.tenant_id === null),
      'every declared unit starts out vacant and unlet'
    );

    // The panel pages at 20 by default, so the count it reports has to be the count itself.
    const res = await request(app)
      .get(`/api/units/property/${property.id}?limit=100`)
      .set(auth(L.token))
      .expect(200);
    assert.equal(res.body.pagination.total, 72);
    assert.equal(res.body.units.length, 72);
  });

  it('zero-pads the filler numbers so the default text sort reads in order', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 12 });

    const numbers = (await unitsOf(property.id)).map((u) => u.unit_number);
    assert.deepEqual(
      numbers,
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      'ORDER BY unit_number is a text sort, so unpadded 1, 10, 11, 12, 2 would misread'
    );
  });

  it('occupies the tenant\'s unit and fills the rest around it', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 4 });

    const tenant = (
      await request(app)
        .post('/api/tenants')
        .set(auth(L.token))
        .send({
          property_id: property.id,
          name: 'Susan Oganga',
          phone: '0700000001',
          unit_number: 'G1A',
          monthly_rent: 15000,
        })
        .expect(201)
    ).body;

    const units = await unitsOf(property.id);
    assert.equal(units.length, 4, 'the declared count still holds with a tenant in one of them');

    const occupiedUnit = units.find((u) => u.unit_number === 'G1A');
    assert.ok(occupiedUnit, 'the tenant\'s own unit gets a row even though no filler carries its name');
    assert.equal(occupiedUnit.status, 'occupied');
    assert.equal(occupiedUnit.tenant_id, tenant.id);
    assert.equal(Number(occupiedUnit.monthly_rent), 15000);
    assert.equal(units.filter((u) => u.status === 'occupied').length, 1);
  });

  it('adds rows when the declared count goes up', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 4 });
    assert.equal((await unitsOf(property.id)).length, 4);

    await request(app)
      .patch(`/api/properties/${property.id}`)
      .set(auth(L.token))
      .send({ units: 10 })
      .expect(200);

    const units = await unitsOf(property.id);
    assert.equal(units.length, 10, 'raising 4 to 10 has to produce 6 more rows, not a stale list');
  });

  it('never deletes a row, even when the declared count goes down', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 6 });
    await pool.query(
      `INSERT INTO units (property_id, unit_number, status) VALUES ($1, 'X9', 'maintenance')`,
      [property.id]
    );

    await request(app)
      .patch(`/api/properties/${property.id}`)
      .set(auth(L.token))
      .send({ units: 3 })
      .expect(200);

    const units = await unitsOf(property.id);
    assert.equal(units.length, 7, 'lowering the declaration is not an instruction to throw away flats');
    assert.ok(
      units.some((u) => u.unit_number === 'X9' && u.status === 'maintenance'),
      'a unit a landlord set to maintenance survives reconciliation'
    );
  });

  it('is idempotent - re-running produces no new rows', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 5 });

    const before = (await unitsOf(property.id)).map((u) => u.id);
    assert.equal(await materialiseUnits(property.id), 0);
    assert.equal(await materialiseUnits(property.id), 0);

    const after = (await unitsOf(property.id)).map((u) => u.id);
    assert.deepEqual(after, before, 'the same five rows, not five more');
  });

  it('gives an existing tenant a unit row (the production backfill)', async () => {
    // Production's shape exactly: a 72-unit block, one tenant, and a units table nothing had ever
    // written to. seedProperty bypasses the API, so the rows have to come from the reconciler.
    const L = await landlord();
    const property = await seedProperty(L.user.id, { name: 'Block AB', units: 72 });
    assert.equal((await unitsOf(property.id)).length, 0, 'precondition: nothing had been written');

    const tenant = await seedTenant(property.id, {
      name: 'Susan Oganga',
      unit_number: 'G1A',
      monthly_rent: 15000,
    });

    const created = await materialiseUnits(property.id);
    assert.ok(created > 0);

    const units = await unitsOf(property.id);
    assert.equal(units.length, 72, 'the declared block is complete');

    const backfilledUnit = units.find((u) => u.unit_number === 'G1A');
    assert.equal(backfilledUnit.tenant_id, tenant.id, 'the tenant keeps her own unit number');
    assert.equal(backfilledUnit.status, 'occupied');
    assert.equal(units.filter((u) => u.status === 'vacant').length, 71);
  });

  it('releases the flat when a tenant is moved out', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 3 });
    const tenant = (
      await request(app)
        .post('/api/tenants')
        .set(auth(L.token))
        .send({
          property_id: property.id,
          name: 'Jane Doe',
          phone: '0700000002',
          unit_number: '02',
          monthly_rent: 12000,
        })
        .expect(201)
    ).body;

    await request(app)
      .patch(`/api/tenants/${tenant.id}/status`)
      .set(auth(L.token))
      .send({ status: 'moved_out' })
      .expect(200);

    const releasedUnit = (await unitsOf(property.id)).find((u) => u.unit_number === '02');
    assert.equal(releasedUnit.status, 'vacant', 'a moved-out tenant cannot leave a flat looking let');
    assert.equal(releasedUnit.tenant_id, null);
  });

  it('releases the flat when a tenant is deleted', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 3 });
    const tenant = (
      await request(app)
        .post('/api/tenants')
        .set(auth(L.token))
        .send({
          property_id: property.id,
          name: 'Jane Doe',
          phone: '0700000003',
          unit_number: '03',
          monthly_rent: 12000,
        })
        .expect(201)
    ).body;

    await request(app).delete(`/api/tenants/${tenant.id}`).set(auth(L.token)).expect(204);

    const units = await unitsOf(property.id);
    assert.equal(units.length, 3, 'the declared count survives losing a tenant');
    assert.equal(
      units.filter((u) => u.status === 'occupied').length,
      0,
      'ON DELETE SET NULL clears the tenant but would otherwise leave status=occupied behind'
    );
  });

  it('leaves a pending tenant\'s flat vacant', async () => {
    const L = await landlord();
    const property = await createProperty(L.token, { units: 4 });

    await request(app)
      .post('/api/tenants')
      .set(auth(L.token))
      .send({
        property_id: property.id,
        name: 'Prospective Tenant',
        phone: '0700000004',
        unit_number: 'G1A',
        monthly_rent: 12000,
        status: 'pending',
      })
      .expect(201);

    const units = await unitsOf(property.id);
    assert.equal(units.length, 4);
    assert.equal(
      units.filter((u) => u.tenant_id !== null).length,
      0,
      'only active tenants occupy a flat'
    );
  });
});
