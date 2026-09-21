import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = express.Router();

const propertySchema = z.object({
  name: z.string().min(2, 'Property name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  units: z.number().int().min(1, 'Units must be at least 1').optional(),
  rent_due_day: z.number().int().min(1).max(28).optional(),
});

const propertyUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  units: z.number().int().min(1).optional(),
  rent_due_day: z.number().int().min(1).max(28).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
});

const paymentSettingsSchema = z.object({
  property_id: z.number().int(),
  mpesa_paybill: z.string().optional(),
  mpesa_account_number: z.string().optional(),
  mpesa_till: z.string().optional(),
  mpesa_account_number_format: z.enum(['invoice_number', 'tenant_name', 'custom']).default('invoice_number'),
  bank_name: z.string().optional(),
  bank_account_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_reference_format: z.enum(['invoice_number', 'tenant_name', 'custom']).default('invoice_number'),
  allowed_methods: z.array(z.enum(['mobile_money', 'bank_transfer', 'cash', 'card', 'other'])).optional(),
  notes: z.string().optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM properties WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch properties', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = propertySchema.parse(req.body);

    const result = await query(
      `INSERT INTO properties (owner_id, name, address, units, rent_due_day, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.user.sub, payload.name, payload.address, payload.units ?? 1, payload.rent_due_day ?? 5]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(500).json({ message: 'Failed to create property', error: error.message });
  }
});

router.patch('/:propertyId', async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const payload = propertyUpdateSchema.parse(req.body);

    const check = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [propertyId, req.user.sub]);
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    values.push(propertyId);
    const result = await query(
      `UPDATE properties SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    return res.status(500).json({ message: 'Failed to update property', error: error.message });
  }
});

router.delete('/:propertyId', requireRole('landlord', 'admin'), async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const check = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [propertyId, req.user.sub]);
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }
    // ON DELETE CASCADE will remove tenants/invoices/payments/maintenance/property_members/payment_settings for this property
    await query('DELETE FROM properties WHERE id = $1', [propertyId]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete property', error: error.message });
  }
});

router.get('/:propertyId/payment-settings', async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);

    const result = await query(
      `SELECT *
       FROM property_payment_settings
       WHERE property_id = $1`,
      [propertyId]
    );

    return res.json(result.rows[0] ?? null);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payment settings', error: error.message });
  }
});

router.post('/:propertyId/payment-settings', async (req, res) => {
  try {
    const payload = paymentSettingsSchema.parse(req.body);

    const propertyCheck = await query(
      `SELECT id FROM properties WHERE id = $1 AND owner_id = $2`,
      [payload.property_id, req.user.sub]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    const result = await query(
      `INSERT INTO property_payment_settings (
        property_id,
        mpesa_paybill,
        mpesa_account_number,
        mpesa_till,
        mpesa_account_number_format,
        bank_name,
        bank_account_name,
        bank_account_number,
        bank_reference_format,
        allowed_methods,
        notes,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
      )
      ON CONFLICT (property_id)
      DO UPDATE SET
        mpesa_paybill = EXCLUDED.mpesa_paybill,
        mpesa_account_number = EXCLUDED.mpesa_account_number,
        mpesa_till = EXCLUDED.mpesa_till,
        mpesa_account_number_format = EXCLUDED.mpesa_account_number_format,
        bank_name = EXCLUDED.bank_name,
        bank_account_name = EXCLUDED.bank_account_name,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_reference_format = EXCLUDED.bank_reference_format,
        allowed_methods = EXCLUDED.allowed_methods,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        payload.property_id,
        payload.mpesa_paybill ?? null,
        payload.mpesa_account_number ?? null,
        payload.mpesa_till ?? null,
        payload.mpesa_account_number_format,
        payload.bank_name ?? null,
        payload.bank_account_name ?? null,
        payload.bank_account_number ?? null,
        payload.bank_reference_format,
        payload.allowed_methods ?? ['mobile_money', 'bank_transfer'],
        payload.notes ?? null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    return res.status(500).json({ message: 'Failed to save payment settings', error: error.message });
  }
});

export default router;
