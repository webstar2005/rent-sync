// Local development wants to watch the dashboard change with no payment in the way, so this is the
// single switch that opens the paywall - and it is deliberately scoped to one account. A bypass
// that covers every account would also cover the unpaid fixtures the suite asserts against and any
// test account a colleague signs up with, so the switch names whose paywall is open and leaves
// everyone else's shut.
//
// It is applied in exactly one place: wherever the users row becomes the request identity. That is
// deliberate, because requirePaid, requireFeature and GET /api/billing/me all read the same object
// - overlaying it there opens the API gates and reports the account as paid in the one response the
// dashboard uses to decide whether to render <Paywall/>, so the client needs no flag of its own and
// a browser cannot flip anything.
//
// Hard to reach by accident: it needs an explicit ALLOW_UNPAID_ACCESS AND a development process.
// NODE_ENV=production closes it no matter what the variable says, and NODE_ENV=test closes it too,
// so the 402 assertions in subscription.test.js still hold for anyone who sets it in a shared .env.
// The variable is read server-side only and never leaves it as a setting - the client only ever
// sees the response this produced.

// Imported for its side effect: it is what reads .env, so the flag below is not read too early.
import './env.js';

const DEV_NODE_ENV = 'development';

// The one developer account this is for. Overridable so a second machine can use its own address,
// but it is never "*" - the default is a specific person's email on purpose.
const DEV_EMAIL = (process.env.DEV_ACCESS_EMAIL || 'morganplague@gmail.com').trim().toLowerCase();

const isTruthy = (value) => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());

export const devUnlocked =
  (process.env.NODE_ENV || DEV_NODE_ENV) === DEV_NODE_ENV && isTruthy(process.env.ALLOW_UNPAID_ACCESS);

/**
 * The account as the paywall should see it: active, and on the plan that includes every feature, so
 * the plan-gated sections open too. Returns the input untouched when the switch is off, or when the
 * account is not the one this was written for - the case everywhere but a developer's own machine.
 */
export function asPaid(account) {
  if (!devUnlocked || String(account?.email ?? '').trim().toLowerCase() !== DEV_EMAIL) return account;
  return { ...account, subscription_status: 'active', plan: 'enterprise' };
}

if (devUnlocked) {
  // Loud and at import time: a bypass nobody notices is a bypass that never gets turned off.
  console.warn(
    `[devAccess] ALLOW_UNPAID_ACCESS is on - ${DEV_EMAIL} is being treated as a paid Enterprise ` +
      'subscriber. Every other account keeps its real subscription status. This is a development ' +
      'switch and has no effect when NODE_ENV=production.'
  );
}
