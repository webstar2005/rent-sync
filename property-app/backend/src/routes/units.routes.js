import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePaid } from '../middleware/subscription.js';
import { requireRole } from '../middleware/role.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const unitSchema = z.object({
  unit_number: z.string().min(1, 'Unit number is required'),
  unit_type: z.enum(['bedsitter', '1_bedroom', '2_bedroom', '3_bedroom', 'commercial', 'other']).optional(),
  floor: z.number().int().min(-5).max(100).optional(),
  size_sqm: z.number().positive().max(10000).optional(),
  monthly_rent: z.number().min(0).optional(),
  status: z.enum(['vacant', 'occupied', 'maintenance', 'reserved']).optional(),
  tenant_id: z.number().int().positive().optional().nullable(),
  description: z.string().optional(),
});

const unitUpdateSchema = z.object({
  unit_number: z.string().min(1).optional(),
  unit_type: z.enum(['bedsitter', '1_bedroom', '2_bedroom', '3_bedroom', 'commercial', 'other']).optional(),
  floor: z.number().int().min(-5).max(100).optional(),
  size_sqm: z.number().positive().max(10000).optional(),
  monthly_rent: z.number().min(0).optional(),
  status: z.enum(['vacant', 'occupied', 'maintenance', 'reserved']).optional(),
  tenant_id: z.number().int().positive().optional().nullable(),
  description: z.string().optional(),
});

function applyOwnershipFilter(req, baseQuery, params = []) {
  const isAdmin = req.user?.role === 'admin';
  if (isAdmin) {
    return { query: baseQuery, params };
  }
  return {
    query: `${baseQuery} AND p.owner_id = $${params.length + 1}`,
    params: [...params, req.user.sub],
  };
}

