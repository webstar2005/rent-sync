import { logger } from '../utils/logger.js';

const DARAJA_SANDBOX = 'https://sandbox.safaricom.co.ke';
const DARAJA_PROD = 'https://api.safaricom.co.ke';

function baseUrl() {
  return process.env.MPESA_ENV === 'production' ? DARAJA_PROD : DARAJA_SANDBOX;
}

function requireMpesaEnv() {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new Error('M-Pesa not configured — set MPESA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY (see .env.example Phase 6)');
  }
  return { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY };
}

export async function getDarajaToken() {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = requireMpesaEnv();
  const url = `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja oauth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

export function formatPhoneForDaraja(phone) {
  // Store is 2547..., Daraja expects 2547...
  const s = String(phone).trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (s.startsWith('07')) return `254${s.slice(1)}`;
  if (s.startsWith('7')) return `254${s}`;
  return s;
}

export async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  // In sandbox without creds, mock — still logs and returns fake CheckoutRequestID for testing duplicate flow
  if (!process.env.MPESA_CONSUMER_KEY) {
    logger.warn('M-Pesa STK Push mocked (no creds) — returning fake CheckoutRequestID for sandbox test');
    return {
      MerchantRequestID: `mock-${Date.now()}`,
      CheckoutRequestID: `ws_CO_${Date.now()}`,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing (mock)',
      CustomerMessage: 'Success. Request accepted for processing (mock)',
    };
  }

  const { MPESA_SHORTCODE, MPESA_PASSKEY } = requireMpesaEnv();
  const token = await getDarajaToken();
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  const callbackUrl = process.env.MPESA_CALLBACK_URL || `http://localhost:${process.env.PORT || 4000}/api/mpesa/callback`;

  const body = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(Number(amount)),
    PartyA: formatPhoneForDaraja(phone),
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: formatPhoneForDaraja(phone),
    CallBackURL: callbackUrl,
    AccountReference: String(accountReference).slice(0, 12) || 'RentSync',
    TransactionDesc: String(transactionDesc || 'Rent payment').slice(0, 13),
  };

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.ResponseCode !== '0') {
    logger.error({ body, data }, 'STK Push failed');
    throw new Error(data.errorMessage || data.ResponseDescription || `STK Push failed: ${res.status}`);
  }
  logger.info({ CheckoutRequestID: data.CheckoutRequestID, phone: body.PhoneNumber, amount: body.Amount }, 'STK Push initiated');
  return data;
}

// For webhook IP verification — Safaricom publishes ranges; we check X-Forwarded-For against allowlist if set
export function isSafaricomIp(req) {
  const allow = process.env.MPESA_IP_ALLOWLIST;
  if (!allow) return true; // no allowlist = allow all (log only)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
  const allowed = allow.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.some((a) => ip.includes(a) || ip === a);
}
