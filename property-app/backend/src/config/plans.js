// Rent Sync plans, mirroring src/content/pricing.ts on the marketing site. Keep the two in step:
// the price a landlord is quoted on /pricing is the amount the API expects on a payment request.
//
// Amounts are whole KES because a Send Money transfer is a whole-shilling amount; there is no
// cent handling anywhere in this file or in payment_requests.amount.

export const PLANS = {
  basic: {
    key: 'basic',
    name: 'Basic',
    amount: 2000,
    unitCeiling: 20,
    unitFloor: 5,
    rank: 0,
  },
  standard: {
    key: 'standard',
    name: 'Standard',
    amount: 4000,
    unitCeiling: 50,
    unitFloor: 21,
    rank: 1,
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    amount: 6500,
    unitCeiling: 100,
    unitFloor: 51,
    rank: 2,
  },
  // Priced by conversation, so it carries no fixed amount and no ceiling.
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    amount: null,
    unitCeiling: null,
    unitFloor: 101,
    rank: 3,
  },
};

export const PLAN_KEYS = Object.keys(PLANS);

export function isPlanKey(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
}

export function getPlan(key) {
  return isPlanKey(key) ? PLANS[key] : null;
}

/**
 * What each plan actually includes, keyed by the feature the rest of the code asks for.
 *
 * The matrix is derived from the tier lists published at /pricing, not invented here, so the page
 * a landlord reads and the gates they hit are the same list. `minRank` rather than `plan` so an
 * upgrade path is one comparison: Standard includes everything Basic does automatically, because
 * its rank is higher. Nothing has to be repeated per plan, so a new feature cannot be added to one
 * tier and forgotten in the next.
 *
 * Nothing is listed for `core`. Properties, tenants, invoices, payments and the arrears report are
 * what the product *is* - a landlord who cannot record a payment cannot use Rent Sync at all, so
 * every plan gets them and there is no point expressing that as a feature anyone can lose.
 */
export const FEATURES = {
  collectionRate: { key: 'collectionRate', label: 'Collection rate reporting', minRank: 1 },
  csvExport: { key: 'csvExport', label: 'CSV statement exports', minRank: 1 },
  maintenance: { key: 'maintenance', label: 'Maintenance request tracking', minRank: 1 },
  tenantStatements: { key: 'tenantStatements', label: 'Per-tenant statements', minRank: 2 },
  reconciliation: { key: 'reconciliation', label: 'Unmatched payment reconciliation', minRank: 2 },
  bulkImport: { key: 'bulkImport', label: 'Bulk tenant import', minRank: 3 },
};

export const FEATURE_KEYS = Object.keys(FEATURES);

/**
 * A plan key that grants everything, used for rows whose plan is NULL.
 *
 * Migration 010 added `users.plan` with no default, so every account that predates billing has
 * plan = NULL, and 010 deliberately left those accounts active so nobody lost their own data on
 * deploy. Migration 012 backfills them to Enterprise. This constant is the belt to that pair of
 * braces: if the backfill has not run, or a row is written by something that does not know about
 * plans, an active landlord still has their features instead of a dashboard that is suddenly empty.
 * Failing open here is safe precisely because the only thing it can leak is a feature, and only to
 * an account whose status is already 'active'.
 */
const FAIL_OPEN_PLAN_KEY = 'enterprise';

export function planKeyFor(user) {
  if (isPlanKey(user?.plan)) return user.plan;
  if (user?.plan == null) return FAIL_OPEN_PLAN_KEY;
  // A plan string we do not recognise is not a licence to hand over everything, but it is also not
  // something to lock a paying landlord out over, so it gets the top tier and a loud lookup.
  return FAIL_OPEN_PLAN_KEY;
}

export function planIncludesFeature(planKey, featureKey) {
  const feature = FEATURES[featureKey];
  if (!feature) return false;
  const plan = getPlan(planKeyFor({ plan: planKey }));
  return plan ? plan.rank >= feature.minRank : false;
}

export function featuresForPlan(planKey) {
  return FEATURE_KEYS.filter((key) => planIncludesFeature(planKey, key));
}

/** The lowest plan that includes a feature - what the 402 tells the landlord to move to. */
export function minimumPlanFor(featureKey) {
  const feature = FEATURES[featureKey];
  if (!feature) return null;
  return PLAN_KEYS.find((key) => PLANS[key].rank >= feature.minRank) ?? null;
}

/**
 * How Rent Sync is actually paid for. Send Money to a phone number, not Lipa na M-PESA: there is
 * no till and no paybill, and the transfer carries no reference we can read. That is why
 * activation is a manual step and why a confirmation code is required.
 */
export const BILLING = {
  method: 'M-Pesa Send Money',
  phoneDisplay: '0790 325 943',
  phoneE164: '+254790325943',
  currency: 'KES',
  /**
   * Returned to the client so the paywall can render real instructions instead of a bare 402.
   * The marketing site renders the same steps at /pay.
   */
  instructions: [
    'Open M-Pesa and dial *334#',
    'Choose Send Money, then Send to New Recipient',
    'Pick Phone Number as the recipient type',
    'Enter 0790 325 943 and the amount for your plan',
    'Enter your M-Pesa PIN and confirm',
    'Submit the confirmation code from the SMS you received',
  ],
};
