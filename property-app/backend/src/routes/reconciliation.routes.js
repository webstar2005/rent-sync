import express from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const paymentMatchSchema = z.object({
  property_id: z.number().int().min(1),
  tenant_name: z.string().trim().min(1),
  amount: z.number().min(0.01),
  payment_method: z.enum(['bank_transfer', 'mobile_money', 'cash', 'card', 'other']).default('bank_transfer'),
  reference: z.string().trim().optional(),
  transaction_ref: z.string().trim().optional(),
  invoice_id: z.number().int().positive().optional(),
  raw_payload: z.any().optional(),
});

function normalizeTenantName(value = '') {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

router.use(requireAuth);

router.get('/alerts', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.id,
              e.match_status,
              e.transaction_ref,
              e.payment_method,
              e.created_at,
              i.invoice_number,
              i.amount AS invoice_amount,
              t.name AS tenant_name,
              p.name AS property_name
       FROM payment_reconciliation_events e
       LEFT JOIN invoices i ON i.id = e.invoice_id
       LEFT JOIN tenants t ON t.id = e.tenant_id
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE e.owner_id = $1 OR p.owner_id = $1
       ORDER BY e.created_at DESC
       LIMIT 100`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch reconciliation alerts');
    return res.status(500).json({ message: 'Failed to fetch reconciliation alerts' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE match_status = 'unmatched') AS unmatched_count,
         COUNT(*) FILTER (WHERE match_status = 'duplicate') AS duplicate_count,
         COUNT(*) FILTER (WHERE match_status = 'manual_review') AS manual_review_count,
         COUNT(*) FILTER (WHERE match_status = 'matched') AS matched_count
       FROM payment_reconciliation_events e
       LEFT JOIN invoices i ON i.id = e.invoice_id
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE p.owner_id = $1 OR e.owner_id = $1`,
      [req.user.sub]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch reconciliation summary');
    return res.status(500).json({ message: 'Failed to fetch reconciliation summary' });
  }
});

