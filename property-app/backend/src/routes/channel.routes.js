import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnerOrAdmin } from '../middleware/role.js';
import { channelLimiter } from '../middleware/rateLimit.js';
import { registerChannel, listChannels, getServiceWalletBalance, lowBalanceThreshold, payheroBaseUrl, normalizePhone } from '../services/payhero.js';
import { logger, alertError } from '../utils/logger.js';

const router = express.Router();

const channelSchema = z.object({
  channel_type: z.enum(['paybill', 'till', 'bank', 'send_money'], { message: 'channel_type must be paybill, till, bank or send_money' }),
  short_code: z.string().min(4, 'short_code must be at least 4 characters'),
  account_number: z.string().optional(),
  description: z.string().max(120).optional(),
});

const channelUpdateSchema = z.object({
  description: z.string().max(120).optional(),
  is_active: z.boolean().optional(),
});

// Channel management is landlord (owner) scoped — a channel belongs to exactly one owner and is
// only ever read/written through these owner-scoped queries.
router.use(requireAuth, requireOwnerOrAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM payment_channels WHERE owner_id = $1 ORDER BY created_at ASC`,
      [req.user.sub]
    );
    return res.json(result.rows);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch payment channels');
    return res.status(500).json({ message: 'Failed to fetch payment channels' });
  }
});

// Create a channel locally + register it with PayHero in one step. Idempotent — re-adding the same
// short code + type returns the existing row instead of duplicating.
router.post('/', channelLimiter, async (req, res) => {
  try {
    const payload = channelSchema.parse(req.body);
    const ownerId = req.user.sub;

    // Send Money is a local-only channel: the landlord's own mobile-money number that tenants send
    // rent to. PayHero's registration endpoint only accepts paybill/till/bank, so nothing is sent
    // upstream. Store the number normalized to its last 9 digits so callback matching can compare it
    // against a normalized recipient phone (see payheroWebhook.routes.js resolveChannel).
    if (payload.channel_type === 'send_money') {
      const digits = normalizePhone(payload.short_code);
      if (!digits || digits.length !== 9) {
        return res.status(400).json({ message: 'Send Money needs a valid receiving number, e.g. 0712345678 or +254712345678' });
      }

      const existingSendMoney = await query(
        `SELECT * FROM payment_channels WHERE owner_id = $1 AND short_code = $2 AND channel_type = 'send_money'`,
        [ownerId, digits]
      );
      if (existingSendMoney.rows.length > 0) {
        return res.json(existingSendMoney.rows[0]);
      }

      const inserted = await query(
        `INSERT INTO payment_channels (
           owner_id, channel_type, short_code, account_number, payhero_channel_id, description,
           is_active, verification_status, payhero_meta, created_at
         ) VALUES ($1, 'send_money', $2, $3, NULL, $4, TRUE, 'active', $5, NOW())
         RETURNING *`,
        [
          ownerId,
          digits,
          payload.account_number?.trim() || null,
          payload.description ?? null,
          { local_only: true, source: 'send_money', receiving_number: digits },
        ]
      );

      return res.status(201).json(inserted.rows[0]);
    }

    const existing = await query(
      `SELECT * FROM payment_channels WHERE owner_id = $1 AND short_code = $2 AND channel_type = $3`,
      [ownerId, String(payload.short_code).trim(), payload.channel_type]
    );
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    // Register with PayHero first — never create a channel PayHero does not know about.
    const ph = await registerChannel({
      channelType: payload.channel_type,
      shortCode: payload.short_code,
      accountNumber: payload.account_number,
      description: payload.description,
    });

    const verificationStatus = ph.is_active === true ? 'active' : ph.is_active === false ? 'inactive' : 'pending';

    const result = await query(
      `INSERT INTO payment_channels (
        owner_id, channel_type, short_code, account_number, payhero_channel_id, description,
        is_active, verification_status, payhero_meta, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        ownerId,
        payload.channel_type,
        String(payload.short_code).trim(),
        payload.account_number ?? null,
        ph.id != null ? String(ph.id) : null,
        payload.description ?? null,
        ph.is_active !== false,
        verificationStatus,
        ph,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Payment channel creation failed');
    if (/not configured|responded/.test(error.message)) {
      return res.status(400).json({ message: 'Payment channel could not be registered — check your PayHero configuration.' });
    }
    return res.status(500).json({ message: 'Failed to register payment channel' });
  }
});

