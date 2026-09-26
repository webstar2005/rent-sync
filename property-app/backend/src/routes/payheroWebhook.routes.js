import express from 'express';
import { query, withTransaction } from '../config/db.js';
import { payheroWebhookLimiter } from '../middleware/rateLimit.js';
import {
  verifyWebhookRequest,
  clientIp,
  extractResponse,
  extractChannelId,
  extractShortCode,
  extractTransactionRef,
  extractPhone,
  extractReference,
  normalizePhone,
  normalizeName,
} from '../services/payhero.js';
import { logger, alertError } from '../utils/logger.js';

const router = express.Router();

// PayHero multi-channel payment webhook (POST /webhooks/payhero).
//
// Processing order (per the PLAN):
//   1. verify the sender (shared secret / optional IP allowlist) — PayHero's documented callback
//      carries NO signature, so the secret is what we append to the callback URL we give PayHero
//   2. log the raw payload FIRST, unconditionally — nothing is ever lost
//   3. resolve the landlord by the callback's channel identifier (payhero channel id / short code)
//      -> current PayHero callbacks do not include one, so fall back to a globally-unique reference
//         (invoice_number) or a single-owner phone match, then attribute the owner accordingly
//   4. within that owner, match the tenant (reference first, then phone)
//   5. idempotency on transaction_ref (unique constraint, checked again inside the transaction)
//   6. create Payment + mark the oldest PENDING/OVERDUE invoice PAID/PARTIAL in one $transaction
//   7. unmatched tenant -> payment still recorded (matched=false) against the channel's owner

function paymentMethodFor(channelType) {
  return channelType === 'bank' ? 'bank_transfer' : 'mobile_money';
}

async function updateLog(logId, fields) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const assignments = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of entries) {
    assignments.push(`${key} = $${idx++}`);
    values.push(value);
  }
  values.push(logId);
  await query(`UPDATE payhero_callback_log SET ${assignments.join(', ')} WHERE id = $${idx}`, values);
}

// Resolve the landlord's active channel from the callback's channel identifier (if present).
// Returns { channel, matchedBy } or { ambiguous: true } when more than one channel shares the number.
async function resolveChannel(payload) {
  const channelId = extractChannelId(payload);
  const shortCode = extractShortCode(payload);

  if (channelId) {
    const rows = await query(`SELECT * FROM payment_channels WHERE payhero_channel_id = $1 AND is_active = TRUE`, [channelId]);
    if (rows.rows.length === 1) return { channel: rows.rows[0], matchedBy: 'payhero_channel_id' };
    if (rows.rows.length > 1) return { ambiguous: true, matchedBy: 'payhero_channel_id' };
  }

  if (shortCode) {
    const rows = await query(`SELECT * FROM payment_channels WHERE short_code = $1 AND is_active = TRUE`, [shortCode]);
    if (rows.rows.length === 1) return { channel: rows.rows[0], matchedBy: 'short_code' };
    if (rows.rows.length > 1) return { ambiguous: true, matchedBy: 'short_code' };
  }

  return { channel: null, matchedBy: null };
}

// No channel identifier in the callback (current PayHero behavior): attribute the landlord using
// only strongly-identifying keys — invoice_number (UNIQUE in DB) first, then a strictly-single-owner phone.
// Ambiguous matches are NEVER guessed; they go to manual review.
async function resolveOwnerWithoutChannel({ reference, phone }) {
  if (reference) {
    const rows = await query(
      `SELECT p.owner_id, t.id AS tenant_id, i.invoice_number
       FROM invoices i
       JOIN tenants t ON t.id = i.tenant_id
       JOIN properties p ON p.id = t.property_id
       WHERE i.invoice_number = $1
       LIMIT 2`,
      [String(reference).trim()]
    );
    if (rows.rows.length === 1) {
      return { ownerId: rows.rows[0].owner_id, tenantId: rows.rows[0].tenant_id, matchedBy: 'invoice_number' };
    }
    if (rows.rows.length > 1) return { ambiguous: true, matchedBy: 'invoice_number' };
  }

  if (phone) {
    const norm = normalizePhone(phone);
    if (norm) {
      const rows = await query(
        `SELECT DISTINCT p.owner_id
         FROM tenants t
         JOIN properties p ON p.id = t.property_id
         WHERE regexp_replace(t.phone, '[^0-9]', '', 'g') LIKE '%' || $1
         LIMIT 2`,
        [norm]
      );
      if (rows.rows.length === 1) return { ownerId: rows.rows[0].owner_id, tenantId: null, matchedBy: 'phone_owner' };
      if (rows.rows.length > 1) return { ambiguous: true, matchedBy: 'phone_owner' };
    }
  }

  return { ownerId: null, tenantId: null, matchedBy: null };
}