router.post('/reconcile', async (req, res) => {
  try {
    const payload = paymentMatchSchema.parse(req.body);

    const propertyCheck = await query(
      `SELECT id FROM properties WHERE id = $1 AND owner_id = $2`,
      [payload.property_id, req.user.sub]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    const normalizedName = normalizeTenantName(payload.tenant_name);

    let tenantResult;
    if (payload.invoice_id) {
      tenantResult = await query(
        `SELECT t.*
         FROM invoices i
         JOIN tenants t ON t.id = i.tenant_id
         WHERE i.id = $1 AND i.property_id = $2 AND t.property_id = $2`,
        [payload.invoice_id, payload.property_id]
      );
    }

    if (!tenantResult || tenantResult.rows.length === 0) {
      tenantResult = await query(
        `SELECT *
         FROM tenants
         WHERE property_id = $1
           AND LOWER(TRIM(name)) = $2`,
        [payload.property_id, normalizedName]
      );
    }

    if (tenantResult.rows.length === 0) {
      await query(
        `INSERT INTO payment_reconciliation_events (invoice_id, tenant_id, owner_id, payment_method, transaction_ref, raw_payload, match_status)
         VALUES (NULL, NULL, $1, $2, $3, $4, 'unmatched')`,
        [req.user.sub, payload.payment_method, payload.transaction_ref ?? payload.reference ?? `manual-${Date.now()}`, JSON.stringify(payload.raw_payload ?? payload)]
      );

      return res.status(404).json({ message: 'No tenant was matched for this reference in the selected property.' });
    }

    if (tenantResult.rows.length > 1) {
      return res.status(409).json({ message: 'More than one tenant matches this name in the property. Please use the exact tenant record or resolve the duplicate name.' });
    }

    const tenant = tenantResult.rows[0];

    // The duplicate check, payment insert and invoice transition must commit atomically. A per-tenant
    // advisory lock serializes concurrent reconciles so the same payment can never be double-counted.
    const outcome = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [tenant.id]);

      const duplicateCheck = payload.transaction_ref
        ? await client.query('SELECT id FROM payments WHERE transaction_ref = $1', [payload.transaction_ref])
        : await client.query('SELECT id FROM payments WHERE reference = $1 AND tenant_id = $2 AND amount = $3', [payload.reference ?? payload.tenant_name, tenant.id, payload.amount]);

      if (duplicateCheck.rows.length > 0) {
        await client.query(
          `INSERT INTO payment_reconciliation_events (invoice_id, tenant_id, owner_id, payment_method, transaction_ref, raw_payload, match_status)
           VALUES (NULL, $1, $2, $3, $4, $5, 'duplicate')`,
          [tenant.id, req.user.sub, payload.payment_method, payload.transaction_ref ?? payload.reference ?? `manual-${Date.now()}`, JSON.stringify(payload.raw_payload ?? payload)]
        );

        return { duplicate: true };
      }

      let invoiceResult;
      if (payload.invoice_id) {
        invoiceResult = await client.query(
          `SELECT * FROM invoices WHERE id = $1 AND property_id = $2 AND tenant_id = $3`,
          [payload.invoice_id, payload.property_id, tenant.id]
        );
      }

      if (!invoiceResult || invoiceResult.rows.length === 0) {
        invoiceResult = await client.query(
          `SELECT *
           FROM invoices
           WHERE tenant_id = $1 AND property_id = $2 AND status IN ('pending', 'partial', 'overdue')
           ORDER BY due_date ASC
           LIMIT 1`,
          [tenant.id, payload.property_id]
        );
      }

      if (invoiceResult.rows.length === 0) {
        await client.query(
          `INSERT INTO payment_reconciliation_events (invoice_id, tenant_id, owner_id, payment_method, transaction_ref, raw_payload, match_status)
           VALUES (NULL, $1, $2, $3, $4, $5, 'manual_review')`,
          [tenant.id, req.user.sub, payload.payment_method, payload.transaction_ref ?? payload.reference ?? `manual-${Date.now()}`, JSON.stringify(payload.raw_payload ?? payload)]
        );

        return { manualReview: true };
      }

      const invoice = invoiceResult.rows[0];
      const paymentResult = await client.query(
        `INSERT INTO payments (invoice_id, tenant_id, owner_id, amount, payment_method, reference, transaction_ref, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
         RETURNING *`,
        [invoice.id, tenant.id, req.user.sub, payload.amount, payload.payment_method, payload.reference ?? payload.tenant_name, payload.transaction_ref ?? `manual-${Date.now()}`]
      );

      const totals = await client.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total_paid
         FROM payments
         WHERE invoice_id = $1 AND status = 'completed'`,
        [invoice.id]
      );
      const totalPaid = Number(totals.rows[0].total_paid ?? 0);
      const invoiceAmount = Number(invoice.amount ?? 0);
      const nextStatus = totalPaid >= invoiceAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

      await client.query(
        `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2`,
        [nextStatus, invoice.id]
      );

      await client.query(
        `INSERT INTO payment_reconciliation_events (invoice_id, tenant_id, owner_id, payment_method, transaction_ref, raw_payload, match_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'matched')`,
        [invoice.id, tenant.id, req.user.sub, payload.payment_method, paymentResult.rows[0].transaction_ref, JSON.stringify(payload.raw_payload ?? payload)]
      );

      return { payment: paymentResult.rows[0], invoiceStatus: nextStatus, invoice };
    });

    if (outcome.duplicate) {
      return res.status(409).json({ message: 'This payment has already been recorded.' });
    }
    if (outcome.manualReview) {
      return res.status(202).json({ message: 'Tenant matched, but no open invoice was found for manual review.' });
    }

    return res.status(201).json({
      payment: outcome.payment,
      invoiceStatus: outcome.invoiceStatus,
      tenant,
      invoice: outcome.invoice,
      match_status: 'matched',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    logger.error({ err: error.message }, 'Failed to reconcile payment');
    return res.status(500).json({ message: 'Failed to reconcile payment' });
  }
});

export default router;
