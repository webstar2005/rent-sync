import express from 'express';
import { query } from '../config/db.js';
import { sendSms, smsTemplates } from '../services/sms.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Simple protection: require CRON_SECRET header if set, otherwise require auth is not needed for this internal job
// For now, check for x-cron-secret header matching CRON_SECRET, or allow if not set (dev)
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return next(); // no secret set = open in dev
  const provided = req.headers['x-cron-secret'] || req.headers['x_cron_secret'] || req.query.secret;
  if (provided !== secret) return res.status(401).json({ message: 'Invalid cron secret' });
  next();
}

// POST /api/cron/reminders — find pending/overdue invoices and send reminders
// Can be triggered via pg_cron, GitHub Actions, or external scheduler
router.post('/reminders', requireCronSecret, async (req, res) => {
  try {
    // Find invoices pending/overdue where due_date is within 3 days upcoming or past due (overdue)
    const result = await query(
      `SELECT i.id, i.amount, i.due_date, i.status, t.name as tenant_name, t.phone, p.name as property_name
       FROM invoices i
       JOIN tenants t ON t.id = i.tenant_id
       JOIN properties p ON p.id = i.property_id
       WHERE i.status IN ('pending','partial','overdue')
         AND t.phone IS NOT NULL
         AND t.status = 'active'
         AND i.due_date <= CURRENT_DATE + INTERVAL '3 days'
       LIMIT 100`
    );

    let sent = 0;
    let skipped = 0;
    for (const inv of result.rows) {
      try {
        if (!inv.phone) { skipped++; continue; }
        const msg = smsTemplates().overdueReminder(inv.tenant_name, inv.amount, new Date(inv.due_date).toLocaleDateString());
        await sendSms({ to: inv.phone, message: msg });
        sent++;
        // Optional: log to reconciliation or separate table — for now just log
        logger.info({ tenant: inv.tenant_name, property: inv.property_name, due: inv.due_date }, 'Overdue reminder sent');
      } catch (e) {
        logger.warn({ err: e.message, tenant: inv.tenant_name }, 'Reminder SMS failed');
        skipped++;
      }
    }

    return res.json({ ok: true, checked: result.rows.length, sent, skipped });
  } catch (error) {
    logger.error({ err: error.message }, 'Reminder cron failed');
    return res.status(500).json({ message: 'Reminder job failed', error: error.message });
  }
});

export default router;
