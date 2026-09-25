import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

// PayHero API client (docs.payhero.co.ke — verified against their current docs).
// Base: https://backend.payhero.co.ke/api/v2 — Basic-auth token from the PayHero portal.
// Registration: POST /payment_channels ({ channel_type, account_id, short_code, account_number?, description? })
//   → { id (this is the PayHero channel id), channel_type, short_code, ..., is_active, ... }
// Wallet: GET /wallets?wallet_type=service_wallet → { currency, available_balance, ... }

export const PAYHERO_DEFAULT_BASE_URL = 'https://backend.payhero.co.ke/api/v2';

export function payheroBaseUrl() {
  return (process.env.PAYHERO_BASE_URL || PAYHERO_DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function requirePayHeroEnv() {
  const token = process.env.PAYHERO_AUTH_TOKEN;
  if (!token || String(token).trim() === '') {
    const msg = 'PayHero not configured — set PAYHERO_AUTH_TOKEN (plus PAYHERO_ACCOUNT_ID for channel registration). See .env.example.';
    logger.warn(msg);
    throw new Error(msg);
  }
  return String(token).trim();
}

function authHeader() {
  const token = requirePayHeroEnv();
  return token.startsWith('Basic ') ? token : `Basic ${token}`;
}

export function payheroAccountId() {
  const accountId = process.env.PAYHERO_ACCOUNT_ID;
  if (!accountId || Number.isNaN(Number(accountId))) {
    throw new Error('PAYHERO_ACCOUNT_ID must be set to register a channel (your Pay Hero account id from the portal)');
  }
  return Number(accountId);
}

// Injectable HTTP layer — tests swap this for a stub without globals.
let httpFetch = globalThis.fetch;
export function __setPayHeroHttp(fn) {
  httpFetch = fn;
}

async function phFetch(path, options = {}) {
  // Build the URL by concatenation, NOT new URL('/path', base): a leading-slash path is treated as
  // absolute and would strip the /api/v2 prefix (e.g. -> backend.payhero.co.ke/wallets).
  const base = payheroBaseUrl().replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  let res;
  try {
    res = await httpFetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body,
    });
  } catch (error) {
    throw new Error(`PayHero request failed (${error.message})`);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { _raw: text };
    }
  }

  if (!res.ok) {
    throw new Error(`PayHero responded ${res.status}: ${data?.error_message || data?.message || text}`);
  }
  return data;
}

// ---- Landlord-facing endpoints ----

export function registerChannel({ channelType, shortCode, accountNumber, description }) {
  const body = {
    channel_type: channelType,
    account_id: payheroAccountId(),
    short_code: String(shortCode).trim(),
  };
  if (accountNumber) body.account_number = String(accountNumber).trim();
  if (description) body.description = String(description).trim();
  return phFetch('/payment_channels', { method: 'POST', body: JSON.stringify(body) }).then(unwrapChannel);
}

export function listChannels() {
  return phFetch('/payment_channels').then(unwrapChannelList);
}

// PayHero's own registered bank paybills — useful reference when registering 'bank' channels.
export function listBankPaybills() {
  return phFetch('/bank_paybills');
}

// The real API returns the created channel object for POST but may wrap GET responses as
// { payment_channels: [...] } / { data: [...] }. Normalize so callers always get the object/array.
function unwrapChannel(data) {
  if (Array.isArray(data)) return data[0];
  return data?.payment_channel ?? data?.channel ?? data;
}

function unwrapChannelList(data) {
  if (Array.isArray(data)) return data;
  return data?.payment_channels ?? data?.data ?? [];
}

export function getServiceWalletBalance() {
  return phFetch('/wallets?wallet_type=service_wallet');
}

// Initiate an M-Pesa STK push to a customer's phone through a registered channel.
// Shape confirmed from PayHero's official PHP client: POST /payments (base /api/v2).
// callbackUrl is optional per-request; it overrides the account-level callback for this transaction.
export function initiateStkPush({ amount, phoneNumber, channelId, externalReference, callbackUrl }) {
  const body = {
    amount: Number(amount),
    phone_number: String(phoneNumber).trim(),
    channel_id: Number(channelId),
    external_reference: String(externalReference).trim(),
    provider: 'm-pesa',
  };
  if (callbackUrl) body.callback_url = String(callbackUrl).trim();
  return phFetch('/payments', { method: 'POST', body: JSON.stringify(body) });
}

export function getTransactionStatus(reference) {
  return phFetch(`/transaction-status?reference=${encodeURIComponent(reference)}`);
}

export function getAccountTransactions({ page = 1, perPage = 20 } = {}) {
  return phFetch(`/transactions?page=${page}&per_page=${perPage}`);
}

