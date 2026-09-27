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

// A unit is one rentable dwelling, declared by the landlord on the property ("Nia Flats" = 50), and
// the plan caps the SUM of those. That is the only reading under which "up to 20 units" on the
// pricing page means what it says, which is why these tests count properties with varying unit
// counts rather than counting rows.

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

// users.email is unique, and a single test here can need the same plan twice, so the name carries a
// counter rather than the plan alone.
let seq = 0;
const landlordOn = (plan) =>
  seedLandlord({ name: `L-${plan}-${(seq += 1)}`, subscription: { plan } });

before(async () => {
  await applySchema();
});

beforeEach(async () => {
  await resetDb();
});

describe('Plan entitlements — what each plan actually gets', () => {
  // The matrix is the published tier list, not a private arrangement, so these assertions are the
  // contract with the pricing page. Each plan carries its own tier's features *plus* everything
  // below it, which is why these are cumulative rather than the "everything in Basic" shorthand the
  // marketing copy uses. If a plan gains or loses a feature, this is where it changes deliberately -
  // and the marketing copy has to change with it.
  const matrix = [
    { plan: 'basic', features: [] },
    { plan: 'standard', features: ['collectionRate', 'csvExport', 'maintenance'] },
    {
      plan: 'premium',
      features: ['collectionRate', 'csvExport', 'maintenance', 'tenantStatements', 'reconciliation'],
    },
    {
      plan: 'enterprise',
      features: [
        'collectionRate',
        'csvExport',
        'maintenance',
        'tenantStatements',
        'reconciliation',
        'bulkImport',
      ],
    },
  ];

  for (const { plan, features } of matrix) {
    it(`${plan} reports exactly the features published for it`, async () => {
      const L = await landlordOn(plan);
      const res = await request(app).get('/api/billing/me').set(auth(L.token)).expect(200);

      assert.deepEqual(
        [...res.body.entitlement.features].sort(),
        [...features].sort(),
        `${plan} entitlements drifted from the published tier list`
      );
    });
  }

  it('every higher plan includes everything the one below it does', async () => {
    // An upgrade must never take something away. A landlord who moves from Premium to Standard has
    // not agreed to lose reconciliation, and a plan list that lets that happen is a bug in the
    // matrix rather than a pricing decision.
    const ranks = ['basic', 'standard', 'premium', 'enterprise'];
    for (let i = 0; i < ranks.length - 1; i += 1) {
      const lower = await request(app)
        .get('/api/billing/me')
        .set(auth((await landlordOn(ranks[i])).token))
        .expect(200);
      const higher = await request(app)
        .get('/api/billing/me')
        .set(auth((await landlordOn(ranks[i + 1])).token))
        .expect(200);

      for (const feature of lower.body.entitlement.features) {
        assert.ok(
          higher.body.entitlement.features.includes(feature),
          `${ranks[i + 1]} is missing ${feature}, which ${ranks[i]} already has`
        );
      }
    }
  });
});