// Within `ownerId`, match the tenant by reference (invoice number / unit number / name) first,
// then phone. Returns { tenant } or { ambiguous: true } (multiple tenants share the phone).
async function findTenantInScope(ownerId, { reference, phone }) {
  if (reference) {
    const ref = String(reference).trim();
    const byInvoice = await query(
      `SELECT t.*
       FROM invoices i
       JOIN tenants t ON t.id = i.tenant_id
       JOIN properties p ON p.id = t.property_id
       WHERE p.owner_id = $1 AND i.invoice_number = $2
       LIMIT 1`,
      [ownerId, ref]
    );
    if (byInvoice.rows.length === 1) return { tenant: byInvoice.rows[0] };

    const norm = normalizeName(reference);
    const byUnit = await query(
      `SELECT t.*
       FROM tenants t
       JOIN properties p ON p.id = t.property_id
       WHERE p.owner_id = $1 AND LOWER(TRIM(t.unit_number)) = $2
       LIMIT 1`,
      [ownerId, norm]
    );
    if (byUnit.rows.length === 1) return { tenant: byUnit.rows[0] };

    const byName = await query(
      `SELECT t.*
       FROM tenants t
       JOIN properties p ON p.id = t.property_id
       WHERE p.owner_id = $1 AND LOWER(TRIM(t.name)) = $2
       LIMIT 1`,
      [ownerId, norm]
    );
    if (byName.rows.length === 1) return { tenant: byName.rows[0] };
  }

  if (phone) {
    const norm = normalizePhone(phone);
    if (norm) {
      const byPhone = await query(
        `SELECT t.*
         FROM tenants t
         JOIN properties p ON p.id = t.property_id
         WHERE p.owner_id = $1 AND regexp_replace(t.phone, '[^0-9]', '', 'g') LIKE '%' || $2
         LIMIT 2`,
        [ownerId, norm]
      );
      if (byPhone.rows.length === 1) return { tenant: byPhone.rows[0] };
      if (byPhone.rows.length > 1) return { ambiguous: true };
    }
  }

  return { tenant: null };
}

async function findOldestOpenInvoice(tenantId) {
  const rows = await query(
    `SELECT *
     FROM invoices
     WHERE tenant_id = $1 AND status IN ('pending', 'overdue', 'partial')
     ORDER BY due_date ASC
     LIMIT 1`,
    [tenantId]
  );
  return rows.rows[0] ?? null;
}

