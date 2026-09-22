import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnerOrAdmin } from '../middleware/role.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireOwnerOrAdmin);

const arrearsSchema = z.object({
  property_id: z.coerce.number().int().optional(),
});

const collectionRateSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

// --- helpers ---

// CSV cells starting with = + - @ tab CR LF are Excel/Google Sheets formula triggers — a crafted
// tenant/property/ref value in an exported CSV would execute once opened. Neutralize by prefixing
// with a single quote (standard OWASP CSV-injection mitigation).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Untrusted names (tenant/property) end up in the Content-Disposition filename — strip anything
// that could break the header or surprise the browser.
function safeFilename(value, fallback) {
  const cleaned = String(value ?? '').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
  return cleaned || fallback;
}

function rowsToCsv(rows, columns) {
  const header = columns.map(csvEscape).join(',');
  const lines = rows.map(row => columns.map(col => csvEscape(row[col])).join(','));
  return [header, ...lines].join('\n');
}

function sendCsv(res, filename, rows, columns) {
  const csv = rowsToCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}

// --- endpoints ---

// GET /api/reports/arrears
// Per-property arrears summary for the authenticated owner.
// ?property_id= scopes to a single property.
router.get('/arrears', async (req, res) => {
  try {
    const params = arrearsSchema.parse(req.query);

    const result = await query(
      `SELECT
         p.id AS property_id,
         p.name AS property_name,
         COUNT(DISTINCT i.id) AS total_invoices,
         COALESCE(SUM(i.amount), 0) AS total_invoiced,
         COALESCE(SUM(CASE WHEN i.status IN ('paid', 'partial') THEN pmt.paid_total ELSE 0 END), 0) AS total_paid,
         GREATEST(
           COALESCE(SUM(i.amount), 0) - COALESCE(SUM(CASE WHEN i.status IN ('paid', 'partial') THEN pmt.paid_total ELSE 0 END), 0),
           0
         ) AS outstanding,
         (COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'overdue'))::int AS overdue_count,
         (COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'pending'))::int AS pending_count
       FROM properties p
       LEFT JOIN invoices i ON i.property_id = p.id AND i.status <> 'cancelled'
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(py.amount), 0) AS paid_total
         FROM payments py
         WHERE py.invoice_id = i.id
           AND py.status = 'completed'
       ) pmt ON TRUE
       WHERE p.owner_id = $1
         AND p.status = 'active'
         AND ($2::int IS NULL OR p.id = $2)
       GROUP BY p.id, p.name
       ORDER BY outstanding DESC, p.name`,
      [req.user.sub, params.property_id ?? null]
    );

    if (req.query.format === 'csv') {
      return sendCsv(res, 'arrears.csv', result.rows, [
        'property_id', 'property_name', 'total_invoices', 'total_invoiced',
        'total_paid', 'outstanding', 'overdue_count', 'pending_count',
      ]);
    }

    return res.json(result.rows);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Failed to fetch arrears');
    return res.status(500).json({ message: 'Failed to fetch arrears' });
  }
});

// GET /api/reports/collection-rate?months=12
// Monthly collection rate for the last N months: invoiced vs collected, per month.
router.get('/collection-rate', async (req, res) => {
  try {
    const { months } = collectionRateSchema.parse(req.query);

    const result = await query(
      `WITH months AS (
         SELECT
           to_char(d, 'YYYY-MM') AS month,
           (d + INTERVAL '1 month')::date AS period_start,
           (d + INTERVAL '2 month')::date AS period_end
         FROM generate_series(
           (CURRENT_DATE - ($1::int || ' months')::interval)::date,
           (CURRENT_DATE - INTERVAL '1 month')::date,
           '1 month'
         ) d
       )
       SELECT
         m.month,
         COALESCE(SUM(i.amount), 0) AS invoiced,
         COALESCE(SUM(py.collected), 0) AS collected,
         CASE WHEN COALESCE(SUM(i.amount), 0) = 0 THEN 0
              ELSE ROUND(COALESCE(SUM(py.collected), 0) / SUM(i.amount) * 100, 1)
         END AS collection_rate_pct
       FROM months m
       LEFT JOIN invoices i
         ON i.property_id IN (SELECT id FROM properties WHERE owner_id = $2 AND status = 'active')
         AND i.due_date >= m.period_start
         AND i.due_date < m.period_end
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(py.amount), 0) AS collected
         FROM payments py
         WHERE py.invoice_id = i.id
           AND py.status = 'completed'
           AND py.paid_at < m.period_end
       ) py ON TRUE
       GROUP BY m.month
       ORDER BY m.month`,
      [months, req.user.sub]
    );

    if (req.query.format === 'csv') {
      return sendCsv(res, 'collection-rate.csv', result.rows, [
        'month', 'invoiced', 'collected', 'collection_rate_pct',
      ]);
    }

    return res.json(result.rows);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Failed to fetch collection rate');
    return res.status(500).json({ message: 'Failed to fetch collection rate' });
  }
});

// GET /api/reports/tenant-statement/:tenantId
// Invoice + payment history for a specific tenant with running balance.
// Owner-scoped: returns 404 if tenant belongs to another landlord.
router.get('/tenant-statement/:tenantId', async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    if (!Number.isFinite(tenantId) || tenantId < 1) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }

    // Verify the tenant belongs to an active property owned by this user
    const access = await query(
      `SELECT t.id, t.name, t.unit_number, t.monthly_rent,
              p.id AS property_id, p.name AS property_name
       FROM tenants t
       JOIN properties p ON p.id = t.property_id
       WHERE t.id = $1 AND p.owner_id = $2`,
      [tenantId, req.user.sub]
    );

    if (access.rows.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const tenantInfo = access.rows[0];

    const rows = await query(
      `SELECT x.type, x.ref_number, x.occurred_at, x.amount
       FROM (
         SELECT
           'invoice' AS type,
           i.invoice_number AS ref_number,
           i.due_date AS occurred_at,
           i.amount AS amount
         FROM invoices i
         WHERE i.tenant_id = $1

         UNION ALL

         SELECT
           'payment' AS type,
           COALESCE(py.transaction_ref, py.reference, 'payment-' || py.id) AS ref_number,
           py.paid_at AS occurred_at,
           -py.amount AS amount
         FROM payments py
         WHERE py.tenant_id = $1 AND py.status = 'completed'

         ORDER BY occurred_at
       ) x`,
      [tenantId]
    );

    // Recompute running balance client-side (simpler and correct with UNION)
    let balance = 0;
    const statement = rows.rows.map(row => {
      balance += Number(row.amount);
      return { ...row, running_balance: balance };
    });

    if (req.query.format === 'csv') {
      const csvRows = statement.map(row => ({
        ...row,
        occurred_at: row.occurred_at instanceof Date
          ? row.occurred_at.toISOString()
          : String(row.occurred_at),
      }));
      return sendCsv(res, `statement-${safeFilename(tenantInfo.name, String(tenantId))}.csv`, csvRows, [
        'type', 'ref_number', 'occurred_at', 'amount', 'running_balance',
      ]);
    }

    return res.json({ tenant: tenantInfo, statement });
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to generate tenant statement');
    return res.status(500).json({ message: 'Failed to generate tenant statement' });
  }
});

export default router;