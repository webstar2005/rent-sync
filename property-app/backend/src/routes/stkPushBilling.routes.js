import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, query } from '../config/db.js';
import { PLANS, isPlanKey } from '../config/plans.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const DEFAULT_CALLBACK_URL = 'https://api.rentsync.africa/api/billing/stk-push/callback';

function mpesaConfig() {
  return {
    baseUrl: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL || DEFAULT_CALLBACK_URL,
  };
}

function stkConfigured(cfg) {
  return Boolean(cfg.consumerKey && cfg.consumerSecret && cfg.shortcode && cfg.passkey);
}

const initiateSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter the email address you signed up to Rent Sync with'),
  phone: z.string().trim().min(9, 'Enter your Safaricom number').max(15, 'That phone number is too long'),
  plan: z
    .string()
    .refine(isPlanKey, { message: 'plan must be one of basic, standard, premium, enterprise' }),
});

function formatPhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    digits = `254${digits}`;
  }
  return digits;
}

function darajaTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

async function mpesaAccessToken(cfg) {
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const res = await fetch(`${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`M-Pesa auth failed (${res.status}) ${text}`.trim());
  }
  const data = await res.json();
  return data.access_token;
}

router.post('/stk-push/initiate', async (req, res) => {
  const cfg = mpesaConfig();
  if (!stkConfigured(cfg)) {
    return res
      .status(503)
      .json({ message: 'Cardless payment is not available yet. Pay by M-Pesa Send Money below.' });
  }

  let payload;
  try {
    payload = initiateSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0].message });
    }
    return res.status(500).json({ message: 'Failed to start payment' });
  }

  const plan = PLANS[payload.plan];
  if (plan.amount === null) {
    return res
      .status(400)
      .json({ message: 'Enterprise plans are priced individually. Contact us and we will set it up.' });
  }

  try {
    const userResult = await query(
      'SELECT id, subscription_status FROM users WHERE lower(email) = $1',
      [payload.email]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({
        message:
          'No Rent Sync account uses that email yet. Create your account in the dashboard first, then come back to pay.',
      });
    }
    if (user.subscription_status === 'active') {
      return res.status(409).json({ message: 'That account already has an active subscription.' });
    }

    const recent = await query(
      `SELECT id FROM stk_push_pending
       WHERE user_id = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '2 minutes'`,
      [user.id]
    );
    if (recent.rows.length > 0) {
      return res.status(429).json({
        message:
          'A payment prompt was just sent. Enter your M-Pesa PIN, or wait a moment before trying again.',
      });
    }

    const phone = formatPhone(payload.phone);
    const reference = `RS${Date.now().toString(36).toUpperCase()}${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const inserted = await query(
      `INSERT INTO stk_push_pending (reference, user_id, phone, amount, tier_id, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [reference, user.id, phone, plan.amount, plan.key]
    );
    const pendingId = inserted.rows[0].id;

    const timestamp = darajaTimestamp();
    const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${timestamp}`).toString('base64');
    const token = await mpesaAccessToken(cfg);

    const pushRes = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: plan.amount,
        PartyA: phone,
        PartyB: cfg.shortcode,
        PhoneNumber: phone,
        CallBackURL: cfg.callbackUrl,
        AccountReference: reference,
        TransactionDesc: `Rent Sync ${plan.name} subscription`,
      }),
    });

    const data = await pushRes.json().catch(() => ({}));

    if (!pushRes.ok || data.ResponseCode !== '0') {
      await query(
        `UPDATE stk_push_pending SET status = 'failed', result_desc = $1, updated_at = NOW() WHERE id = $2`,
        [data.errorMessage || data.ResponseDescription || 'M-Pesa rejected the request', pendingId]
      );
      return res.status(502).json({
        message:
          data.errorMessage ||
          data.ResponseDescription ||
          'M-Pesa could not send the prompt to your phone. Check the number and try again.',
      });
    }

    await query(
      `UPDATE stk_push_pending
       SET checkout_request_id = $1, merchant_request_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [data.CheckoutRequestID, data.MerchantRequestID, pendingId]
    );

    return res.json({
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage || 'Check your phone and enter your M-Pesa PIN.',
      amount: plan.amount,
      planName: plan.name,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'STK push initiate failed');
    return res.status(500).json({ message: 'Failed to start payment. Try again in a moment.' });
  }
});

router.post('/stk-push/callback', async (req, res) => {
  const accept = () => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return accept();

    const lookup = await query(
      `SELECT id, user_id, amount, tier_id, status FROM stk_push_pending WHERE checkout_request_id = $1`,
      [callback.CheckoutRequestID]
    );
    const pending = lookup.rows[0];
    if (!pending || pending.status !== 'pending') return accept();

    const items = callback.CallbackMetadata?.Item ?? [];
    const itemValue = (name) => items.find((item) => item.Name === name)?.Value;
    const receipt = itemValue('MpesaReceiptNumber') ?? null;
    const amount = itemValue('Amount') ?? null;

    if (String(callback.ResultCode) !== '0') {
      await query(
        `UPDATE stk_push_pending
         SET status = 'failed', result_code = $1, result_desc = $2, updated_at = NOW()
         WHERE id = $3`,
        [Number(callback.ResultCode), callback.ResultDesc ?? 'Cancelled', pending.id]
      );
      return accept();
    }

    if (amount !== null && Number(amount) !== pending.amount) {
      await query(
        `UPDATE stk_push_pending
         SET status = 'failed', result_code = -1, result_desc = 'amount_mismatch', updated_at = NOW()
         WHERE id = $1`,
        [pending.id]
      );
      logger.warn(
        { expected: pending.amount, received: amount, pendingId: pending.id },
        'STK push callback amount mismatch'
      );
      return accept();
    }

    const ceiling = PLANS[pending.tier_id]?.unitCeiling ?? null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE users
         SET subscription_status = 'active',
             plan = $1,
             units_limit = $2,
             activated_at = NOW(),
             payment_reference = $3,
             payment_confirmed_by = 'stk_push',
             payment_confirmed_at = NOW()
         WHERE id = $4`,
        [pending.tier_id, ceiling, receipt, pending.user_id]
      );
      await client.query(
        `UPDATE stk_push_pending
         SET status = 'completed', mpesa_receipt = $1, result_code = 0,
             result_desc = 'Paid', completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [receipt, pending.id]
      );
      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    logger.info({ userId: pending.user_id, plan: pending.tier_id, receipt }, 'STK push activated subscription');
  } catch (error) {
    logger.error({ err: error.message }, 'STK push callback failed');
  }

  return accept();
});

router.get('/stk-push/status/:checkoutRequestId', async (req, res) => {
  try {
    const result = await query(
      `SELECT status, mpesa_receipt, result_desc FROM stk_push_pending WHERE checkout_request_id = $1`,
      [req.params.checkoutRequestId]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ message: 'Unknown payment. Start again.' });
    }
    return res.json({ status: row.status, receipt: row.mpesa_receipt, message: row.result_desc });
  } catch (error) {
    logger.error({ err: error.message }, 'STK push status failed');
    return res.status(500).json({ message: 'Failed to check payment status' });
  }
});

export default router;
