import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePaid } from '../middleware/subscription.js';
import { requireRole } from '../middleware/role.js';
import { checkUnitCapacity, unitLimitResponse } from '../services/units.js';
import { logger } from '../utils/logger.js'

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

router.use(requireAuth, requirePaid);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM properties WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch properties');
    return res.status(500).json({ message: 'Failed to fetch properties' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = propertySchema.parse(req.body);

    // The cap is checked before the insert rather than by a database constraint, because the
    // refusal has to say what the number is and which plan would cover it. A CHECK constraint cannot
    // do that, and a landlord told only "limit reached" cannot tell whether they are one unit over
    // or four hundred.
    const capacity = await checkUnitCapacity({ user: req.user, addingUnits: payload.units ?? 1 });
    if (!capacity.allowed) {
      return res.status(409).json(unitLimitResponse({ capacity, user: req.user }));
    }

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

    logger.error({ err: error.message }, 'Failed to create property');
    return res.status(500).json({ message: 'Failed to create property' });
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

    // Only the units field can push a landlord over their plan, and only when it goes up: renaming a
    // property or pushing a rent due date out must never be blocked by a quota. checkUnitCapacity
    // credits the property's current units back before comparing, so saving a property unchanged
    // cannot count its own units twice.
    if (payload.units !== undefined) {
      const capacity = await checkUnitCapacity({
        user: req.user,
        addingUnits: payload.units,
        replacingPropertyId: propertyId,
      });
      if (!capacity.allowed) {
        return res.status(409).json(unitLimitResponse({ capacity, user: req.user }));
      }
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
    logger.error({ err: error.message }, 'Failed to update property');
    return res.status(500).json({ message: 'Failed to update property' });
  }
});

router.delete('/:propertyId', requireRole('landlord', 'admin'), async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const check = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [propertyId, req.user.sub]);
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }
    // ON DELETE CASCADE will remove tenants/invoices/payments/maintenance/property_members for this property
    await query('DELETE FROM properties WHERE id = $1', [propertyId]);
    return res.status(204).send();
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to delete property');
    return res.status(500).json({ message: 'Failed to delete property' });
  }
});

export default router;
