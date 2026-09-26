import express from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { initiateStkPush, payheroCallbackUrl } from '../services/payhero.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const paymentSchema = z.object({
  invoice_id: z.number().int().positive(),
  tenant_id: z.number().int().positive(),
  amount: z.number().positive(), // zero/negative payments are never valid
  payment_method: z.enum(['bank_transfer', 'mobile_money', 'cash', 'card', 'other']).default('bank_transfer'),
  reference: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).default('completed'),
});

const paymentRequestSchema = z.object({
  invoice_id: z.number().int().positive(),
});

// 07XXXXXXXX / 0712345678 / +254 7XX XXX XXX -> 254XXXXXXXXX, the format PayHero's STK push expects.
function toMsisdn(phone) {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  if (digits.length < 9) return null;
  return `254${digits.slice(-9)}`;
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    // LEFT JOINs, and scoping on payments.owner_id rather than through the invoice's property.
    // payments.invoice_id is NULLABLE by design: the PayHero webhook records a payment even when it
    // cannot attribute it to an invoice, because unrecorded money is worse than unmatched money. An
    // INNER JOIN silently dropped exactly those rows, so a landlord's most important case — "a tenant
    // paid and I cannot see it" — was the one case the dashboard could not show. owner_id is stamped
    // from the authenticated caller on every write path and is never NULL, so it is a total scope.
    const result = await query(
      `SELECT p.*,
              i.invoice_number,
              t.name AS tenant_name,
              pc.short_code AS channel_short_code,
              pc.channel_type AS channel_type
       FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN payment_channels pc ON pc.id = p.payment_channel_id
       WHERE p.owner_id = $1
       ORDER BY p.paid_at DESC`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch payments');
    return res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = paymentSchema.parse(req.body);

    // All reads + writes commit atomically so a payment and its invoice-status transition can never
    // diverge. The invoice, its ownership, and that the tenant belongs to the SAME property are all
    // verified; owner_id is stamped from the caller (never fabricated or NULL).
    const result = await withTransaction(async (client) => {
      const invoiceRes = await client.query(
        `SELECT i.id, i.amount, i.status, i.property_id
         FROM invoices i
         JOIN properties p ON p.id = i.property_id
         WHERE i.id = $1 AND p.owner_id = $2`,
        [payload.invoice_id, req.user.sub]
      );

      if (invoiceRes.rows.length === 0) return { code: 'forbidden' };
      const invoice = invoiceRes.rows[0];
      if (invoice.status === 'cancelled') return { code: 'cancelled' };

      const tenantRes = await client.query(
        `SELECT id FROM tenants WHERE id = $1 AND property_id = $2`,
        [payload.tenant_id, invoice.property_id]
      );
      if (tenantRes.rows.length === 0) return { code: 'tenant-mismatch' };

      const created = await client.query(
        `INSERT INTO payments (invoice_id, tenant_id, owner_id, amount, payment_method, reference, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [payload.invoice_id, payload.tenant_id, req.user.sub, payload.amount, payload.payment_method, payload.reference ?? null, payload.status]
      );
      const payment = created.rows[0];

      let invoiceStatus = invoice.status;
      if (payload.status === 'completed') {
        const totals = await client.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS total_paid
           FROM payments
           WHERE invoice_id = $1 AND status = 'completed'`,
          [payload.invoice_id]
        );

        const totalPaid = Number(totals.rows[0].total_paid ?? 0);
        const invoiceAmount = Number(invoice.amount);
        invoiceStatus = totalPaid >= invoiceAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

        await client.query(
          `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2`,
          [invoiceStatus, payload.invoice_id]
        );
      }

      return { code: 'ok', payment: { ...payment, invoice_status: invoiceStatus } };
    });

    if (result.code === 'forbidden') return res.status(403).json({ message: 'You do not own this invoice' });
    if (result.code === 'cancelled') return res.status(409).json({ message: 'This invoice is cancelled and cannot receive payments' });
    if (result.code === 'tenant-mismatch') return res.status(403).json({ message: 'Tenant does not belong to this invoice' });
    return res.status(201).json(result.payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    logger.error({ err: error.message }, 'Failed to record payment');
    return res.status(500).json({ message: 'Failed to record payment' });
  }
});

