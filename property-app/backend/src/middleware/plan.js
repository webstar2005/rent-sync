import {
  BILLING,
  FEATURES,
  getPlan,
  minimumPlanFor,
  planIncludesFeature,
  planKeyFor,
} from '../config/plans.js';
import { logger } from '../utils/logger.js';

// Blocks a feature the landlord's plan does not include.
//
// requirePaid answers "have you paid at all". This answers the different question "did you pay for
// this", so a Basic landlord is not sold reconciliation they cannot use, and a Standard landlord is
// not sold Premium reporting.
//
// 402 again rather than 403: the caller is authenticated and not forbidden, they bought a smaller
// thing than the one they reached for. The same reasoning requirePaid uses, and the dashboard
// already knows how to read a 402 - so a gate that fires for the wrong plan is presented the same
// way a missing payment is, rather than as a broken screen.
//
// The plan is read off req.user, which requireAuth populated from the live users row, so an upgrade
// applied by scripts/activate-subscription.js takes effect on the next request with no re-sign-in
// and no second query - the same property that makes requirePaid work.
//
// requireFeature MUST run after requireAuth, and in practice after requirePaid: there is no point
// distinguishing a Standard landlord from an unpaid one.

export function requireFeature(featureKey) {
  const feature = FEATURES[featureKey];

  if (!feature) {
    // A typo in a route definition should fail loudly in development, not silently let everything
    // through - which is what `if (!feature) return next()` would do.
    throw new Error(`requireFeature: unknown feature "${featureKey}"`);
  }

  return (req, res, next) => {
    // Admins are staff, not customers, same reasoning as requirePaid: locking yourself out of the
    // tool you use to sell the upgrade is a support incident.
    if (req.user?.role === 'admin') return next();

    const planKey = planKeyFor(req.user);

    if (req.user?.plan == null || !getPlan(req.user.plan)) {
      logger.warn(
        { userId: req.user?.id, plan: req.user?.plan ?? null, feature: featureKey },
        'Active account has no usable plan; granting every feature rather than locking it out'
      );
    }

    if (planIncludesFeature(planKey, featureKey)) return next();

    const currentPlan = getPlan(planKey);
    const requiredPlanKey = minimumPlanFor(featureKey);
    const requiredPlan = getPlan(requiredPlanKey);

    return res.status(402).json({
      code: 'plan_upgrade_required',
      message:
        `${feature.label} is part of the ${requiredPlan?.name ?? 'a higher'} plan. You are on ` +
        `${currentPlan?.name ?? 'no plan'}.`,
      feature: featureKey,
      featureLabel: feature.label,
      currentPlan: currentPlan?.key ?? null,
      currentPlanName: currentPlan?.name ?? null,
      requiredPlan: requiredPlanKey ?? null,
      requiredPlanName: requiredPlan?.name ?? null,
      requiredAmount: requiredPlan?.amount ?? null,
      billing: BILLING,
    });
  };
}
