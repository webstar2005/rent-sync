import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnerOrAdmin } from '../middleware/role.js';
import { generateMonthlyInvoices, markOverdueInvoices } from '../services/invoiceService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const invoiceSchema = z.object({
  tenant_id: z.number().int(),
  property_id: z.number().int(),
  invoice_number: z.string().min(3),
  amount: z.number().min(0),
  due_date: z.string().min(1),
  notes: z.string().optional(),
});

const invoiceGenerateSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM').optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, t.name AS tenant_name, p.name AS property_name
       FROM invoices i
       JOIN tenants t ON t.id = i.tenant_id
       JOIN properties p ON p.id = i.property_id
       WHERE p.owner_id = $1
       ORDER BY i.due_date DESC`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch invoices');
    return res.status(500).json({ message: 'Failed to fetch invoices' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = invoiceSchema.parse(req.body);

    const propertyCheck = await query(
      `SELECT id FROM properties WHERE id = $1 AND owner_id = $2`,
      [payload.property_id, req.user.sub]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    const tenantCheck = await query(
      `SELECT id FROM tenants WHERE id = $1 AND property_id = $2`,
      [payload.tenant_id, payload.property_id]
    );

    if (tenantCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Tenant not found in this property' });
    }

    const result = await query(
      `INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, notes, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING *`,
      [payload.tenant_id, payload.property_id, payload.invoice_number, payload.amount, payload.due_date, payload.notes ?? null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    logger.error({ err: error.message }, 'Failed to create invoice');
    return res.status(500).json({ message: 'Failed to create invoice' });
  }
});

// Auto-generate next month's rent invoices for the caller's ACTIVE tenants on ACTIVE properties.
// Idempotent — re-running never duplicates an already-billed period. Also flips unpaid pending
// invoices that have fallen past their due date to `overdue`.
router.post('/generate', requireOwnerOrAdmin, async (req, res) => {
  try {
    const params = invoiceGenerateSchema.parse(req.body ?? {});
    const [generated, overdue] = await Promise.all([
      generateMonthlyInvoices({ ownerId: req.user.sub, month: params.month }),
      markOverdueInvoices({ ownerId: req.user.sub }),
    ]);
    return res.json({ ...generated, overdue_marked: overdue.marked });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Invoice generation failed');
    return res.status(500).json({ message: 'Failed to generate invoices' });
  }
});

export default router;