// List units for a property (with search, filter, pagination)
router.get('/property/:propertyId', requireAuth, requirePaid, async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: 'Invalid property ID' });
    }

    // Verify property ownership/access
    const propCheck = await query(
      `SELECT id, owner_id FROM properties WHERE id = $1`,
      [propertyId]
    );
    if (propCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (req.user.role !== 'admin' && propCheck.rows[0].owner_id !== req.user.sub) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    const {
      search = '',
      status = 'all',
      page = '1',
      limit = '20',
      sort = 'unit_number',
      order = 'asc',
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const allowedSort = ['unit_number', 'unit_type', 'floor', 'monthly_rent', 'status', 'created_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'unit_number';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const whereConditions = ['u.property_id = $1'];
    const queryParams = [propertyId];
    let paramIdx = 2;

    if (status !== 'all') {
      whereConditions.push(`u.status = $${paramIdx}`);
      queryParams.push(status);
      paramIdx++;
    }

    if (search.trim()) {
      whereConditions.push(`(
        u.unit_number ILIKE $${paramIdx}
        OR u.unit_type ILIKE $${paramIdx}
        OR t.name ILIKE $${paramIdx}
        OR u.description ILIKE $${paramIdx}
      )`);
      queryParams.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countResult = await query(
      `SELECT COUNT(*)::int FROM units u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE ${whereClause}`,
      queryParams
    );
    const total = countResult.rows[0].count;

    // Fetch units with tenant info
    const result = await query(
      `SELECT
         u.*,
         t.id AS tenant_id,
         t.name AS tenant_name,
         t.phone AS tenant_phone,
         t.email AS tenant_email,
         t.status AS tenant_status
       FROM units u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE ${whereClause}
       ORDER BY u.${sortCol} ${sortOrder}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...queryParams, limitNum, offset]
    );

    return res.json({
      units: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch units');
    return res.status(500).json({ message: 'Failed to fetch units' });
  }
});

// Get unit detail with renter and payment history
router.get('/:unitId', requireAuth, requirePaid, async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (!Number.isInteger(unitId) || unitId <= 0) {
      return res.status(400).json({ message: 'Invalid unit ID' });
    }

    const result = await query(
      `SELECT
         u.*,
         p.id AS property_id,
         p.name AS property_name,
         p.owner_id AS property_owner_id,
         p.address AS property_address,
         t.id AS tenant_id,
         t.name AS tenant_name,
         t.phone AS tenant_phone,
         t.email AS tenant_email,
         t.monthly_rent AS tenant_monthly_rent,
         t.lease_start,
         t.lease_end,
         t.status AS tenant_status,
         t.created_at AS tenant_created_at,
         owner.name AS landlord_name,
         owner.email AS landlord_email
       FROM units u
       JOIN properties p ON u.property_id = p.id
       JOIN users owner ON p.owner_id = owner.id
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [unitId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    const unit = result.rows[0];

    // Authorization: landlord can only see their own property's units
    if (req.user.role !== 'admin' && unit.property_owner_id !== req.user.sub) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    // Fetch payment history for this unit (via tenant)
    let paymentHistory = [];
    if (unit.tenant_id) {
      const paymentsResult = await query(
        `SELECT
           pay.*,
           inv.invoice_number,
           inv.due_date,
           inv.amount AS invoice_amount,
           t.name AS tenant_name,
           pc.short_code AS channel_short_code
         FROM payments pay
         LEFT JOIN invoices inv ON pay.invoice_id = inv.id
         LEFT JOIN tenants t ON t.id = pay.tenant_id
         LEFT JOIN payment_channels pc ON pc.id = pay.payment_channel_id
         WHERE pay.tenant_id = $1
         ORDER BY pay.paid_at DESC
         LIMIT 50`,
        [unit.tenant_id]
      );
      paymentHistory = paymentsResult.rows;
    }

    return res.json({
      ...unit,
      payment_history: paymentHistory,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch unit detail');
    return res.status(500).json({ message: 'Failed to fetch unit detail' });
  }
});

// Create unit
router.post('/property/:propertyId', requireAuth, requirePaid, async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: 'Invalid property ID' });
    }

    // Verify property ownership
    const propCheck = await query(
      `SELECT id, owner_id, units FROM properties WHERE id = $1`,
      [propertyId]
    );
    if (propCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (req.user.role !== 'admin' && propCheck.rows[0].owner_id !== req.user.sub) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    const payload = unitSchema.parse(req.body);

    // Check unit number uniqueness within property
    const existing = await query(
      `SELECT id FROM units WHERE property_id = $1 AND unit_number = $2`,
      [propertyId, payload.unit_number]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: `Unit ${payload.unit_number} already exists for this property` });
    }

    // If tenant_id provided, verify tenant belongs to this property and is not already assigned
    if (payload.tenant_id) {
      const tenantCheck = await query(
        `SELECT id, property_id, unit_number FROM tenants WHERE id = $1`,
        [payload.tenant_id]
      );
      if (tenantCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Tenant not found' });
      }
      const tenant = tenantCheck.rows[0];
      if (tenant.property_id !== propertyId) {
        return res.status(400).json({ message: 'Tenant does not belong to this property' });
      }
      // Check if tenant already has a unit
      const existingUnit = await query(
        `SELECT id FROM units WHERE tenant_id = $1 AND id != (SELECT id FROM units WHERE tenant_id = $1 LIMIT 1)`,
        [payload.tenant_id]
      );
      // Actually simpler: check if this tenant is already assigned to another unit
      const tenantUnitCheck = await query(
        `SELECT id FROM units WHERE tenant_id = $1 AND property_id = $2`,
        [payload.tenant_id, propertyId]
      );
      if (tenantUnitCheck.rows.length > 0 && tenantUnitCheck.rows[0].unit_number !== payload.unit_number) {
        return res.status(409).json({ message: 'This tenant is already assigned to another unit' });
      }
    }

    const result = await query(
      `INSERT INTO units (property_id, unit_number, unit_type, floor, size_sqm, monthly_rent, status, tenant_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        propertyId,
        payload.unit_number,
        payload.unit_type ?? null,
        payload.floor ?? null,
        payload.size_sqm ?? null,
        payload.monthly_rent ?? 0,
        payload.status ?? 'vacant',
        payload.tenant_id ?? null,
        payload.description ?? null,
      ]
    );

    // If tenant assigned, update tenant's unit_number to match (sync)
    if (payload.tenant_id) {
      await query(
        `UPDATE tenants SET unit_number = $1, updated_at = NOW() WHERE id = $2`,
        [payload.unit_number, payload.tenant_id]
      );
    }

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Failed to create unit');
    return res.status(500).json({ message: 'Failed to create unit' });
  }
});

// Update unit
router.patch('/:unitId', requireAuth, requirePaid, async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (!Number.isInteger(unitId) || unitId <= 0) {
      return res.status(400).json({ message: 'Invalid unit ID' });
    }

    const payload = unitUpdateSchema.parse(req.body);

    // Fetch unit with property ownership
    const unitCheck = await query(
      `SELECT u.*, p.owner_id FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = $1`,
      [unitId]
    );
    if (unitCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Unit not found' });
    }
    const unit = unitCheck.rows[0];
    if (req.user.role !== 'admin' && unit.owner_id !== req.user.sub) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    // If unit_number changing, check uniqueness
    if (payload.unit_number && payload.unit_number !== unit.unit_number) {
      const existing = await query(
        `SELECT id FROM units WHERE property_id = $1 AND unit_number = $2`,
        [unit.property_id, payload.unit_number]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: `Unit ${payload.unit_number} already exists for this property` });
      }
    }

    // If tenant_id provided/changed, verify
    if (payload.tenant_id !== undefined) {
      if (payload.tenant_id !== null) {
        const tenantCheck = await query(
          `SELECT id, property_id FROM tenants WHERE id = $1`,
          [payload.tenant_id]
        );
        if (tenantCheck.rows.length === 0) {
          return res.status(404).json({ message: 'Tenant not found' });
        }
        if (tenantCheck.rows[0].property_id !== unit.property_id) {
          return res.status(400).json({ message: 'Tenant does not belong to this property' });
        }
        // Check if tenant already assigned to another unit
        const otherUnit = await query(
          `SELECT id FROM units WHERE tenant_id = $1 AND id != $2`,
          [payload.tenant_id, unitId]
        );
        if (otherUnit.rows.length > 0) {
          return res.status(409).json({ message: 'This tenant is already assigned to another unit' });
        }
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
    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(unitId);

    const result = await query(
      `UPDATE units SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Sync tenant unit_number if changed
    if (payload.unit_number && payload.unit_number !== unit.unit_number) {
      if (unit.tenant_id) {
        await query(
          `UPDATE tenants SET unit_number = $1, updated_at = NOW() WHERE id = $2`,
          [payload.unit_number, unit.tenant_id]
        );
      }
      if (payload.tenant_id && payload.tenant_id !== unit.tenant_id) {
        await query(
          `UPDATE tenants SET unit_number = $1, updated_at = NOW() WHERE id = $2`,
          [payload.unit_number, payload.tenant_id]
        );
      }
    }

    // If tenant_id cleared, sync old tenant
    if (payload.tenant_id === null && unit.tenant_id) {
      await query(
        `UPDATE tenants SET unit_number = '', updated_at = NOW() WHERE id = $1`,
        [unit.tenant_id]
      );
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Failed to update unit');
    return res.status(500).json({ message: 'Failed to update unit' });
  }
});

// Delete unit
router.delete('/:unitId', requireAuth, requirePaid, async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (!Number.isInteger(unitId) || unitId <= 0) {
      return res.status(400).json({ message: 'Invalid unit ID' });
    }

    const unitCheck = await query(
      `SELECT u.*, p.owner_id FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = $1`,
      [unitId]
    );
    if (unitCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Unit not found' });
    }
    if (req.user.role !== 'admin' && unitCheck.rows[0].owner_id !== req.user.sub) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    // Clear tenant assignment if any
    if (unitCheck.rows[0].tenant_id) {
      await query(
        `UPDATE tenants SET unit_number = '', updated_at = NOW() WHERE id = $1`,
        [unitCheck.rows[0].tenant_id]
      );
    }

    await query(`DELETE FROM units WHERE id = $1`, [unitId]);
    return res.status(204).send();
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to delete unit');
    return res.status(500).json({ message: 'Failed to delete unit' });
  }
});

// Admin: assign/change property landlord
router.patch('/property/:propertyId/landlord', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const { landlord_id } = req.body;

    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: 'Invalid property ID' });
    }
    if (!Number.isInteger(landlord_id) || landlord_id <= 0) {
      return res.status(400).json({ message: 'Invalid landlord ID' });
    }

    // Verify landlord exists and has landlord role
    const landlordCheck = await query(
      `SELECT id, role FROM users WHERE id = $1`,
      [landlord_id]
    );
    if (landlordCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Landlord not found' });
    }
    if (landlordCheck.rows[0].role !== 'landlord') {
      return res.status(400).json({ message: 'User must have landlord role' });
    }

    const result = await query(
      `UPDATE properties SET owner_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [landlord_id, propertyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to assign landlord');
    return res.status(500).json({ message: 'Failed to assign landlord' });
  }
});

// Admin: list all properties with landlord info
router.get('/admin/properties', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.name AS landlord_name, u.email AS landlord_email
       FROM properties p
       LEFT JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch admin properties');
    return res.status(500).json({ message: 'Failed to fetch properties' });
  }
});

export default router;