// Deactivate (is_active=false) or rename a channel. Never hard-deletes a channel with payment history.
router.patch('/:channelId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const payload = channelUpdateSchema.parse(req.body);

    const owned = await query(
      `SELECT id, payhero_channel_id FROM payment_channels WHERE id = $1 AND owner_id = $2`,
      [channelId, req.user.sub]
    );
    if (owned.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this payment channel' });
    }

    const entries = Object.entries(payload).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of entries) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
    values.push(channelId, req.user.sub);
    const result = await query(
      `UPDATE payment_channels SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} AND owner_id = $${idx + 1}
       RETURNING *`,
      values
    );
    return res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error({ err: error.message }, 'Failed to update payment channel');
    return res.status(500).json({ message: 'Failed to update payment channel' });
  }
});

// Re-sync channel verification/activation status with PayHero (ownership confirmation step).
router.post('/:channelId/sync', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);

    const owned = await query(
      `SELECT * FROM payment_channels WHERE id = $1 AND owner_id = $2`,
      [channelId, req.user.sub]
    );
    if (owned.rows.length === 0) {
      return res.status(403).json({ message: 'You do not own this payment channel' });
    }
    const channel = owned.rows[0];

    // Send Money channels are local-only and never registered with PayHero, so there is nothing to
    // sync — without this guard the short-code lookup below would report a confusing "not registered".
    if (channel.channel_type === 'send_money') {
      return res.status(400).json({ message: 'Send Money numbers are managed locally and have no PayHero status to sync' });
    }

    const phChannels = await listChannels();
    const list = Array.isArray(phChannels) ? phChannels : phChannels?.payment_channels ?? phChannels?.data ?? [];
    const target =
      (channel.payhero_channel_id && list.find((c) => String(c.id) === String(channel.payhero_channel_id))) ||
      list.find((c) => String(c.short_code) === String(channel.short_code).trim()) ||
      null;

    if (!target) {
      return res.status(404).json({ message: `No matching channel ${channel.payhero_channel_id || channel.short_code} found on PayHero — is it registered?` });
    }

    const verificationStatus = target.is_active === true ? 'active' : target.is_active === false ? 'inactive' : 'pending';
    const result = await query(
      `UPDATE payment_channels
       SET payhero_channel_id = $1,
           is_active = $2,
           verification_status = $3,
           payhero_meta = $4,
           updated_at = NOW()
       WHERE id = $5 AND owner_id = $6
       RETURNING *`,
      [String(target.id), target.is_active !== false, verificationStatus, target, channelId, req.user.sub]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    logger.error({ err: error.message }, 'Payment channel sync failed');
    return res.status(500).json({ message: 'Failed to sync payment channel with PayHero' });
  }
});

// NOTE — shared-account disclosure awareness. PayHero service wallets are account-wide: every
// PaymentChannel on this deployment draws from the SAME prepaid wallet. The balance below is
// therefore a shared business figure, visible to any authenticated owner. That is by design for a
// single-operator deployment, but if you ever onboard independent landlords onto one PayHero account,
// this endpoint must be gated to a primary account holder instead. The 60s cache also stops a polling
// dashboard from hammering PayHero (and re-raising the low-balance alert on every read).
const WALLET_CACHE_TTL_MS = 60 * 1000;
// Cache is skipped under test so suites that swap the PayHero mock see live values each request.
const WALLET_CACHE_ENABLED = process.env.NODE_ENV !== 'test';
let walletCache = { at: 0, body: null };

router.get('/wallet', async (req, res) => {
  try {
    const now = Date.now();
    if (WALLET_CACHE_ENABLED && walletCache.body && now - walletCache.at < WALLET_CACHE_TTL_MS) {
      return res.json(walletCache.body);
    }

    const balance = await getServiceWalletBalance();
    const available = Number(balance?.available_balance ?? balance?.balance ?? 0);
    const threshold = lowBalanceThreshold();
    const low = available < threshold;
    if (low) {
      alertError(`payhero_low_wallet_balance`, new Error(`PayHero service wallet balance KES ${available} is below the KES ${threshold} warning threshold`));
    }
    const body = {
      currency: balance?.currency ?? 'KES',
      available_balance: available,
      low,
      threshold,
      payhero_base_url: payheroBaseUrl(),
    };
    walletCache = { at: now, body };
    return res.json(body);
  } catch (error) {
    if (/not configured|responded/.test(error.message)) {
      logger.error({ err: error.message }, 'PayHero wallet fetch rejected');
      return res.status(400).json({ message: 'Could not fetch PayHero wallet balance — check your configuration.' });
    }
    logger.error({ err: error.message }, 'Failed to fetch PayHero wallet balance');
    return res.status(500).json({ message: 'Failed to fetch PayHero wallet balance' });
  }
});

export default router;