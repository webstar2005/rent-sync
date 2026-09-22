import { query } from '../config/db.js';
import { logger } from '../utils/logger.js';

const MAX_BATCH = 500;

// Cycle helpers — all pure, exported for tests.

// Parse "YYYY-MM" into { year, month }. Defaults to the NEXT calendar month (invoices are
// generated for next month's rent, e.g. generated in September with due date in October).
export function parseMonth(month = '') {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month).trim());
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) };
  }
  const now = new Date();
  const rawMonth = now.getMonth() + 2; // next month, 1-12
  if (rawMonth > 12) return { year: now.getFullYear() + 1, month: rawMonth - 12 };
  return { year: now.getFullYear(), month: rawMonth };
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Clamp the property's due day to the last day of the target month (e.g. Feb with due_day 31 → 28).
export function dueDateFor(rentDueDay, { year, month }) {
  const day = Math.min(Number(rentDueDay) || 5, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Inclusive-exclusive range over the whole target month (used both to compute due dates and to
// detect an existing invoice in the same period for idempotency).
export function periodRange({ year, month }) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  return { start, end: `${endYear}-${String(endMonth).padStart(2, '0')}-01` };
}

export function invoiceNumberFor(tenantId, { year, month }) {
  return `INV-${tenantId}-${year}${String(month).padStart(2, '0')}`;
}

// Create a pending invoice for every ACTIVE tenant on an ACTIVE property that does not already
// have an invoice billed in the target period. Idempotent — re-running generates nothing new.
// `ownerId` scopes to one landlord; omit for the whole platform (cron).
export async function generateMonthlyInvoices({ ownerId = null, month = '' } = {}) {
  const period = parseMonth(month);
  const { start, end } = periodRange(period);
  const periodLabel = `${period.year}-${String(period.month).padStart(2, '0')}`;

  const tenants = await query(
    `SELECT t.id AS tenant_id, t.monthly_rent, p.id AS property_id, p.rent_due_day
     FROM tenants t
     JOIN properties p ON p.id = t.property_id
     WHERE t.status = 'active'
       AND p.status = 'active'
       AND ($1::int IS NULL OR p.owner_id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM invoices i
         WHERE i.tenant_id = t.id
           AND i.due_date >= $2::date AND i.due_date < $3::date
       )
     ORDER BY p.owner_id, t.id
     LIMIT $4`,
    [ownerId, start, end, MAX_BATCH]
  );

  let generated = 0;
  for (const t of tenants.rows) {
    const invoiceNumber = invoiceNumberFor(t.tenant_id, period);
    const result = await query(
      `INSERT INTO invoices (tenant_id, property_id, invoice_number, amount, due_date, notes, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       ON CONFLICT (invoice_number) DO NOTHING`,
      [t.tenant_id, t.property_id, invoiceNumber, Number(t.monthly_rent), dueDateFor(t.rent_due_day, period), `Auto-generated rent for ${periodLabel}`]
    );
    generated += result.rowCount;
  }

  logger.info({ generated, candidates: tenants.rows.length, period: periodLabel, ownerId }, 'Monthly invoices generated');
  return { generated, skipped: tenants.rows.length - generated, period: periodLabel };
}

// Flip unpaid pending invoices to overdue once their due date has passed. A `partial` invoice keeps
// its status (it has payments — reconciliation will drive it to paid). Owner-scope optional.
export async function markOverdueInvoices({ ownerId = null } = {}) {
  const result = await query(
    `UPDATE invoices i
     SET status = 'overdue', updated_at = NOW()
     FROM tenants t
     JOIN properties p ON p.id = t.property_id
     WHERE i.tenant_id = t.id
       AND i.status = 'pending'
       AND i.due_date < CURRENT_DATE
       AND ($1::int IS NULL OR p.owner_id = $1)`,
    [ownerId]
  );
  return { marked: result.rowCount };
}