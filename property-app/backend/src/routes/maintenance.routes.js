import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const maintenanceSchema = z.object({
  property_id: z.number().int(),
  tenant_id: z.number().int().optional(),
  title: z.string().min(3),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
});

const maintenanceUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  tenant_id: z.number().int().nullable().optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT mr.*, p.name AS property_name, t.name AS tenant_name
       FROM maintenance_requests mr
       JOIN properties p ON p.id = mr.property_id
       LEFT JOIN tenants t ON t.id = mr.tenant_id
       WHERE p.owner_id = $1
       ORDER BY mr.created_at DESC`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch maintenance requests');
    return res.status(500).json({ message: 'Failed to fetch maintenance requests' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = maintenanceSchema.parse(req.body);

    const propertyCheck = await query(
      `SELECT id FROM properties WHERE id = $1 AND owner_id = $2`,
      [payload.property_id, req.user.sub]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this property' });
    }

    if (payload.tenant_id) {
      const tenantCheck = await query(
        `SELECT id FROM tenants WHERE id = $1 AND property_id = $2`,
        [payload.tenant_id, payload.property_id]
      );

      if (tenantCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Tenant does not belong to this property' });
      }
    }

    const result = await query(
      `INSERT INTO maintenance_requests (property_id, tenant_id, title, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [payload.property_id, payload.tenant_id ?? null, payload.title, payload.description, payload.priority, payload.status]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    logger.error({ err: error.message }, 'Failed to create maintenance request');
    return res.status(500).json({ message: 'Failed to create maintenance request' });
  }
});

router.patch('/:maintenanceId', async (req, res) => {
  try {
    const maintenanceId = Number(req.params.maintenanceId);
    const payload = maintenanceUpdateSchema.parse(req.body);

    const check = await query(
      `SELECT mr.id FROM maintenance_requests mr JOIN properties p ON p.id=mr.property_id WHERE mr.id=$1 AND p.owner_id=$2`,
      [maintenanceId, req.user.sub]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this maintenance request' });
    }

    if (payload.tenant_id !== undefined) {
      if (payload.tenant_id !== null) {
        const tenantCheck = await query(`SELECT id FROM tenants WHERE id=$1 AND property_id=(SELECT property_id FROM maintenance_requests WHERE id=$2)`, [payload.tenant_id, maintenanceId]);
        if (tenantCheck.rows.length === 0) {
          return res.status(400).json({ message: 'Tenant does not belong to this property' });
        }
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined) {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
      }
    }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
    values.push(maintenanceId);
    const result = await query(
      `UPDATE maintenance_requests SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING *`,
      values
    );
    return res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Failed to update maintenance request');
    return res.status(500).json({ message: 'Failed to update maintenance request' });
  }
});

router.delete('/:maintenanceId', async (req, res) => {
  try {
    const maintenanceId = Number(req.params.maintenanceId);
    const check = await query(
      `SELECT mr.id FROM maintenance_requests mr JOIN properties p ON p.id=mr.property_id WHERE mr.id=$1 AND p.owner_id=$2`,
      [maintenanceId, req.user.sub]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this maintenance request' });
    }
    await query('DELETE FROM maintenance_requests WHERE id=$1', [maintenanceId]);
    return res.status(204).send();
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to delete maintenance request');
    return res.status(500).json({ message: 'Failed to delete maintenance request' });
  }
});

export default router;