export function lowBalanceThreshold() {
  const n = Number(process.env.PAYHERO_LOW_BALANCE_ALERT || 500);
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

// ---- Webhook verification ----
// PayHero's documented payment callback carries no signature, so there is no channel signature to
// verify against (confirmed in their current docs). We secure the endpoint ourselves:
//   1. shared secret — expected ONLY in the `x-payhero-secret` header (never a query string, which
//      would leak into URL logs). Compare in constant time. Fails CLOSED in every environment when
//      PAYHERO_WEBHOOK_SECRET is unset or the header is missing/incorrect.
//   2. optional IP allowlist via PAYHERO_IP_ALLOWLIST (loose check loosened: exact/CIDR match only).
export function clientIp(req) {
  // No `trust proxy` is configured, so req.ip is the real socket address — never trust x-forwarded-for
  // (a plain client can spoof it, and we must not let that bypass a static allowlist).
  return String(req.ip || '');
}

export function isAuthorizedWebhook(req) {
  const secret = process.env.PAYHERO_WEBHOOK_SECRET;
  const provided = req.headers['x-payhero-secret'];

  if (!secret || typeof provided !== 'string' || provided.length === 0) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const ipAllow = process.env.PAYHERO_IP_ALLOWLIST;
  return ipAllow ? isIpAllowed(req) : true;
}

function isIpAllowed(req) {
  const allow = process.env.PAYHERO_IP_ALLOWLIST;
  if (!allow) return true;
  const ip = clientIp(req);
  if (!ip) return false;
  const allowed = allow.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.some((a) => (a.includes('/') ? ipInCidr(ip, a) : ip === a));
}

function ipInCidr(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const toInt = (parts) =>
    parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
      ? ((((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0))
      : null;
  const ipInt = toInt(ip.split('.'));
  const baseInt = toInt(base.split('.'));
  if (ipInt === null || baseInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// ---- Callback payload helpers ----

// PayHero callback shape (current docs): { forward_url, status, response: { Amount, CheckoutRequestID,
// ExternalReference, MerchantRequestID, MpesaReceiptNumber, Phone, ResultCode, ResultDesc, Status } }
export function extractResponse(payload) {
  if (payload && typeof payload === 'object' && payload.response && typeof payload.response === 'object') {
    return payload.response;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

// Field lookup across top-level + response, case-insensitive, first match wins.
const CHANNEL_ID_KEYS = ['payhero_channel_id', 'payheroChannelId', 'channel_id', 'channelId', 'channelID'];

function findFirst(obj, keys) {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const seen = new Set();
  for (const target of [obj?.response, obj]) {
    if (!target || typeof target !== 'object' || seen.has(target)) continue;
    seen.add(target);
    for (const key of Object.keys(target)) {
      if (wanted.has(key.toLowerCase())) {
        const value = target[key];
        if (value !== null && value !== undefined && value !== '') return String(value);
      }
    }
  }
  return null;
}

// The callback MAY carry a channel identifier (payhero channel id or the M-Pesa short code).
// Current PayHero docs do not send one, so callers fall back to reference/phone resolution.
export function extractChannelId(payload) {
  return findFirst(payload, CHANNEL_ID_KEYS);
}

export function extractShortCode(payload) {
  const keys = ['short_code', 'shortCode', 'shortcode', 'business_short_code', 'businessShortCode', 'BusinessShortCode', 'businesscode'];
  const raw = findFirst(payload, keys);
  return raw ? String(raw).replace(/\D+/g, '') : null;
}

export function extractTransactionRef(payload) {
  const response = extractResponse(payload);
  const refs = [
    response?.MpesaReceiptNumber,
    payload?.MpesaReceiptNumber,
    response?.transaction_reference,
    response?.transactionRef,
    response?.reference,
    response?.CheckoutRequestID,
    payload?.CheckoutRequestID,
  ].find((v) => v !== null && v !== undefined && String(v) !== '');
  return refs ? String(refs) : null;
}

export function extractPhone(payload) {
  const response = extractResponse(payload);
  const phone = response?.Phone ?? payload?.Phone ?? null;
  return phone ? String(phone) : null;
}

// Send Money has no paybill/till short code — the landlord is identified by the number the money was
// sent TO. PayHero's Send Money callback shape is not documented, so this deliberately looks only at
// receiver-shaped keys (never the sender `Phone`, which belongs to the tenant) and takes the first
// value that normalizes to a full 9-digit number. Returns null rather than guessing.
const RECIPIENT_PHONE_KEYS = [
  'receiverphone',
  'receivermsisdn',
  'receiver_phone',
  'recipientphone',
  'recipientmsisdn',
  'recipient_phone',
  'receiver',
  'recipient',
  'receiver_number',
  'to_number',
];

export function extractRecipientPhone(payload) {
  for (const target of [payload?.response, payload]) {
    if (!target || typeof target !== 'object') continue;
    for (const key of Object.keys(target)) {
      if (!RECIPIENT_PHONE_KEYS.includes(key.toLowerCase())) continue;
      const value = target[key];
      if (value === null || value === undefined || value === '') continue;
      const norm = normalizePhone(value);
      if (norm && norm.length === 9) return norm;
    }
  }
  return null;
}

export function extractReference(payload) {
  const response = extractResponse(payload);
  return response?.ExternalReference ?? response?.external_reference ?? response?.BillRefNumber ?? response?.AccountReference ?? null;
}

export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, '');
  if (digits.length < 9) return digits;
  return digits.slice(-9); // 07XXXXXXXX, 2547XXXXXXXX and +2547XXXXXXXX all collapse to the same 9 digits
}

export function normalizeName(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}