router.post('/', payheroWebhookLimiter, async (req, res) => {
  // ---- 1. Verify the callback is genuinely from PayHero ----
  // A rejection is recorded (status 'rejected_auth') rather than discarded: it is the only evidence
  // of what PayHero actually sends, and it is how we diagnose the auth mechanism from evidence
  // instead of guessing. Never stores the secret — only the reason and a redacted fingerprint.
  const auth = verifyWebhookRequest(req);
  if (!auth.ok) {
    logger.warn(
      { ip: clientIp(req), reason: auth.reason, via: auth.via, provided: auth.provided },
      'PayHero webhook REJECTED — verification failed'
    );
    await query(
      `INSERT INTO payhero_callback_log (raw_payload, status, processing_error)
       VALUES ($1, 'rejected_auth', $2)`,
      [
        req.body ?? {},
        `auth=${auth.reason}${auth.via ? ` via=${auth.via}` : ''}${auth.provided ? ` provided=${auth.provided}` : ''}`,
      ]
    ).catch((error) => logger.error({ err: error.message }, 'Failed to log rejected PayHero callback'));
    return res.status(403).json({ status: 'forbidden', message: 'Forbidden' });
  }

  // ---- 2. Log the raw payload first, unconditionally ----
  const rawPayload = req.body ?? {};
  let logId;
  try {
    const inserted = await query(
      `INSERT INTO payhero_callback_log (raw_payload, payhero_channel_id, short_code, transaction_ref, status)
       VALUES ($1, $2, $3, $4, 'received')
       RETURNING id`,
      [
        rawPayload,
        extractChannelId(rawPayload) ?? null,
        extractShortCode(rawPayload) ?? null,
        extractTransactionRef(rawPayload) ?? null,
      ]
    );
    logId = inserted.rows[0].id;
  } catch (error) {
    // If even the audit log fails we must not swallow the callback — return 500 so PayHero retries.
    logger.error({ err: error.message }, 'payhero_callback_log insert failed');
    return res.status(500).json({ status: 'error', message: 'Callback audit log failed' });
  }

  try {
    const response = extractResponse(rawPayload);
    const resultCode = response?.ResultCode;

    if (resultCode !== undefined && Number(resultCode) !== 0) {
      await updateLog(logId, { status: 'ignored', processing_error: `ResultCode ${resultCode}: ${response?.ResultDesc || ''}` });
      return res.status(200).json({ status: 'ok', result: 'ignored' });
    }

    const amount = Number(response?.Amount ?? 0);
    const transactionRef = extractTransactionRef(rawPayload) || `PAYHERO-${Date.now()}-${logId}`;
    const phone = extractPhone(rawPayload);
    const reference = extractReference(rawPayload);
    const channelId = extractChannelId(rawPayload);
    const shortCode = extractShortCode(rawPayload);

    if (!Number.isFinite(amount) || amount <= 0) {
      await updateLog(logId, { status: 'ignored', processing_error: `Amount ${amount} is not a positive number` });
      return res.status(200).json({ status: 'ok', result: 'ignored' });
    }

    // ---- 3. Resolve the landlord FIRST via the channel identifier ----
    let channelResolution = { channel: null, matchedBy: null };
    if (channelId || shortCode) {
      channelResolution = await resolveChannel(rawPayload);
    }

    let ownerId = null;
    let tenantId = null;

    if (channelResolution.channel) {
      ownerId = channelResolution.channel.owner_id;
    } else if (channelResolution.ambiguous) {
      await updateLog(logId, {
        status: 'unmatched_channel',
        processing_error: 'Callback channel identifier matched more than one active PaymentChannel — not guessing',
        alerted: true,
      });
      alertError('payhero_unmatched_channel', new Error(`Ambiguous PayHero channel match (channelId=${channelId}, shortCode=${shortCode}) for txRef=${transactionRef}`));
      return res.status(200).json({ status: 'ok', result: 'unmatched_channel' });
    } else {
      // Current PayHero callbacks carry no channel identifier — fall back to strong identifiers.
      const fallback = await resolveOwnerWithoutChannel({ reference, phone });
      if (fallback.ambiguous) {
        await updateLog(logId, {
          status: 'unmatched_channel',
          payhero_channel_id: channelId ?? null,
          short_code: shortCode ?? null,
          transaction_ref: transactionRef,
          processing_error: 'Fallback owner resolution was ambiguous (multiple owners matched) — manual review required',
          alerted: true,
        });
        alertError('payhero_unmatched_channel', new Error(`Ambiguous PayHero owner attribution (ref=${reference}, phone=${phone}) for txRef=${transactionRef}`));
        return res.status(200).json({ status: 'ok', result: 'unmatched_channel' });
      }
      if (!fallback.ownerId) {
        await updateLog(logId, {
          status: 'unmatched_channel',
          payhero_channel_id: channelId ?? null,
          short_code: shortCode ?? null,
          transaction_ref: transactionRef,
          processing_error: 'No registered active PaymentChannel matched the callback and no unique reference/phone resolved an owner',
          alerted: true,
        });
        alertError('payhero_unmatched_channel', new Error(`Unmatched PayHero callback (no channel, no owner) txRef=${transactionRef}`));
        return res.status(200).json({ status: 'ok', result: 'unmatched_channel' });
      }
      ownerId = fallback.ownerId;
      tenantId = fallback.tenantId ?? null;
      if (tenantId) {
        await updateLog(logId, { matched_channel_id: null, matched_owner_id: ownerId });
      }
    }

    // ---- 4. Match the tenant within that owner ----
    let tenant = null;
    let matched = false;
    if (tenantId) {
      const rows = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
      tenant = rows.rows[0] ?? null;
      matched = Boolean(tenant);
    }
    if (!tenant) {
      const scopeMatch = await findTenantInScope(ownerId, { reference, phone });
      if (scopeMatch.ambiguous) {
        tenant = null;
        matched = false;
      } else {
        tenant = scopeMatch.tenant;
        matched = Boolean(tenant);
      }
    }

    const invoice = matched && tenant ? await findOldestOpenInvoice(tenant.id) : null;

    // ---- 5. Idempotency — a retried callback must never create a duplicate payment ----
    const preExisting = await query('SELECT id FROM payments WHERE transaction_ref = $1', [transactionRef]);
    if (preExisting.rows.length > 0) {
      await query(
        `INSERT INTO payment_reconciliation_events (invoice_id, tenant_id, owner_id, payment_method, transaction_ref, payment_channel_id, raw_payload, match_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'duplicate')`,
        [invoice?.id ?? null, tenant?.id ?? null, ownerId, 'mobile_money', transactionRef, channelResolution.channel?.id ?? null, rawPayload]
      );
      await updateLog(logId, {
        status: 'duplicate',
        matched_channel_id: channelResolution.channel?.id ?? null,
        matched_owner_id: ownerId,
        transaction_ref: transactionRef,
      });
      return res.status(200).json({ status: 'ok', result: 'duplicate' });
    }

    // ---- 6. Create the Payment + update the invoice atomically ----
    const result = await withTransaction(async (client) => {
      // Backstop: re-check inside the transaction so a concurrent duplicate still cannot slip through.
      const existing = await client.query('SELECT id FROM payments WHERE transaction_ref = $1', [transactionRef]);
      if (existing.rows.length > 0) {
        return { duplicate: true, paymentId: existing.rows[0].id, invoiceStatus: null };
      }

      const inserted = await client.query(
        `INSERT INTO payments (
           invoice_id, tenant_id, owner_id, amount, payment_method, reference,
           transaction_ref, phone_number, status, paid_at, matched, payment_channel_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', NOW(), $9, $10)
         RETURNING *`,
        [
          invoice?.id ?? null,
          tenant?.id ?? null,
          ownerId,
          amount,
          paymentMethodFor(channelResolution.channel?.channel_type ?? 'paybill'),
          reference || transactionRef,
          transactionRef,
          phone ?? null,
          matched,
          channelResolution.channel?.id ?? null,
        ]
      );

      let invoiceStatus = null;
      if (invoice) {
        const totals = await client.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS total_paid
           FROM payments WHERE invoice_id = $1 AND status = 'completed'`,
          [invoice.id]
        );
        const totalPaid = Number(totals.rows[0].total_paid ?? 0);
        const nextStatus = totalPaid >= Number(invoice.amount) ? 'paid' : 'partial';
        await client.query('UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, invoice.id]);
        invoiceStatus = nextStatus;
      }

      return { duplicate: false, paymentId: inserted.rows[0].id, invoiceStatus };
    });

    if (result.duplicate) {
      await updateLog(logId, { status: 'duplicate', transaction_ref: transactionRef, matched_owner_id: ownerId, matched_channel_id: channelResolution.channel?.id ?? null });
      return res.status(200).json({ status: 'ok', result: 'duplicate' });
    }

    const matchStatus = matched && invoice ? 'matched' : 'manual_review';
    await query(
      `INSERT INTO payment_reconciliation_events (invoice_id, tenant_id, owner_id, payment_method, transaction_ref, payment_channel_id, raw_payload, match_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [invoice?.id ?? null, tenant?.id ?? null, ownerId, paymentMethodFor(channelResolution.channel?.channel_type ?? 'paybill'), transactionRef, channelResolution.channel?.id ?? null, rawPayload, matchStatus]
    );

    await updateLog(logId, {
      status: 'processed',
      matched_channel_id: channelResolution.channel?.id ?? null,
      matched_owner_id: ownerId,
      matched_payment_id: result.paymentId,
      matched_invoice_id: invoice?.id ?? null,
      transaction_ref: transactionRef,
      processing_error: matched && invoice ? null : 'Tenant/invoice not matched — payment recorded for manual reconciliation',
    });

    return res.status(200).json({
      status: 'ok',
      result: matched && invoice ? 'matched' : 'unmatched_tenant',
      paymentId: result.paymentId,
      invoiceId: invoice?.id ?? null,
      invoiceStatus: result.invoiceStatus,
      ownerId,
      channelId: channelResolution.channel?.id ?? null,
    });
  } catch (error) {
    logger.error({ err: error.message, logId }, 'PayHero callback processing failed');
    await updateLog(logId, { status: 'failed', processing_error: error.message }).catch((e) => logger.error({ err: e.message }, 'Failed to mark callback log as failed'));
    return res.status(500).json({ status: 'error', message: 'Callback processing failed' });
  }
});

export default router;