import { generateMonthlyInvoices, markOverdueInvoices } from './invoiceService.js';
import { logger, alertError } from '../utils/logger.js';

// Monthly rent invoicing, run from inside the API process.
//
// Why not an external cron hitting POST /api/cron/invoices:
//   - That endpoint needs CRON_SECRET, which lives only in the host's secret store. Copying it into
//     a second system (GitHub Actions) is a secret to keep in sync, and a stale copy fails silently
//     as a 401 that nobody reads.
//   - GitHub disables scheduled workflows after ~60 days of repo inactivity, which would stop rent
//     invoicing with no error anywhere.
//   - Render's own cron jobs need a paid plan.
// Running it here removes all three. The downside of an in-process timer is that it only runs while
// the API is up -- but the API being down means the landlord cannot collect either, and the next
// start catches up.
//
// Both jobs are idempotent (see invoiceService): generateMonthlyInvoices skips tenants that already
// have an invoice in the target period and the insert is ON CONFLICT DO NOTHING on a unique
// invoice_number, and markOverdueInvoices only moves pending -> overdue. So running more often than
// once a month is free, and a missed month self-heals on the next tick rather than skipping rent.

const DEFAULT_INTERVAL_HOURS = 6;
// Let the server finish binding before the first financial write, so a cold start is not competing
// with its own boot-time queries.
const STARTUP_DELAY_MS = 15_000;

let timer = null;

function isEnabled() {
  if (process.env.INVOICE_SCHEDULER_ENABLED === 'false') return false;
  // Tests drive these functions directly; a background timer would race their fixtures.
  return process.env.NODE_ENV !== 'test';
}

export async function runInvoiceCycle() {
  const [generated, overdue] = await Promise.all([
    generateMonthlyInvoices(),
    markOverdueInvoices(),
  ]);

  logger.info(
    { generated, skipped: generated.skipped, period: generated.period, overdue_marked: overdue.marked },
    'Invoice scheduler tick'
  );
  return { ...generated, overdue_marked: overdue.marked };
}

export function startInvoiceScheduler() {
  if (!isEnabled()) {
    logger.info('Invoice scheduler disabled');
    return null;
  }

  const rawHours = process.env.INVOICE_SCHEDULER_INTERVAL_HOURS;
  let hours = DEFAULT_INTERVAL_HOURS;
  if (rawHours !== undefined && rawHours !== '') {
    const parsed = Number(rawHours);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      // Fall back to the default rather than refusing to start. A typo in this value must not be
      // the reason a landlord's rent is never invoiced again; the jobs are idempotent, so running
      // at the wrong cadence is harmless and self-correcting.
      logger.warn(
        { raw: rawHours, using: DEFAULT_INTERVAL_HOURS },
        'INVOICE_SCHEDULER_INTERVAL_HOURS is not a positive number; using the default interval'
      );
    } else {
      hours = parsed;
    }
  }

  const tick = async () => {
    try {
      await runInvoiceCycle();
    } catch (err) {
      // Never let a failed tick kill the timer: the next one may well succeed, and stopping would
      // silently end rent invoicing until the next deploy.
      logger.error({ err: err.message }, 'Invoice scheduler tick failed');
      alertError('invoice_scheduler_failed', err);
    }
  };

  const first = setTimeout(() => {
    void tick();
  }, STARTUP_DELAY_MS);
  first.unref?.();

  timer = setInterval(() => {
    void tick();
  }, hours * 60 * 60 * 1000);
  timer.unref?.();

  logger.info({ interval_hours: hours, startup_delay_ms: STARTUP_DELAY_MS }, 'Invoice scheduler started');
  return timer;
}

export function stopInvoiceScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