describe('Plan gates — 402 with the plan that would open the feature', () => {
  const cases = [
    { feature: 'maintenance', plan: 'basic', method: 'get', url: '/api/maintenance' },
    { feature: 'reconciliation', plan: 'basic', method: 'get', url: '/api/reconciliation/alerts' },
    { feature: 'collectionRate', plan: 'basic', method: 'get', url: '/api/reports/collection-rate' },
    { feature: 'tenantStatements', plan: 'standard', method: 'get', url: '/api/reports/tenant-statement/1' },
    { feature: 'bulkImport', plan: 'premium', method: 'post', url: '/api/tenants/bulk' },
  ];

  for (const { feature, plan, method, url } of cases) {
    it(`refuses ${feature} for a ${plan} landlord and names the plan that has it`, async () => {
      const L = await landlordOn(plan);
      const res = await request(app)[method](url).set(auth(L.token)).send({ tenants: [] });

      assert.equal(res.status, 402, `${feature} was not gated for ${plan}`);
      assert.equal(res.body.code, 'plan_upgrade_required');
      assert.equal(res.body.feature, feature);
      assert.equal(res.body.currentPlan, plan);
      assert.ok(res.body.requiredPlan, 'the refusal must name a plan to move to');
      assert.ok(
        res.body.billing?.phoneDisplay,
        'the refusal carries billing instructions so the landlord can act on it'
      );
    });
  }

  it('lets a landlord with the feature through', async () => {
    const L = await landlordOn('standard');
    await request(app).get('/api/reports/collection-rate').set(auth(L.token)).expect(200);
  });

  it('gates CSV export separately from the report it belongs to', async () => {
    // The tier lists promise Basic the arrears and collection reports and reserve CSV for Standard.
    // So a Basic landlord reads the data on screen and is refused only the download - the two have
    // to be distinguishable, or either the screen or the export is wrong for someone.
    const basic = await seedLandlord({ name: 'Basic B', subscription: { plan: 'basic' } });
    const tenant = await seedTenant((await seedProperty(basic.user.id, { units: 1 })).id);

    await request(app).get('/api/reports/arrears').set(auth(basic.token)).expect(200);
    const res = await request(app)
      .get('/api/reports/arrears?format=csv')
      .set(auth(basic.token))
      .expect(402);
    assert.equal(res.body.feature, 'csvExport');

    const standard = await landlordOn('standard');
    await request(app)
      .get('/api/reports/arrears?format=csv')
      .set(auth(standard.token))
      .expect(200);

    assert.ok(tenant.id);
  });

  it('answers 402 for an unpaid landlord rather than talking about plans', async () => {
    // Gate ordering: an account that has not paid at all must be told that, not that its plan is
    // too small. Otherwise the first thing a new signup sees is an upsell for a product they have
    // not bought.
    const L = await seedLandlord({
      name: 'Unpaid U',
      subscription: { status: 'unpaid', plan: 'basic' },
    });
    const res = await request(app).get('/api/maintenance').set(auth(L.token)).expect(402);
    assert.equal(res.body.code, 'subscription_required');
  });

  it('lets an admin through every gate', async () => {
    // Same reasoning as requirePaid: an admin is staff, and the person who sells the upgrade cannot
    // be the person the upgrade locks out.
    const admin = await seedLandlord({ name: 'Admin A', role: 'admin' });
    await request(app).get('/api/maintenance').set(auth(admin.token)).expect(200);
    await request(app).get('/api/reconciliation/alerts').set(auth(admin.token)).expect(200);
  });

  it('refuses an active account with no plan rather than emptying its dashboard', async () => {
    // 010 left every pre-billing account with plan = NULL and status = 'active'. Read strictly, a
    // NULL plan has no entitlements, so the fail-open path in plans.js grants the top tier instead.
    // A landlord who entered a year of data must not open the app to find it gone.
    const L = await seedLandlord({ name: 'No Plan NP' });
    await pool.query('UPDATE users SET plan = NULL WHERE id = $1', [L.user.id]);

    const res = await request(app).get('/api/billing/me').set(auth(L.token)).expect(200);
    assert.equal(res.body.subscription.plan, null);
    assert.ok(
      res.body.entitlement.features.includes('reconciliation'),
      'a NULL plan should be treated as the top tier, matching migration 012'
    );

    await request(app).get('/api/reconciliation/alerts').set(auth(L.token)).expect(200);
  });
});