// Ask PayHero to collect from a tenant's phone through one of the landlord's registered channels.
//
// This is the link that makes the webhook reachable. A callback can only ever exist for a collection
// PayHero initiated, so without an endpoint that STARTS one, registering a till proves nothing and no
// payment can ever land on the dashboard. initiateStkPush() existed but was called only by a smoke
// script, so the product could receive money but never ask for it.
//
// external_reference is set to the invoice_number because that is the field the webhook correlates on:
// it is the only identifier guaranteed to reach us in PayHero's callback. callback_url is set per
// request (PayHero documents it as overriding the account-level callback), so the result comes back to
// us even if the account-level setting in their dashboard is missing or stale.
router.post('/request', async (req, res) => {
  try {
    const payload = paymentRequestSchema.parse(req.body);

    const invoiceRes = await query(
      `SELECT i.id, i.invoice_number, i.amount, i.status, t.id AS tenant_id, t.name AS tenant_name, t.phone
       FROM invoices i
       JOIN tenants t ON t.id = i.tenant_id
       JOIN properties prop ON prop.id = i.property_id
       WHERE i.id = $1 AND prop.owner_id = $2`,
      [payload.invoice_id, req.user.sub]
    );

    if (invoiceRes.rows.length === 0) return res.status(403).json({ message: 'You do not own this invoice' });
    const invoice = invoiceRes.rows[0];

    if (invoice.status === 'paid') {
      return res.status(409).json({ message: 'This invoice is already fully paid' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(409).json({ message: 'This invoice is cancelled and cannot receive payments' });
    }

    // Kenyan MSISDNs in any local or international form collapse to 254 + the last 9 digits, which is
    // the format PayHero's STK push expects. Reject anything we cannot normalise rather than sending
    // a malformed number to the provider.
    const msisdn = toMsisdn(invoice.phone);
    if (!msisdn) {
      return res.status(422).json({
        message: `${invoice.tenant_name} has no usable phone number — add one on the tenant before requesting payment`,
      });
    }

    const channelRes = await query(
      `SELECT id, short_code, channel_type, description, payhero_channel_id
       FROM payment_channels
       WHERE owner_id = $1 AND is_active = TRUE AND payhero_channel_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [req.user.sub]
    );
    if (channelRes.rows.length === 0) {
      return res.status(422).json({
        message: 'No active payment channel with a PayHero channel id. Register a Paybill, Till or Bank channel first.',
      });
    }
    const channel = channelRes.rows[0];

    // Request only the outstanding balance, so a part-paid invoice is not over-collected.
    const paidRes = await query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total_paid
       FROM payments WHERE invoice_id = $1 AND status = 'completed'`,
      [invoice.id]
    );
    const outstanding = Number(invoice.amount) - Number(paidRes.rows[0].total_paid ?? 0);
    if (outstanding <= 0) {
      return res.status(409).json({ message: 'This invoice has no outstanding balance' });
    }

    const callbackUrl = payheroCallbackUrl();
    const result = await initiateStkPush({
      amount: outstanding,
      phoneNumber: msisdn,
      channelId: Number(channel.payhero_channel_id),
      externalReference: invoice.invoice_number,
      callbackUrl,
    });

    logger.info(
      { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, channelId: channel.id },
      'PayHero STK push requested'
    );

    return res.status(201).json({
      status: 'requested',
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      tenant_name: invoice.tenant_name,
      phone: msisdn,
      amount: outstanding,
      channel: { id: channel.id, short_code: channel.short_code, channel_type: channel.channel_type },
      // The payment is NOT recorded here. It is created only when PayHero's callback confirms it,
      // so a declined or abandoned prompt can never be mistaken for rent collected.
      provider: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    const message = error.message || 'Unknown error';
    if (/not configured/i.test(message)) {
      return res.status(400).json({ message: 'Payment requests are unavailable — PayHero is not configured on the server.' });
    }
    logger.error({ err: message }, 'Failed to request payment via PayHero');
    return res.status(500).json({ message: `Could not request payment from PayHero: ${message}` });
  }
});

export default router;
