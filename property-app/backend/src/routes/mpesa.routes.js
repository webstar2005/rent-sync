import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { mpesaLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { initiateStkPush } from '../services/mpesa.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// NOTE: The old Daraja `/callback` webhook was REMOVED — replaced by PayHero multi-channel
// collection (see ./payheroWebhook.routes.js at POST /webhooks/payhero). This route only keeps
// the landlord-initiated STK Push probe (mockable without creds) for the demo flow.

// Landlord initiates STK Push for a tenant's open invoice (sandbox)
router.post('/stk-push', requireAuth, mpesaLimiter, async (req, res) => {
  const schema = z.object({
    property_id: z.number().int(),
    tenant_id: z.number().int(),
    phone: z.string().min(10),
    amount: z.number().positive(),
    accountReference: z.string().min(1).max(12).optional(),
  });
  try {
    const body = schema.parse(req.body);
    // Verify property belongs to landlord and tenant belongs to property
    const propCheck = await query('SELECT id FROM properties WHERE id=$1 AND owner_id=$2', [body.property_id, req.user.sub]);
    if (propCheck.rows.length === 0) return res.status(403).json({ message: 'You do not own this property' });
    const tenantCheck = await query('SELECT id FROM tenants WHERE id=$1 AND property_id=$2', [body.tenant_id, body.property_id]);
    if (tenantCheck.rows.length === 0) return res.status(400).json({ message: 'Tenant not in this property' });
    const tenant = tenantCheck.rows[0];
    const result = await initiateStkPush({
      phone: body.phone,
      amount: body.amount,
      accountReference: body.accountReference || tenant.id.toString(),
      transactionDesc: 'Rent',
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
    logger.error({ err: error.message }, 'STK Push failed');
    return res.status(500).json({ message: 'STK Push failed', error: error.message });
  }
});

export default router;