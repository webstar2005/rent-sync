import { BILLING, PLANS } from '../config/plans.js';

// Blocks the product for an account that has not paid.
//
// Why 402 and not 403: the request is authenticated and the caller is not forbidden, they simply
// have not bought the thing yet. 402 Payment Required is the status that says so, and it is what
// the dashboard keys off to render a paywall rather than an error.
//
// The status is read off req.user, which requireAuth has already populated from the live users
// row - so a subscription switched on by an admin takes effect on the next request with no
// sign-in round trip, and without a second query per request.
//
// requirePaid MUST run after requireAuth.

export function requirePaid(req, res, next) {
  // Bypass for an admin. Admins are staff, not customers, and locking yourself out of the tool
  // you use to switch people on is a support incident.
  if (req.user?.role === 'admin') return next();

  const status = req.user?.subscription_status;
  if (status === 'active') return next();

  const plan = req.user?.plan ? PLANS[req.user.plan] : null;

  return res.status(402).json({
    code: 'subscription_required',
    message:
      status === 'suspended'
        ? 'Your subscription is suspended. Please get in touch to sort it out.'
        : 'Your subscription has not been paid yet.',
    subscription: {
      status: status ?? 'unpaid',
      plan: req.user?.plan ?? null,
      planName: plan?.name ?? null,
      amount: plan?.amount ?? null,
      currency: BILLING.currency,
      activatedAt: req.user?.activated_at ?? null,
    },
    billing: BILLING,
  });
}
