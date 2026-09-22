import express from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
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

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, i.invoice_number, t.name AS tenant_name
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN tenants t ON t.id = p.tenant_id
       JOIN properties prop ON prop.id = i.property_id
       WHERE prop.owner_id = $1
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

export default router;