describe('Unit ceiling — the number the plan was sold on', () => {
  it('allows a Basic landlord right up to 20 units and refuses 21', async () => {
    const L = await seedLandlord({ name: 'Basic Units', subscription: { plan: 'basic' } });
    await seedProperty(L.user.id, { units: 18 });

    // Exactly at the ceiling is fine; the twenty-first unit is not.
    await request(app)
      .post('/api/properties')
      .set(auth(L.token))
      .send({ name: 'Last Two', address: 'Kenyatta Avenue', units: 2 })
      .expect(201);

    const res = await request(app)
      .post('/api/properties')
      .set(auth(L.token))
      .send({ name: 'One Too Many', address: 'Kenyatta Avenue', units: 1 })
      .expect(409);

    assert.equal(res.body.code, 'unit_limit_reached');
    assert.equal(res.body.units, 20);
    assert.equal(res.body.unitsLimit, 20);
    assert.equal(res.body.projected, 21);
    assert.equal(res.body.overBy, 1);
    assert.equal(res.body.upgradePlan, 'standard');
  });

  it('counts units, not properties', async () => {
    // This is the whole reason the cap is SUM(units) rather than COUNT(*). Counting properties
    // would let one Basic landlord hold twenty blocks of fifty units on a plan sold as 20 units.
    const L = await seedLandlord({ name: 'Big Block', subscription: { plan: 'basic' } });
    await seedProperty(L.user.id, { units: 19 });

    const res = await request(app)
      .post('/api/properties')
      .set(auth(L.token))
      .send({ name: 'One More Flat', address: 'Kenyatta Avenue', units: 2 })
      .expect(409);

    assert.equal(res.body.projected, 21);
    assert.equal(res.body.properties, 1, 'one property, over the limit');
  });

  it('credits a property back when it is edited, so saving one unchanged is not blocked', async () => {
    // The bug this prevents: comparing SUM(units) + newUnits without subtracting the property being
    // replaced would count a property's units twice, and a landlord sitting exactly on their limit
    // could not rename a property or nudge a rent due day.
    const L = await seedLandlord({ name: 'On The Cap', subscription: { plan: 'basic' } });
    const prop = await seedProperty(L.user.id, { units: 20 });

    await request(app)
      .patch(`/api/properties/${prop.id}`)
      .set(auth(L.token))
      .send({ units: 20 })
      .expect(200);

    await request(app)
      .patch(`/api/properties/${prop.id}`)
      .set(auth(L.token))
      .send({ units: 19 })
      .expect(200);

    const res = await request(app)
      .patch(`/api/properties/${prop.id}`)
      .set(auth(L.token))
      .send({ units: 21 })
      .expect(409);
    assert.equal(res.body.overBy, 1);
  });

  it('does not block edits that do not touch the unit count', async () => {
    const L = await seedLandlord({ name: 'At Cap Rename', subscription: { plan: 'basic' } });
    const prop = await seedProperty(L.user.id, { units: 20 });
    await request(app)
      .patch(`/api/properties/${prop.id}`)
      .set(auth(L.token))
      .send({ name: 'Renamed Block', rent_due_day: 1 })
      .expect(200);
  });

  it('does not count one landlord’s units against another', async () => {
    const A = await seedLandlord({ name: 'Full A', subscription: { plan: 'basic' } });
    const B = await seedLandlord({ name: 'Empty B', subscription: { plan: 'basic' } });
    await seedProperty(A.user.id, { units: 20 });

    await request(app)
      .post('/api/properties')
      .set(auth(B.token))
      .send({ name: 'B First', address: 'Kenyatta Avenue', units: 20 })
      .expect(201);
  });

  it('leaves an Enterprise landlord uncapped', async () => {
    const L = await seedLandlord({ name: 'Big E', subscription: { plan: 'enterprise' } });
    await seedProperty(L.user.id, { units: 500 });
    const res = await request(app)
      .post('/api/properties')
      .set(auth(L.token))
      .send({ name: 'More', address: 'Kenyatta Avenue', units: 500 })
      .expect(201);
    assert.equal(res.body.units, 500);
  });

  it('reports usage against the plan ceiling, not the stored column', async () => {
    // users.units_limit is a denormalised copy that 012 has to go and repair. The number a landlord
    // is shown, and the number they are held to, both come from PLANS.
    const L = await seedLandlord({ name: 'Stale Limit', subscription: { plan: 'premium' } });
    await pool.query('UPDATE users SET units_limit = NULL WHERE id = $1', [L.user.id]);
    await seedProperty(L.user.id, { units: 100 });

    const res = await request(app).get('/api/billing/me').set(auth(L.token)).expect(200);
    assert.equal(res.body.entitlement.unitsUsed, 100);
    assert.equal(res.body.entitlement.unitsLimit, 100);
    assert.equal(res.body.entitlement.atUnitLimit, true);
  });
});
