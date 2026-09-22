import express from 'express';
import crypto from 'node:crypto';
import { generateMonthlyInvoices, markOverdueInvoices } from '../services/invoiceService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// This endpoint runs platform-wide financial writes (invoices + overdue marking), so it is ALWAYS
// protected: fail closed if CRON_SECRET is not set, accept the secret only via a header, and compare
// in constant time. The query string is never used (secrets in URLs leak into logs).
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ message: 'CRON_SECRET is not configured — cron is disabled' });
  }
  const provided = req.headers['x-cron-secret'];
  if (typeof provided !== 'string' || provided.length === 0) {
    return res.status(401).json({ message: 'Missing cron secret header' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Invalid cron secret' });
  }
  next();
}

// POST /api/cron/invoices — generate next month's rent invoices for ALL active tenants (whole
// platform) and flip unpaid pending invoices past their due date to overdue. No SMS. Meant to run
// once a month (e.g. pg_cron / GitHub Actions / external scheduler).
router.post('/invoices', requireCronSecret, async (req, res) => {
  try {
    const month = req.body?.month;
    const [generated, overdue] = await Promise.all([
      generateMonthlyInvoices({ month }),
      markOverdueInvoices(),
    ]);
    return res.json({ ok: true, ...generated, overdue_marked: overdue.marked });
  } catch (error) {
    logger.error({ err: error.message }, 'Invoice cron failed');
    return res.status(500).json({ message: 'Invoice job failed' });
  }
});

export default router;
