import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import { BILLING, PLANS, featuresForPlan, getPlan, isPlanKey, planKeyFor } from '../config/plans.js';
import { unitUsageFor } from '../services/units.js';
import { logger } from '../utils/logger.js';

// Billing for Rent Sync's own subscription, as opposed to a tenant's rent.
//
// These routes are deliberately mounted with requireAuth but NOT requirePaid. A locked-out
// landlord still has to be able to find out what they owe, read the payment instructions, and
// hand over their M-Pesa confirmation code - gating these would lock them out of the only way
// out of being locked out.

const router = express.Router();
router.use(requireAuth);

// Nobody legitimately has more than a couple of claims in flight - one payment, one code - so a
// small ceiling is enough to stop the admin queue being flooded with noise from a single account.
const MAX_PENDING_PER_USER = 3;

const requestSchema = z.object({
  plan: z
    .string()
    .refine(isPlanKey, { message: 'plan must be one of basic, standard, premium, enterprise' }),
  mpesa_confirmation_code: z
    .string()
    .trim()
    .min(8, 'Enter the confirmation code from your M-Pesa SMS')
    .max(64, 'That confirmation code is too long to be a real M-Pesa code'),
});

/** What this account owes, and how to pay it. Also the paywall's data source. */
router.get('/me', async (req, res) => {
  try {
    const result = await query(
      `SELECT plan, subscription_status, units_limit, activated_at,
              payment_confirmed_at, payment_reference
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const row = result.rows[0];
    const plan = row?.plan ? PLANS[row.plan] : null;

    const pending = await query(
      `SELECT id, plan, amount, mpesa_confirmation_code, created_at
       FROM payment_requests
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    // The feature list and the live unit count go in this response because it is the one call the
    // dashboard already makes to learn what the account may do. Sending a second request to ask the
    // same question would mean the UI renders a frame it should not, and a landlord on a slow
    // connection would see gated sections appear and then vanish.
    const usage = await unitUsageFor(req.user.id);
    const planKey = planKeyFor(req.user);
    const ceiling = getPlan(planKey)?.unitCeiling ?? null;

    return res.json({
      subscription: {
        status: row?.subscription_status ?? 'unpaid',
        plan: row?.plan ?? null,
        planName: plan?.name ?? null,
        amount: plan?.amount ?? null,
        unitsLimit: row?.units_limit ?? null,
        activatedAt: row?.activated_at ?? null,
        confirmedAt: row?.payment_confirmed_at ?? null,
        reference: row?.payment_reference ?? null,
      },
      // What this plan entitles them to, and how much of it they have used. unitsLimit is the
      // plan's ceiling rather than the users.units_limit column, which is a denormalised copy that
      // can lag a plan change; unitsUsed is what the cap is actually measured against.
      entitlement: {
        features: featuresForPlan(planKey),
        unitsUsed: usage.units,
        unitsLimit: ceiling,
        properties: usage.properties,
        atUnitLimit: ceiling !== null && usage.units >= ceiling,
      },
      plans: Object.values(PLANS).map((p) => ({
        key: p.key,
        name: p.name,
        amount: p.amount,
        unitCeiling: p.unitCeiling,
        unitFloor: p.unitFloor,
        features: featuresForPlan(p.key),
      })),
      pendingRequests: pending.rows,
      billing: BILLING,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch subscription');
    return res.status(500).json({ message: 'Failed to fetch subscription' });
  }
});

/**
 * A payer claiming they have sent money. This RECORDS THE CLAIM AND NOTHING ELSE - it does not
 * activate anything. A Send Money transfer carries no reference we can read, so the confirmation
 * code is a human-checkable string, not a verified fact, and scripts/activate-subscription.js is
 * the only thing that grants access.
 */
router.post('/request', generalLimiter, async (req, res) => {
  try {
    const payload = requestSchema.parse(req.body);
    const plan = PLANS[payload.plan];

    if (plan.amount === null) {
      return res.status(400).json({
        message: 'Enterprise plans are priced individually. Contact us and we will set it up.',
      });
    }

    // Already paid: do not let a paying customer sit behind a paywall because they re-submitted.
    if (req.user.subscription_status === 'active') {
      return res.status(409).json({ message: 'Your subscription is already active' });
    }

    // A code is usable at most once, ever. The unique index spans every row rather than only
    // pending ones, so an already-approved or already-rejected code cannot be re-submitted by a
    // second account to have one payment activate two subscriptions.
    const pendingCount = await query(
      `SELECT COUNT(*)::int AS n FROM payment_requests WHERE user_id = $1 AND status = 'pending'`,
      [req.user.id]
    );
    if (pendingCount.rows[0].n >= MAX_PENDING_PER_USER) {
      return res.status(429).json({
        message: 'You already have payment claims waiting to be checked. Contact us if they are wrong.',
      });
    }

    // Catching the unique index's violation here turns a 500 into an explanation.
    const inserted = await query(
      `INSERT INTO payment_requests (user_id, plan, amount, mpesa_confirmation_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (mpesa_confirmation_code) DO NOTHING
       RETURNING id, plan, amount, mpesa_confirmation_code, created_at`,
      [req.user.id, plan.key, plan.amount, payload.mpesa_confirmation_code]
    );

    if (inserted.rowCount === 0) {
      return res.status(409).json({
        message:
          'That confirmation code has already been submitted. If it was not you, contact us.',
      });
    }

    return res.status(201).json({
      message: 'Received. We are checking it against our statement now.',
      request: inserted.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0].message });
    }
    logger.error({ err: error.message }, 'Failed to record payment request');
    return res.status(500).json({ message: 'Failed to record payment request' });
  }
});

export default router;
