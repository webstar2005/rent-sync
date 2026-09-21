import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const paymentSchema = z.object({
  invoice_id: z.number().int(),
  tenant_id: z.number().int(),
  amount: z.number().min(0),
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
    return res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = paymentSchema.parse(req.body);

    const invoiceCheck = await query(
      `SELECT i.id, i.amount, i.status
       FROM invoices i
       JOIN properties p ON p.id = i.property_id
       WHERE i.id = $1 AND p.owner_id = $2`,
      [payload.invoice_id, req.user.sub]
    );

    if (invoiceCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this invoice' });
    }

    const invoice = invoiceCheck.rows[0];
    const paymentStatus = payload.status;

    const result = await query(
      `INSERT INTO payments (invoice_id, tenant_id, amount, payment_method, reference, status, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [payload.invoice_id, payload.tenant_id, payload.amount, payload.payment_method, payload.reference ?? null, paymentStatus]
    );

    const payment = result.rows[0];

    if (paymentStatus === 'completed' || paymentStatus === 'pending' || paymentStatus === 'refunded') {
      const totals = await query(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM payments
         WHERE invoice_id = $1 AND status = 'completed'`,
        [payload.invoice_id]
      );

      const totalPaid = Number(totals.rows[0].total_paid ?? 0);
      const invoiceAmount = Number(invoice.amount);

      let nextInvoiceStatus = 'pending';
      if (totalPaid >= invoiceAmount) {
        nextInvoiceStatus = 'paid';
      } else if (totalPaid > 0) {
        nextInvoiceStatus = 'partial';
      }

      await query(
        `UPDATE invoices
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [nextInvoiceStatus, payload.invoice_id]
      );

      payment.invoice_status = nextInvoiceStatus;
    }

    return res.status(201).json(payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(500).json({ message: 'Failed to record payment', error: error.message });
  }
});

export default router;
