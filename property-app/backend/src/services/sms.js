import { logger } from '../utils/logger.js';

function getProvider() {
  return (process.env.SMS_PROVIDER || 'mock').toLowerCase();
}

// Mock in dev without creds — logs instead of sending, so Phase 7 can be tested without budget
export async function sendSms({ to, message }) {
  const provider = getProvider();
  const toList = Array.isArray(to) ? to : [to];
  const normalizedTo = toList.map((p) => {
    const s = String(p).trim().replace(/\s+/g, '').replace(/^\+/, '');
    if (s.startsWith('07')) return `254${s.slice(1)}`;
    if (s.startsWith('7')) return `254${s}`;
    return s;
  });

  if (provider === 'mock' || (!process.env.AT_USERNAME && !process.env.TWILIO_ACCOUNT_SID)) {
    logger.info({ to: normalizedTo, message, provider: 'mock' }, 'SMS mocked (no provider creds) — set AT_USERNAME/AT_API_KEY or TWILIO_* to send real');
    return { mocked: true, to: normalizedTo, provider: 'mock' };
  }

  if (provider === 'africastalking' || provider === 'at') {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    const from = process.env.AT_SENDER_ID || undefined;
    // Africa's Talking expects form-encoded
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', normalizedTo.map((n) => `+${n}`).join(','));
    params.append('message', message);
    if (from) params.append('from', from);

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error({ data, to: normalizedTo }, 'Africa is Talking SMS failed');
      throw new Error(data.SMSMessageData?.Message || `AT SMS failed: ${res.status}`);
    }
    logger.info({ to: normalizedTo, data }, 'AT SMS sent');
    return data;
  }

  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!accountSid || !authToken || !from) throw new Error('TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM not set');
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    // Twilio sends one per request — loop
    const results = [];
    for (const num of normalizedTo) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: `+${num}`, From: from, Body: message }).toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.error({ data, to: num }, 'Twilio SMS failed');
        throw new Error(data.message || `Twilio failed: ${res.status}`);
      }
      results.push(data);
    }
    logger.info({ to: normalizedTo }, 'Twilio SMS sent');
    return results;
  }

  throw new Error(`Unknown SMS_PROVIDER ${provider} — use africastalking, twilio, or mock`);
}

export function smsTemplates() {
  return {
    invoiceCreated: (tenantName, amount, dueDate, propertyName) =>
      `Hi ${tenantName}, your rent invoice KES ${amount} for ${propertyName} is due ${dueDate}. Pay via M-Pesa or bank (ref: ${tenantName}). — Rent Sync`,
    paymentReceived: (tenantName, amount, invoiceNumber) =>
      `Hi ${tenantName}, we received KES ${amount} for ${invoiceNumber}. Receipt will follow. Thank you! — Rent Sync`,
    overdueReminder: (tenantName, amount, dueDate) =>
      `Hi ${tenantName}, your rent KES ${amount} due ${dueDate} is overdue. Please pay via M-Pesa/bank (ref: ${tenantName}) to avoid penalties. — Rent Sync`,
  };
}
