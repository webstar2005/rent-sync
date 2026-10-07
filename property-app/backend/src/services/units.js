import { query } from '../config/db.js';
import { PLANS, getPlan, planKeyFor } from '../config/plans.js';
import { logger } from '../utils/logger.js';

/**
 * Reconcile one property's `units` rows against its declared count and its active tenants.
 *
 * `properties.units` is a number, not a list: nothing in the schema ties a declared unit to a row,
 * so every write that can change the projection (a property created or resized, a tenant added,
 * moved out, or deleted) has to call this or the Units panel renders a number the landlord can see
 * but not manage. Migration 015 backfills the rows that were already missing; this is what stops
 * them going missing again.
 *
 * Returns how many unit rows were created. It never throws: by the time it runs the property or
 * tenant has already been written, and turning a successful insert into a 500 - which the caller
 * would then retry, duplicating the record - costs more than a stale unit list. Failures are logged
 * at error level rather than swallowed, so a database without migration 015 says so on every write
 * instead of quietly reproducing the original bug.
 */
export async function materialiseUnits(propertyId) {
  try {
    const result = await query('SELECT materialise_units($1) AS created', [propertyId]);
    return result.rows[0]?.created ?? 0;
  } catch (error) {
    if (error.code === '42883') {
      logger.error(
        { propertyId },
        'materialise_units() is missing - apply database/migrations/015_materialise_units.sql'
      );
    } else {
      logger.error({ err: error.message, propertyId }, 'Failed to materialise units');
    }
    return 0;
  }
}

// What a landlord is charged for, and what stops them going over.
//
// The unit count is SUM(properties.units) rather than a count of rows or of tenants. A property is a
// building, not a dwelling: one "Nia Flats" row can be fifty flats, and counting rows would let a
// Basic landlord hold twenty blocks of fifty units on a plan sold as "up to 20 units". Counting
// tenants would be worse, because empty units are exactly the ones a landlord is trying to fill, so
// the cap would never bite. properties.units is the landlord's own declaration of that number and
// has been in the schema, the API and both property forms since before this file existed.
//
// The ceiling is read from PLANS, not from users.units_limit. The column is a denormalised copy that
// can be stale or NULL - 012 has to go and fix it - whereas the plan is the thing that was actually
// bought. One source of truth means a cap cannot be enforced against a number the code forgot to
// update.

/** Total units the landlord is managing, and how many properties that is spread across. */
export async function unitUsageFor(ownerId) {
  const result = await query(
    `SELECT COALESCE(SUM(units), 0)::int AS units, COUNT(*)::int AS properties
       FROM properties WHERE owner_id = $1`,
    [ownerId]
  );
  const row = result.rows[0] ?? { units: 0, properties: 0 };
  return { units: row.units ?? 0, properties: row.properties ?? 0 };
}

/** The plan ceiling for a user row, or null for a plan with no cap (Enterprise). */
export function unitCeilingFor(user) {
  return getPlan(planKeyFor(user))?.unitCeiling ?? null;
}

/**
 * Would adding this many units put the landlord over their plan?
 *
 * `replacingPropertyId` is the property being edited, so an update that *shrinks* a property is
 * credited back before the new total is compared - otherwise saving an unchanged property would
 * count its own units twice and block a landlord who was comfortably inside their limit.
 *
 * Returns everything the caller needs to answer, rather than a boolean, because the number is the
 * whole point: a landlord told only "limit reached" cannot tell whether they are one unit over or
 * four hundred, and the second one is a sale, not an error.
 */
export async function checkUnitCapacity({ user, addingUnits, replacingPropertyId = null }) {
  const ceiling = unitCeilingFor(user);
  const usage = await unitUsageFor(user.sub);
  let units = usage.units;

  if (replacingPropertyId !== null) {
    const existing = await query('SELECT units FROM properties WHERE id = $1 AND owner_id = $2', [
      replacingPropertyId,
      user.sub,
    ]);
    // A property the landlord does not own contributes nothing; the route's own ownership check
    // rejects the request, and this must not be the thing that leaks its unit count.
    units -= existing.rows[0]?.units ?? 0;
  }

  const projected = units + addingUnits;

  // No ceiling means no cap to enforce. Asking anyway would mean inventing a number for Enterprise.
  if (ceiling === null) {
    return { allowed: true, ceiling: null, units, projected, overBy: 0, properties: usage.properties };
  }

  return {
    allowed: projected <= ceiling,
    ceiling,
    units,
    projected,
    overBy: projected - ceiling,
    properties: usage.properties,
  };
}

/** The cheapest plan whose ceiling would cover `units`, so a refusal can name the way out. */
export function smallestPlanCovering(units) {
  return (
    Object.values(PLANS)
      .filter((plan) => plan.unitCeiling !== null && plan.unitCeiling >= units)
      .sort((a, b) => a.unitCeiling - b.unitCeiling)[0] ?? null
  );
}

/** The 409 body, so the create and update paths cannot word the refusal differently. */
export function unitLimitResponse({ capacity, user, unitName = 'unit' }) {
  const plan = getPlan(planKeyFor(user));
  const upgrade = capacity.overBy > 0 ? smallestPlanCovering(capacity.projected) : null;

  return {
    code: 'unit_limit_reached',
    message:
      `Your ${plan?.name ?? 'current'} plan covers ${capacity.ceiling} ${unitName}s and you are ` +
      `managing ${capacity.units}. Adding this would make ${capacity.projected}, which is ` +
      `${capacity.overBy} over.` +
      (upgrade ? ` The ${upgrade.name} plan covers up to ${upgrade.unitCeiling}.` : ''),
    units: capacity.units,
    unitsLimit: capacity.ceiling,
    properties: capacity.properties ?? null,
    projected: capacity.projected,
    overBy: capacity.overBy,
    currentPlan: plan?.key ?? null,
    currentPlanName: plan?.name ?? null,
    upgradePlan: upgrade?.key ?? null,
    upgradePlanName: upgrade?.name ?? null,
  };
}
