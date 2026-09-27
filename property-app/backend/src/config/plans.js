// Rent Sync plans, mirroring src/content/pricing.ts on the marketing site. Keep the two in step:
// the price a landlord is quoted on /pricing is the amount the API expects on a payment request.
//
// Amounts are whole KES because a Send Money transfer is a whole-shilling amount; there is no
// cent handling anywhere in this file or in payment_requests.amount.

export const PLANS = {
  basic: {
    key: 'basic',
    name: 'Basic',
    amount: 2000,
    unitCeiling: 20,
    unitFloor: 5,
  },
  standard: {
    key: 'standard',
    name: 'Standard',
    amount: 4000,
    unitCeiling: 50,
    unitFloor: 21,
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    amount: 6500,
    unitCeiling: 100,
    unitFloor: 51,
  },
  // Priced by conversation, so it carries no fixed amount and no ceiling.
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    amount: null,
    unitCeiling: null,
    unitFloor: 101,
  },
};

export const PLAN_KEYS = Object.keys(PLANS);

export function isPlanKey(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
}

export function getPlan(key) {
  return isPlanKey(key) ? PLANS[key] : null;
}

/**
 * How Rent Sync is actually paid for. Send Money to a phone number, not Lipa na M-PESA: there is
 * no till and no paybill, and the transfer carries no reference we can read. That is why
 * activation is a manual step and why a confirmation code is required.
 */
export const BILLING = {
  method: 'M-Pesa Send Money',
  phoneDisplay: '0790 325 943',
  phoneE164: '+254790325943',
  currency: 'KES',
  /**
   * Returned to the client so the paywall can render real instructions instead of a bare 402.
   * The marketing site renders the same steps at /pay.
   */
  instructions: [
    'Open M-Pesa and dial *334#',
    'Choose Send Money, then Send to New Recipient',
    'Pick Phone Number as the recipient type',
    'Enter 0790 325 943 and the amount for your plan',
    'Enter your M-Pesa PIN and confirm',
    'Submit the confirmation code from the SMS you received',
  ],
};
